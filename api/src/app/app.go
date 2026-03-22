package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"lang/api/explanation"
	"lang/api/firebase"
	"lang/api/generator"
	"lang/api/osutil"
	"lang/api/story"
	"lang/api/stringutil"
	"lang/api/tts"
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
type handlerFuncWithAuth func(http.ResponseWriter, *http.Request, string) error

func wrapError(h handlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if err := h(w, req); err != nil {
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

		return next(w, r, token.UID)
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

	return map[string]any{
		"id": st.Id,
		"localizations": map[string]any{
			l: convertLocalization(st.Localizations[l]),
			r: convertLocalization(st.Localizations[r]),
		},
	}
}

func checkStoryHasLocalization(st story.StoryMultilingual, l, r string) error {
	if _, ok := st.Localizations[l]; !ok {
		return newHTTPError(http.StatusNotFound, "Story not available in '%s'", l)
	}
	if _, ok := st.Localizations[r]; !ok {
		return newHTTPError(http.StatusNotFound, "Story not available in '%s'", r)
	}
	return nil
}

// --- Handlers ---

func getStoryListHandler(w http.ResponseWriter, req *http.Request) error {
	l, r, err := mustExtractLocalePair(req)
	if err != nil {
		return err
	}
	var results []story.StoryDescriptor
	for _, st := range CURATED_STORIES {
		sl, ok := st.Localizations[l]
		if !ok {
			continue
		}
		sr, ok := st.Localizations[r]
		if !ok {
			continue
		}

		results = append(results, story.StoryDescriptor{
			Id:      st.Id,
			Level:   st.Level,
			Locales: []string{l, r},
			Titles:  []string{sl.Title, sr.Title},
		})
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

	if strings.HasPrefix(storyId, "g_") {
		st, err := generator.Get(storyId)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return newHTTPError(http.StatusNotFound, "Story not found")
			} else {
				return err
			}
		}
		if len(st.Localizations) != 2 {
			// TODO: generate an alert here
			return newHTTPError(http.StatusNotFound, "Story not available in 2 locales")
		}
		// Get first 2 keys in st.Localizations map
		var l, r string
		for k := range st.Localizations {
			if l == "" {
				l = k
			} else {
				r = k
				break
			}
		}
		dict := convertStoryToDict(st, l, r)
		return writeJSON(w, dict)
	} else {
		l, r, err := mustExtractLocalePair(req)
		if err != nil {
			return err
		}
		st, err := findStory(storyId)
		if err != nil {
			return err
		}
		err = checkStoryHasLocalization(st, l, r)
		if err != nil {
			return err
		}
		dict := convertStoryToDict(st, l, r)
		return writeJSON(w, dict)
	}

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
	// check localization
	if _, ok := st.Localizations[l]; !ok {
		return newHTTPError(http.StatusNotFound, "Story not available in '%s'", l)
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
	lSentence, err := findSentence(st, l, lIdx)
	if err != nil {
		return err
	}
	rSentence, err := findSentence(st, r, rIdx)
	if err != nil {
		return err
	}

	eId := explanation.ExplanationId{
		StoryId:      storyID,
		L:            l,
		R:            r,
		LSentenceIdx: lIdx,
		RSentenceIdx: rIdx,
	}
	expl, eErr := explanation.Get(eId, lSentence.ToPlainStr(), rSentence.ToPlainStr())
	if eErr != nil {
		return fmt.Errorf("explanation.Get error: %w", eErr)
	}

	return writeJSON(w, map[string]any{"content": expl.Content})
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
	path, tErr := tts.Get(sent.ToPlainStr(), locale, storyID, idx)
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

func generateStoryHandler(w http.ResponseWriter, req *http.Request, uid string) error {
	slog.Info(fmt.Sprintf("Generating story for user %s", uid))

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
	s, err := generator.Generate(params)
	if err != nil {
		return fmt.Errorf("story.Generate error: %w", err)
	}
	err = checkStoryHasLocalization(s, l, r)
	if err != nil {
		panic(err)
	}
	dict := convertStoryToDict(s, l, r)
	return writeJSON(w, dict)
}

func getGeneratedStoryListHandler(w http.ResponseWriter, req *http.Request) error {
	authorId, err := mustExtractParam(req, "author_id")
	if err != nil {
		return err
	}
	stories, err := generator.List(authorId)
	if err != nil {
		return fmt.Errorf("list error: %w", err)
	}
	return writeJSON(w, stories)
}

func deleteGeneratedStoryHandler(w http.ResponseWriter, req *http.Request) error {
	storyId, err := mustExtractParam(req, "story_id")
	if err != nil {
		return err
	}
	authorId, err := mustExtractParam(req, "author_id")
	if err != nil {
		return err
	}
	cnt, err := generator.Delete(storyId, authorId)
	if err != nil {
		return err
	}
	if cnt == 0 {
		return newHTTPError(http.StatusNotFound, "Story not found")
	}
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

func addFirebaseAuthDevReverseProxy(mux *http.ServeMux) {
	authProxyTarget, err := url.Parse("https://lang-dev-70b39.firebaseapp.com")
	if err != nil {
		panic(fmt.Sprintf("failed to parse auth proxy target URL: %v", err))
	}
	authProxy := httputil.NewSingleHostReverseProxy(authProxyTarget)
	mux.HandleFunc("/__/auth/", wrapCors(authProxy.ServeHTTP))
}

func Serve() error {
	CURATED_STORIES, CURATED_STORY_ID_TO_DIR = loadCuratedStories()

	mux := http.NewServeMux()
	mux.HandleFunc("/story-list", wrap(wrapMustBeMethod("GET", getStoryListHandler)))
	mux.HandleFunc("/story", wrap(wrapMustBeMethod("GET", getStoryHandler)))
	mux.HandleFunc("/generate", wrap(wrapMustBeMethod("POST", wrapAuth(generateStoryHandler))))
	mux.HandleFunc("/generated-list", wrap(wrapMustBeMethod("GET", getGeneratedStoryListHandler)))
	mux.HandleFunc("/delete-generated", wrap(wrapMustBeMethod("DELETE", deleteGeneratedStoryHandler)))
	mux.HandleFunc("/explain", wrap(wrapMustBeMethod("GET", getExplanationHandler)))
	mux.HandleFunc("/audio", wrap(wrapMustBeMethod("GET", getAudioHandler)))
	mux.HandleFunc("/image", wrap(wrapMustBeMethod("GET", getImageHandler)))
	mux.HandleFunc("/cookie-accept", wrap(wrapMustBeMethod("GET", cookieAcceptHandler)))
	mux.HandleFunc("/", wrap(wrapMustBeMethod("GET", indexHandler)))

	addFirebaseAuthDevReverseProxy(mux)

	if IS_DEV {
		// We don't use nginx in debug mode, so we need to serve HTTPS ourselves
		slog.Info("Server is running on https://localhost:5001")
		certsDir := osutil.MustGetEnv("LANG_API_DEPLOY_CONFIG_DIR")
		return http.ListenAndServeTLS(":5001", fmt.Sprintf("%s/%s", certsDir, "localhost.crt"), fmt.Sprintf("%s/%s", certsDir, "localhost.key"), mux)
	} else {
		// In prod Nginx will handle SSL termination
		slog.Info("Server is running on http://localhost:5001")
		return http.ListenAndServe(":5001", mux)
	}
}
