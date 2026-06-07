package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"lang/api/explanation"
	"lang/api/firebase"
	"lang/api/gender"
	"lang/api/generator"
	"lang/api/osutil"
	"lang/api/scan"
	"lang/api/story"
	"lang/api/stringutil"
	"lang/api/tts"
	"lang/api/upload"
	"lang/api/user"
)

var (
	CURATED_STORIES           []story.StoryMultilingual
	CURATED_STORY_ID_TO_DIR   map[string]string
	SUPPORTED_LOCALES         = []string{"en", "ru", "de"}
	CURATED_STORY_LIST        = []string{"beneath-peeling-paint/C1"}
	ALLOWED_ORIGINS           = getAllowedOrigins()
	CURATED_STORIES_DIR       = osutil.MustGetEnv("LANG_API_CURATED_STORIES_DIR")
	DEBUG_MODE        = osutil.MustGetEnv("LANG_API_DEBUG_MODE") == "1"
	IS_DEV            = osutil.MustGetEnv("LANG_API_IS_DEV") == "1"
)

// handlerFunc is a custom type that returns an error we can handle uniformly.
type handlerFunc func(http.ResponseWriter, *http.Request) error
type handlerFuncWithAuth func(http.ResponseWriter, *http.Request, user.User) error

func wrapError(h handlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if err := h(w, req); err != nil {
			// Client cancelled the in-flight request (e.g. tapped the
			// "Cancel" button on the progress overlay, or just closed the
			// tab). The LLM SDK calls return errors wrapping
			// context.Canceled when this happens. The connection is
			// already gone so writing a body is pointless, and dumping a
			// stack-trace-style Error log for every cancellation drowns
			// out real failures. Demote to Info.
			if errors.Is(err, context.Canceled) || req.Context().Err() != nil {
				slog.Info(fmt.Sprintf("Request cancelled by client: %v", err))
				return
			}
			var httpErr *httpError
			if errors.As(err, &httpErr) {
				slog.Warn(fmt.Sprintf("Request error: %v", err))
				http.Error(w, httpErr.Msg, httpErr.Status)
			} else {
				slog.Error(fmt.Sprintf("Internal error: %v", err))
				http.Error(w, "Internal server error", http.StatusInternalServerError)
			}
		}
	}
}

func wrapAuth(next handlerFuncWithAuth) handlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			return newHTTPError(http.StatusUnauthorized, "Missing Authorization header")
		}

		prefix := "Bearer "
		if !strings.HasPrefix(authHeader, prefix) {
			return newHTTPError(http.StatusUnauthorized, "Invalid Authorization header")
		}
		idToken := strings.TrimPrefix(authHeader, prefix)

		token, err := firebase.Auth.VerifyIDToken(context.Background(), idToken)
		if err != nil {
			return newHTTPError(http.StatusUnauthorized, "Invalid Authorization header")
		}

		// Resolve (and lazily create) the internal user once, here at the
		// boundary, so every authenticated handler receives a fully-resolved
		// User and account-wide checks live in a single place.
		resolvedUser, err := user.Resolve(r.Context(), token.UID)
		if err != nil {
			return fmt.Errorf("failed to resolve user: %w", err)
		}

		return next(w, r, resolvedUser)
	}
}

func wrapCors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		for _, allowedOrigin := range ALLOWED_ORIGINS {
			if origin == allowedOrigin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				break
			}
		}

		// Handle preflight (OPTIONS) request
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func wrapMustBeMethod(method string, next handlerFunc) handlerFunc {
	return func(w http.ResponseWriter, req *http.Request) error {
		if req.Method != method {
			return newHTTPError(http.StatusMethodNotAllowed, "Method '%s' not allowed", req.Method)
		}
		return next(w, req)
	}
}

func wrap(h handlerFunc) http.HandlerFunc {
	return wrapCors(wrapError(h))
}

type httpError struct {
	Msg    string
	Status int
}

func (e *httpError) Error() string {
	return e.Msg
}

func newHTTPError(status int, format string, args ...interface{}) *httpError {
	return &httpError{
		Msg:    fmt.Sprintf(format, args...),
		Status: status,
	}
}

func getAllowedOrigins() []string {
	origin := osutil.MustGetEnv("LANG_API_ALLOWED_ORIGIN")
	return strings.Split(origin, ",")
}

func loadCuratedStories() ([]story.StoryMultilingual, map[string]string) {
	var stories []story.StoryMultilingual
	mapping := make(map[string]string)

	for _, dir := range CURATED_STORY_LIST {
		filePath := filepath.Join(CURATED_STORIES_DIR, dir, "story.txt")
		data, err := os.ReadFile(filePath)
		if err != nil {
			panic(fmt.Sprintf("Failed reading story file %s: %v", filePath, err))
		}
		st := story.Parse(strings.Split(string(data), "\n"))
		mapping[st.Id] = dir
		stories = append(stories, st)
	}
	return stories, mapping
}

func mustExtractParam(req *http.Request, name string) (string, error) {
	val := req.URL.Query().Get(name)
	if val == "" {
		return "", newHTTPError(http.StatusBadRequest, "Missing '%s' parameter", name)
	}
	return val, nil
}

func mustExtractIntParam(req *http.Request, name string) (int, error) {
	valStr, err := mustExtractParam(req, name)
	if err != nil {
		return 0, err
	}
	val, convErr := strconv.Atoi(valStr)
	if convErr != nil {
		return 0, newHTTPError(http.StatusBadRequest, "Invalid '%s' parameter: '%s'", name, valStr)
	}
	return val, nil
}

func mustExtractLocaleParam(req *http.Request, name string) (string, error) {
	loc, err := mustExtractParam(req, name)
	if err != nil {
		return "", err
	}
	for _, s := range SUPPORTED_LOCALES {
		if s == loc {
			return loc, nil
		}
	}
	return "", newHTTPError(http.StatusBadRequest, "Invalid '%s' parameter: '%s'", name, loc)
}

func mustExtractLocalePair(req *http.Request) (story.Locale, story.Locale, error) {
	l, err := mustExtractLocaleParam(req, "l")
	if err != nil {
		return "", "", err
	}
	r, err := mustExtractLocaleParam(req, "r")
	if err != nil {
		return "", "", err
	}
	if l == r {
		return "", "", newHTTPError(http.StatusBadRequest, "Locales 'l' and 'r' cannot be the same")
	}
	return l, r, nil
}

func mustExtractLevel(req *http.Request) (story.Level, error) {
	levelStr, err := mustExtractParam(req, "level")
	if err != nil {
		return "", err
	}
	for _, l := range story.LEVELS {
		if l == levelStr {
			return l, nil
		}
	}
	return "", newHTTPError(http.StatusBadRequest, "Invalid 'level' parameter: '%s'", levelStr)
}

func findStory(storyID string) (story.StoryMultilingual, error) {
	if strings.HasPrefix(storyID, "g_") {
		st, err := generator.Get(storyID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return story.StoryMultilingual{}, newHTTPError(http.StatusNotFound, "Story not found")
			} else {
				return story.StoryMultilingual{}, err
			}
		}
		return st, nil
	} else {
		for _, s := range CURATED_STORIES {
			if s.Id == storyID {
				return s, nil
			}
		}
		return story.StoryMultilingual{}, newHTTPError(http.StatusNotFound, "Story not found")
	}
}

func findStoryRelativeDir(storyID string) (string, error) {
	dir, ok := CURATED_STORY_ID_TO_DIR[storyID]
	if !ok {
		return "", newHTTPError(http.StatusNotFound, "Story not found")
	}
	return dir, nil
}

func findSentence(st story.StoryMultilingual, locale string, idx int) (story.Sentence, error) {
	loc, ok := st.Localizations[locale]
	if !ok {
		return story.Sentence{}, newHTTPError(http.StatusNotFound, "Locale '%s' not found in story", locale)
	}
	for _, ch := range loc.Chapters {
		for _, p := range ch.Paragraphs {
			for _, sc := range p.Scenes {
				for _, s := range sc.Sentences {
					if s.Index == idx {
						return s, nil
					}
				}
			}
		}
	}
	return story.Sentence{}, newHTTPError(http.StatusNotFound, "Sentence not found")
}

// Takes a story and converts it to a dictionary digestible by the frontend.
// Output format is:
// {
//   "id": "story_id",
//   "localizations": {
//     "l": {
//       "title": "title",
//       "chapters": [
//         {
//           "title": "title",
//           "paragraphs": [
//             {
//               "sentences": [
//                 {
//                   "text": "sentence",
//                   "index": "index",
//                   "hasAudio": true,
//                   "imageId": "image_id"
//                 }
//               ]
//             }
//           ]
//         }
//       ]
//     },
//     "r": { ... }
//   }
// }
func convertStoryToDict(st story.StoryMultilingual, l, r string) map[string]any {
	convertParagraph := func(par story.Paragraph) map[string]any {
		var sentences []map[string]any
		for _, scn := range par.Scenes {
			for _, s := range scn.Sentences {
				sentences = append(sentences, map[string]any{
					"text":     s.ToPlainStr(),
					"index":    s.Index,
					"hasAudio": true,
				})
			}
		}
		out := map[string]any{"sentences": sentences}
		if par.MaybeImageId != "" {
			out["imageId"] = par.MaybeImageId
		}
		return out
	}

	convertChapter := func(chapter story.Chapter) map[string]any {
		var paragraphs []map[string]any
		for _, p := range chapter.Paragraphs {
			paragraphs = append(paragraphs, convertParagraph(p))
		}
		out := map[string]any{"paragraphs": paragraphs}
		if chapter.MaybeTitle != "" {
			out["title"] = chapter.MaybeTitle
		}
		return out
	}

	convertLocalization := func(loc story.Story) map[string]any {
		var chapters []map[string]any
		for _, c := range loc.Chapters {
			chapters = append(chapters, convertChapter(c))
		}
		out := map[string]any{
			"title":    loc.Title,
			"chapters": chapters,
		}
		if loc.MaybeImageId != "" {
			out["imageId"] = loc.MaybeImageId
		}
		return out
	}

	localizations := map[string]any{}
	localizations[r] = convertLocalization(st.Localizations[r])
	if lStory, ok := st.Localizations[l]; ok && l != "" {
		localizations[l] = convertLocalization(lStory)
	}
	return map[string]any{
		"id":            st.Id,
		"localizations": localizations,
	}
}

// --- Handlers ---

func getStoryListHandler(w http.ResponseWriter, req *http.Request) error {
	l, r, err := mustExtractLocalePair(req)
	if err != nil {
		return err
	}
	var results []story.StoryDescriptor
	for _, st := range CURATED_STORIES {
		sr, ok := st.Localizations[r]
		if !ok {
			continue
		}
		desc := story.StoryDescriptor{
			Id:      st.Id,
			Level:   st.Level,
			Locales: []string{r},
			Titles:  []string{sr.Title},
		}
		if sl, ok := st.Localizations[l]; ok {
			desc.Locales = []string{l, r}
			desc.Titles = []string{sl.Title, sr.Title}
		}
		results = append(results, desc)
	}
	return writeJSON(w, results)
}

func getStoryHandler(w http.ResponseWriter, req *http.Request) error {
	if DEBUG_MODE {
		CURATED_STORIES, CURATED_STORY_ID_TO_DIR = loadCuratedStories()
	}

	storyId, err := mustExtractParam(req, "id")
	if err != nil {
		return err
	}
	l, r, err := mustExtractLocalePair(req)
	if err != nil {
		return err
	}
	st, err := findStory(storyId)
	if err != nil {
		return err
	}
	if _, ok := st.Localizations[r]; !ok {
		return newHTTPError(http.StatusNotFound, "Story not available in '%s'", r)
	}
	dict := convertStoryToDict(st, l, r)
	return writeJSON(w, dict)
}

func getExplanationHandler(w http.ResponseWriter, req *http.Request) error {
	storyID, err := mustExtractParam(req, "story_id")
	if err != nil {
		return err
	}
	l, r, err := mustExtractLocalePair(req)
	if err != nil {
		return err
	}
	st, err := findStory(storyID)
	if err != nil {
		return err
	}
	if _, ok := st.Localizations[r]; !ok {
		return newHTTPError(http.StatusNotFound, "Story not available in '%s'", r)
	}
	lIdx, err := mustExtractIntParam(req, "l_sentence_idx")
	if err != nil {
		return err
	}
	rIdx, err := mustExtractIntParam(req, "r_sentence_idx")
	if err != nil {
		return err
	}
	maybeLSentence, err := findSentence(st, l, lIdx)
	if err != nil {
		// L sentence is optional.
	}
	rSentence, err := findSentence(st, r, rIdx)
	if err != nil {
		return err
	}

	// Strip {m/f/n} gender markers before handing text to the explanation
	// LLMs and word-extractor. The markers exist for UI coloring only and
	// would only distract the explanation prompts. Stripping does NOT shift
	// word indices because markers contain no whitespace.
	lSentenceText := gender.Strip(maybeLSentence.ToPlainStr())
	rSentenceText := gender.Strip(rSentence.ToPlainStr())

	wordIdxStr := req.URL.Query().Get("word_idx")
	if wordIdxStr == "" {
		eId := explanation.SentenceExplanationId{
			StoryId:      storyID,
			L:            l,
			R:            r,
			LSentenceIdx: lIdx,
			RSentenceIdx: rIdx,
		}
		expl, eErr := explanation.GetSentence(req.Context(), eId, lSentenceText, rSentenceText)
		if eErr != nil {
			return fmt.Errorf("explanation.GetSentence error: %w", eErr)
		}
		return writeJSON(w, map[string]any{"content": expl.Content})
	} else {
		wordIdx, convErr := strconv.Atoi(wordIdxStr)
		if convErr != nil {
			return newHTTPError(http.StatusBadRequest, "Invalid 'word_idx' parameter: '%s'", wordIdxStr)
		}
		wId := explanation.WordExplanationId{
			StoryId:      storyID,
			L:            l,
			LSentenceIdx: lIdx,
			R:            r,
			RSentenceIdx: rIdx,
			WordIdx:      wordIdx,
		}
		expl, eErr := explanation.GetWord(req.Context(), wId, lSentenceText, rSentenceText)
		if eErr != nil {
			return fmt.Errorf("explanation.GetWord error: %w", eErr)
		}
		return writeJSON(w, map[string]any{"content": expl.Content})
	}
}

func getAudioHandler(w http.ResponseWriter, req *http.Request) error {
	storyID, err := mustExtractParam(req, "story_id")
	if err != nil {
		return err
	}
	st, err := findStory(storyID)
	if err != nil {
		return err
	}
	locale, err := mustExtractLocaleParam(req, "locale")
	if err != nil {
		return err
	}
	if _, ok := st.Localizations[locale]; !ok {
		return newHTTPError(http.StatusNotFound, "Story not available in '%s'", locale)
	}
	idx, err := mustExtractIntParam(req, "sentence_idx")
	if err != nil {
		return err
	}
	sent, err := findSentence(st, locale, idx)
	if err != nil {
		return err
	}
	// Strip gender markers so TTS doesn't try to pronounce "{n}" etc.
	path, tErr := tts.Get(gender.Strip(sent.ToPlainStr()), locale, storyID, idx)
	if tErr != nil {
		return fmt.Errorf("tts.Get error: %w", tErr)
	}
	http.ServeFile(w, req, path)
	return nil
}

func getImageHandler(w http.ResponseWriter, req *http.Request) error {
	storyID, err := mustExtractParam(req, "story_id")
	if err != nil {
		return err
	}
	dir, err := findStoryRelativeDir(storyID)
	if err != nil {
		return err
	}
	imageID, err := mustExtractParam(req, "id")
	if err != nil {
		return err
	}
	if !stringutil.IsAlphaNum(imageID) {
		return newHTTPError(http.StatusBadRequest, "Invalid 'id' parameter: '%s'", imageID)
	}
	filePath := filepath.Join(CURATED_STORIES_DIR, dir, "..", "images", imageID+".webp")
	http.ServeFile(w, req, filePath)
	return nil
}

func filterTopicsOrMoods(s []string) []string {
	var res []string = make([]string, 0, 3)
	for _, v := range s {
		if stringutil.IsAlphaNumOrSpace(v) && len(v) <= 30 {
			res = append(res, v)
			if len(res) == 3 {
				break
			}
		}
	}
	return res
}

func generateStoryHandler(w http.ResponseWriter, req *http.Request, u user.User) error {
	slog.Info(fmt.Sprintf("Generating story for user %s", u.FirebaseUid))

	l, r, err := mustExtractLocalePair(req)
	if err != nil {
		return err
	}
	level, err := mustExtractLevel(req)
	if err != nil {
		return err
	}
	topics := strings.Split(req.URL.Query().Get("topics"), ",")
	topicsFiltered := filterTopicsOrMoods(topics)
	if len(topics) != len(topicsFiltered) {
		return newHTTPError(http.StatusBadRequest, "Invalid 'topics' parameter")
	}
	moods := strings.Split(req.URL.Query().Get("moods"), ",")
	moodsFiltered := filterTopicsOrMoods(moods)
	if len(moods) != len(moodsFiltered) {
		return newHTTPError(http.StatusBadRequest, "Invalid 'moods' parameter")
	}

	params := generator.InputParameters{
		Level:  level,
		L:      l,
		R:      r,
		Topics: topicsFiltered,
		Moods:  moodsFiltered,
	}
	// TODO: re-try a few times
	s, err := generator.Generate(req.Context(), params, u.FirebaseUid)
	if err != nil {
		return fmt.Errorf("story.Generate error: %w", err)
	}
	if _, ok := s.Localizations[r]; !ok {
		return newHTTPError(http.StatusNotFound, "Story not available in '%s'", r)
	}
	dict := convertStoryToDict(s, l, r)
	return writeJSON(w, dict)
}

func getGeneratedStoryListHandler(w http.ResponseWriter, req *http.Request, u user.User) error {
	l, r, err := mustExtractLocalePair(req)
	if err != nil {
		return err
	}
	stories, err := generator.List(u.FirebaseUid, l, r)
	if err != nil {
		return fmt.Errorf("list error: %w", err)
	}
	slog.Info(fmt.Sprintf("Listed %d generated stories for user %s", len(stories), u.FirebaseUid))
	return writeJSON(w, stories)
}

// scanMaxImages caps the number of images per /scan request so a single
// request cannot run a huge multimodal LLM call. 5 covers the realistic
// "scan a few pages of a letter / booklet" use case.
const scanMaxImages = 5

// scanMaxTotalBytes caps the combined raw image payload per /scan request to
// keep memory usage and provider request size bounded.
const scanMaxTotalBytes = 10 * 1024 * 1024

func scanHandler(w http.ResponseWriter, req *http.Request, u user.User) error {
	r, err := mustExtractLocaleParam(req, "r")
	if err != nil {
		return err
	}

	// Limit body size before the multipart parser allocates anything.
	req.Body = http.MaxBytesReader(w, req.Body, scanMaxTotalBytes+1024*1024)
	if err := req.ParseMultipartForm(scanMaxTotalBytes); err != nil {
		return newHTTPError(http.StatusBadRequest, "Invalid multipart form: %v", err)
	}
	if req.MultipartForm == nil {
		return newHTTPError(http.StatusBadRequest, "Missing multipart form")
	}
	defer func() {
		if req.MultipartForm != nil {
			_ = req.MultipartForm.RemoveAll()
		}
	}()

	files := req.MultipartForm.File["images"]
	if len(files) == 0 {
		return newHTTPError(http.StatusBadRequest, "No 'images' files in form")
	}
	if len(files) > scanMaxImages {
		return newHTTPError(http.StatusBadRequest, "Too many images (max %d)", scanMaxImages)
	}

	images := make([]scan.Image, 0, len(files))
	var totalBytes int64
	for i, fh := range files {
		mimeType := fh.Header.Get("Content-Type")
		if !strings.HasPrefix(mimeType, "image/") {
			return newHTTPError(http.StatusBadRequest, "File %d is not an image (got %q)", i, mimeType)
		}
		f, err := fh.Open()
		if err != nil {
			return fmt.Errorf("failed to open uploaded image %d: %w", i, err)
		}
		bytes, err := io.ReadAll(f)
		_ = f.Close()
		if err != nil {
			return fmt.Errorf("failed to read uploaded image %d: %w", i, err)
		}
		if len(bytes) == 0 {
			return newHTTPError(http.StatusBadRequest, "Image %d is empty", i)
		}
		totalBytes += int64(len(bytes))
		if totalBytes > scanMaxTotalBytes {
			return newHTTPError(http.StatusRequestEntityTooLarge, "Total image size exceeds %d bytes", scanMaxTotalBytes)
		}
		images = append(images, scan.Image{Bytes: bytes, MimeType: mimeType})
	}

	slog.Info(fmt.Sprintf("Scanning %d image(s) (%d bytes) for user %s -> %s", len(images), totalBytes, u.FirebaseUid, r))

	s, err := scan.Scan(req.Context(), images, r, u.FirebaseUid)
	if err != nil {
		if errors.Is(err, scan.ErrNoTargetLanguage) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnprocessableEntity)
			return json.NewEncoder(w).Encode(map[string]any{"error": "no_target_language"})
		}
		return fmt.Errorf("scan.Scan error: %w", err)
	}
	dict := convertStoryToDict(s, "", r)
	return writeJSON(w, dict)
}

// uploadHandler accepts a user-pasted passage of target-language text, runs
// it through the safety/normalize/gender/structuring pipeline, and persists
// the resulting story with source='provided'.
//
// Request shape:
//
//	POST /upload?r=de
//	Authorization: Bearer <firebase-id-token>
//	Content-Type: application/json
//	{"text": "..."}
//
// The body is hard-capped to roughly the worst-case UTF-8 size of
// upload.MaxInputChars (4 bytes/rune) plus a small JSON envelope. The
// rune-accurate limit is enforced inside upload.Upload so the user sees the
// same "characters" count the UI does.
func uploadHandler(w http.ResponseWriter, req *http.Request, u user.User) error {
	r, err := mustExtractLocaleParam(req, "r")
	if err != nil {
		return err
	}

	maxBodyBytes := int64(4*upload.MaxInputChars + 1024)
	req.Body = http.MaxBytesReader(w, req.Body, maxBodyBytes)

	var body struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			return newHTTPError(http.StatusRequestEntityTooLarge, "Request body exceeds %d bytes", maxBodyBytes)
		}
		return newHTTPError(http.StatusBadRequest, "Invalid JSON body: %v", err)
	}

	slog.Info(fmt.Sprintf("Uploading %d chars for user %s -> %s", len(body.Text), u.FirebaseUid, r))

	s, err := upload.Upload(req.Context(), body.Text, r, u.FirebaseUid)
	if err != nil {
		switch {
		case errors.Is(err, upload.ErrInputEmpty):
			return newHTTPError(http.StatusBadRequest, "Empty text")
		case errors.Is(err, upload.ErrInputTooLong):
			return newHTTPError(http.StatusRequestEntityTooLarge, "Text exceeds %d characters", upload.MaxInputChars)
		case errors.Is(err, upload.ErrPromptInjection):
			return writeJSONStatus(w, http.StatusUnprocessableEntity, map[string]any{"error": "prompt_injection"})
		case errors.Is(err, upload.ErrDisallowedContent):
			return writeJSONStatus(w, http.StatusUnprocessableEntity, map[string]any{"error": "disallowed_content"})
		case errors.Is(err, upload.ErrNoTargetLanguage):
			return writeJSONStatus(w, http.StatusUnprocessableEntity, map[string]any{"error": "no_target_language"})
		default:
			return fmt.Errorf("upload.Upload error: %w", err)
		}
	}
	dict := convertStoryToDict(s, "", r)
	return writeJSON(w, dict)
}

func deleteGeneratedStoryHandler(w http.ResponseWriter, req *http.Request, u user.User) error {
	storyId, err := mustExtractParam(req, "story_id")
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Deleting story %s for user %s", storyId, u.FirebaseUid))
	cnt, err := generator.Delete(storyId, u.FirebaseUid)
	if err != nil {
		return fmt.Errorf("failed to delete story %s for user %s: %w", storyId, u.FirebaseUid, err)
	}
	if cnt == 0 {
		slog.Warn(fmt.Sprintf("Story %s not found for user %s", storyId, u.FirebaseUid))
		return newHTTPError(http.StatusNotFound, "Story not found")
	}
	slog.Info(fmt.Sprintf("Deleted story %s for user %s", storyId, u.FirebaseUid))
	return nil
}

func cookieAcceptHandler(w http.ResponseWriter, req *http.Request) error {
	return writeJSON(w, map[string]any{})
}

func indexHandler(w http.ResponseWriter, req *http.Request) error {
	_, _ = w.Write([]byte("<h1>Hello!</h1>"))
	return nil
}

// Helper to encode JSON with consistent header
func writeJSON(w http.ResponseWriter, data any) error {
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(data)
}

// writeJSONStatus is writeJSON for non-200 responses. We set the header and
// status code BEFORE encoding so the client sees the correct status when the
// body arrives.
func writeJSONStatus(w http.ResponseWriter, status int, data any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(data)
}

func Serve() error {
	CURATED_STORIES, CURATED_STORY_ID_TO_DIR = loadCuratedStories()

	mux := http.NewServeMux()
	mux.HandleFunc("/story-list", wrap(wrapMustBeMethod("GET", getStoryListHandler)))
	mux.HandleFunc("/story", wrap(wrapMustBeMethod("GET", getStoryHandler)))
	mux.HandleFunc("/generate", wrap(wrapMustBeMethod("POST", wrapAuth(generateStoryHandler))))
	mux.HandleFunc("/scan", wrap(wrapMustBeMethod("POST", wrapAuth(scanHandler))))
	mux.HandleFunc("/upload", wrap(wrapMustBeMethod("POST", wrapAuth(uploadHandler))))
	mux.HandleFunc("/generated-list", wrap(wrapMustBeMethod("GET", wrapAuth(getGeneratedStoryListHandler))))
	mux.HandleFunc("/delete-generated", wrap(wrapMustBeMethod("DELETE", wrapAuth(deleteGeneratedStoryHandler))))
	mux.HandleFunc("/explain", wrap(wrapMustBeMethod("GET", getExplanationHandler)))
	mux.HandleFunc("/audio", wrap(wrapMustBeMethod("GET", getAudioHandler)))
	mux.HandleFunc("/image", wrap(wrapMustBeMethod("GET", getImageHandler)))
	mux.HandleFunc("/cookie-accept", wrap(wrapMustBeMethod("GET", cookieAcceptHandler)))
	mux.HandleFunc("/", wrap(wrapMustBeMethod("GET", indexHandler)))

	slog.Info("Server is running on http://localhost:5001")
	return http.ListenAndServe(":5001", mux)
}
