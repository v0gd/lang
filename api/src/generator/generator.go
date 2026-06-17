package generator

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"lang/api/cache"
	"lang/api/db"
	"lang/api/gender"
	"lang/api/llm"
	"lang/api/story"
	"lang/api/stringutil"
	"lang/api/telemetry"
	"log/slog"
	"math/rand"
	"strings"
	"time"
)

var (
	storeStmt    *sql.Stmt
	loadStmt     *sql.Stmt
	loadListStmt *sql.Stmt
	deleteStmt   *sql.Stmt
)

func Setup() {
	var err error = nil
	storeStmt, err = db.Db.Prepare(
		"INSERT INTO story (id, author_id, language_level, locales, titles, input_params, content, source) " +
			"VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
			"ON DUPLICATE KEY UPDATE locales = locales;") // Duplicate key should never happen
	if err != nil {
		panic(err)
	}
	loadStmt, err = db.Db.Prepare(
		"SELECT content, author_id FROM story " +
			"WHERE id = ? and deleted = 0;")
	if err != nil {
		panic(err)
	}
	// Newest first; the favorite sort in the listing handler is stable, so
	// this order is preserved both inside and outside the favorites block.
	loadListStmt, err = db.Db.Prepare(
		"SELECT id, language_level, locales, titles FROM story " +
			"WHERE author_id = ? AND deleted = 0 AND FIND_IN_SET(?, locales) " +
			"ORDER BY created DESC;")
	if err != nil {
		panic(err)
	}
	deleteStmt, err = db.Db.Prepare(
		"DELETE FROM story " +
			"WHERE id = ? and author_id = ? and deleted = 0;")
	if err != nil {
		panic(err)
	}
}

// Source identifies how a story row in the `story` table was produced. The
// values must match the MySQL ENUM definition in db-setup.sql.
type Source string

const (
	SourceGenerated Source = "generated"
	SourceImage     Source = "image"
	SourceProvided  Source = "provided"
)

func Store(ctx context.Context, s story.StoryMultilingual, params InputParameters, authorId string, source Source) error {
	paramsJson, err := json.Marshal(params)
	if err != nil {
		return fmt.Errorf("failed to marshal input parameters: %w", err)
	}
	sJson, err := json.Marshal(s)
	if err != nil {
		return fmt.Errorf("failed to marshal story: %w", err)
	}
	locales := make([]string, 0, len(s.Localizations))
	titles := make([]string, 0, len(s.Localizations))
	for l, st := range s.Localizations {
		locales = append(locales, l)
		titles = append(titles, st.Title)
	}
	localesStr := strings.Join(locales, ",")
	titlesStr := strings.Join(titles, "\n")
	_, err = storeStmt.ExecContext(ctx, s.Id, authorId, s.Level, localesStr, titlesStr, paramsJson, sJson, string(source))
	if err != nil {
		return fmt.Errorf("failed to store story in db: %w", err)
	}
	return nil
}

func query(level string, topics []string, moods []string) string {
	return fmt.Sprintf(`You should write a story in English for %s language proficiency level.

The story should be roughly 300 words long.

The story should be about the following topics: %s.

The story should be in the following mood: %s.

The story should be engaging and emotionally resonant.

Print only the story in the following format, only plain text, no markdown or HTML of any kind:
Title

Paragraph 1

Paragraph 2

Other paragraphs...
`, level, strings.Join(topics, ", "), strings.Join(moods, ", "))
}

type Paragraph struct {
	Sentences []string `json:"sentences" jsonschema_description:"Sentences in the paragraph"`
}

type Story struct {
	Title      string      `json:"title" jsonschema_description:"Title of the story"`
	Paragraphs []Paragraph `json:"paragraphs" jsonschema_description:"Paragraphs of the story"`
}

func (s Story) ToPlainStr() string {
	result := s.Title + "\n\n"
	for _, p := range s.Paragraphs {
		for _, s := range p.Sentences {
			result += s + " "
		}
		result += "\n\n"
	}
	return result
}

type SentenceWithTranslation struct {
	Original   string `json:"original" jsonschema_description:"Original sentence in original language"`
	Translated string `json:"translated" jsonschema_description:"Translated sentence in target language"`
}

type ParagraphWithTranslation struct {
	Sentences []SentenceWithTranslation `json:"sentences" jsonschema_description:"Sentences in the paragraph in 2 languages"`
}

type StoryWithTranslation struct {
	OriginalTitle   string                     `json:"original_title" jsonschema_description:"Title of the story in original language"`
	TranslatedTitle string                     `json:"translated_title" jsonschema_description:"Title of the story in target language"`
	Paragraphs      []ParagraphWithTranslation `json:"paragraphs" jsonschema_description:"Paragraphs of the story in 2 languages"`
}

type extractSentence func(SentenceWithTranslation) string

func toStorySentences(sentences []SentenceWithTranslation, extractor extractSentence) []story.Sentence {
	storySentences := make([]story.Sentence, len(sentences))
	for i, s := range sentences {
		storySentences[i] = story.ParseSentence(extractor(s))
	}
	return storySentences
}

func toStoryParagraphsFromBilingual(storyStructured StoryWithTranslation, extractor extractSentence) []story.Paragraph {
	paragraphs := make([]story.Paragraph, len(storyStructured.Paragraphs))
	for i, p := range storyStructured.Paragraphs {
		paragraphs[i] = story.Paragraph{
			Scenes: []story.Scene{
				{
					Sentences: toStorySentences(p.Sentences, extractor),
				},
			},
		}
	}
	return paragraphs
}

var storyWithTranslationSchema = llm.StructuredOutputSchema{
	Schema:      llm.GenerateSchema[StoryWithTranslation](),
	Name:        "story",
	Description: "a story in structured format with translation",
}

func convertBilingualStoryToStructured(ctx context.Context, sl string, sr string) (StoryWithTranslation, error) {
	sJson, err := llm.InvokeStructured(
		ctx,
		"",
		fmt.Sprintf(
			"Given the following text in original language and then its translation, "+
				"extract the title, paragraphs and sentences with the corresponding translations:\n\n"+
				"%s\n\nTranslation:\n\n%s\n\n"+
				"Important: words in either text may be followed by a {m}, {f}, or {n} "+
				"annotation attached directly to the word with no space (for example "+
				`"Haus{n}", "Frau{f}", "Tag{m}"). These are grammatical-gender markers. `+
				"You MUST preserve them verbatim, in the same position, attached to the same "+
				"word. Do not add new markers, do not remove them, do not move them between words, "+
				"and do not insert spaces around them. If a marked word is followed by punctuation, "+
				"the marker still goes directly after the word and before the punctuation.",
			sl, sr),
		storyWithTranslationSchema,
		llm.GptMini)
	if err != nil {
		return StoryWithTranslation{}, fmt.Errorf("failed to break the story into sentences, llm error: %w", err)
	}

	structured := StoryWithTranslation{}
	err = json.Unmarshal([]byte(sJson), &structured)
	if err != nil {
		return StoryWithTranslation{}, fmt.Errorf("failed to unmarshal story: %w", err)
	}

	return structured, nil
}

var storySchema = llm.StructuredOutputSchema{
	Schema:      llm.GenerateSchema[Story](),
	Name:        "story",
	Description: "a story in structured format",
}

// ConvertMonolingualStoryToStructured uses an LLM to break a plain monolingual
// text into a structured Story (title + paragraphs of sentences). ctx is
// forwarded into the underlying LLM call.
func ConvertMonolingualStoryToStructured(ctx context.Context, s string) (Story, error) {
	sJson, err := llm.InvokeStructured(
		ctx,
		"",
		fmt.Sprintf(
			"Given the following text, extract the title, paragraphs and sentences:\n\n%s\n\n"+
				"Important: words in the text may be followed by a {m}, {f}, or {n} "+
				"annotation attached directly to the word with no space (for example "+
				`"Haus{n}", "Frau{f}", "Tag{m}"). These are grammatical-gender markers. `+
				"You MUST preserve them verbatim, in the same position, attached to the same "+
				"word. Do not add new markers, do not remove them, do not move them between words, "+
				"and do not insert spaces around them. If a marked word is followed by punctuation, "+
				"the marker still goes directly after the word and before the punctuation.",
			s),
		storySchema,
		llm.GptMini)
	if err != nil {
		return Story{}, fmt.Errorf("failed to break the story into sentences, llm error: %w", err)
	}

	structured := Story{}
	err = json.Unmarshal([]byte(sJson), &structured)
	if err != nil {
		return Story{}, fmt.Errorf("failed to unmarshal story: %w", err)
	}

	return structured, nil
}

func ToStoryParagraphsFromMonolingual(s Story) []story.Paragraph {
	paragraphs := make([]story.Paragraph, len(s.Paragraphs))
	for i, p := range s.Paragraphs {
		sentences := make([]story.Sentence, len(p.Sentences))
		for j, sentence := range p.Sentences {
			sentences[j] = story.ParseSentence(sentence)
		}
		paragraphs[i] = story.Paragraph{
			Scenes: []story.Scene{{Sentences: sentences}},
		}
	}
	return paragraphs
}

func generateStoryInEnglish(ctx context.Context, level string, topics []string, moods []string) (string, error) {
	trace := telemetry.NewTrace(
		fmt.Sprintf("Generating a story %s: %s - %s", level, strings.Join(topics, ","), strings.Join(moods, ",")))
	defer trace.Stop()

	role := "You are a professional writer for language learners."
	content := query(level, topics, moods)

	sText, err := llm.Invoke(ctx, role, content, llm.Gpt)
	if err == nil {
		return sText, nil
	}
	// Don't fall back on cancellation - the caller is gone.
	if ctxErr := ctx.Err(); ctxErr != nil {
		return "", ctxErr
	}
	slog.Error(fmt.Sprintf("story generation failed, falling back to Gpt: %v", err))

	sText, err = llm.Invoke(ctx, role, content, llm.Gpt)
	if err != nil {
		return "", fmt.Errorf("failed to generate story with fallback model, llm error: %w", err)
	}

	return sText, nil
}

var languageMap = map[string]string{
	"en": "English",
	"de": "German",
	"ru": "Russian",
}

func translateStory(ctx context.Context, l string, r string, s string) (string, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Translating story from %s->%s", l, r))
	defer trace.Stop()

	rLang, ok := languageMap[r]
	if !ok {
		return "", fmt.Errorf("unsupported language: %s", r)
	}

	return llm.Invoke(
		ctx,
		fmt.Sprintf(
			"You are a professional translator for language learners and native %s speaker. "+
				"You try to translate text as close to the original as possible, "+
				"while it should sound absolutely natural in the target language.", rLang),
		fmt.Sprintf("Translate the following text to %s:\n\n%s", rLang, s),
		llm.Gpt)
}

func logIfError(msg string, err error) {
	if err != nil {
		slog.Error(fmt.Sprintf("%s: %v", msg, err))
	}
}

func datetime() string {
	now := time.Now()
	return now.Format("060102_150405")
}

type InputParameters struct {
	Level story.Level `json:"level"`
	// L is the optional mother-tongue locale. An empty value signals that the
	// story should be generated only in the learned language (R), without a
	// mother-tongue translation.
	L      story.Locale `json:"l,omitempty"`
	R      story.Locale `json:"r"`
	Topics []string     `json:"topics"`
	Moods  []string     `json:"mood"`
}

// List returns stories that contain the learned-language locale (r). The
// mother-tongue (l) is accepted for symmetry with the read API but does not
// constrain the result, since a story may legitimately ship without an l
// localization.
func List(authorId string, _ story.Locale, r story.Locale) ([]story.StoryDescriptor, error) {
	rows, err := loadListStmt.Query(authorId, r)
	if err != nil {
		return nil, fmt.Errorf("failed to load list of stories from db: %w", err)
	}
	defer rows.Close()

	descs := []story.StoryDescriptor{}
	for rows.Next() {
		var id string
		var locales string
		var titles string
		var level string
		err = rows.Scan(&id, &level, &locales, &titles)
		if err != nil {
			return nil, fmt.Errorf("failed to scan story from db: %w", err)
		}
		desc := story.StoryDescriptor{
			Id:      story.Id(id),
			Level:   story.Level(level),
			Locales: strings.Split(locales, ","),
			Titles:  strings.Split(titles, "\n"),
		}
		if len(desc.Titles) != len(desc.Locales) {
			panic(fmt.Sprintf("titles and locales size mismatch!: %v - %v", locales, titles))
		}
		descs = append(descs, desc)
	}
	return descs, nil
}

// Get loads a generated story by id and returns it together with the Firebase
// UID of its author, so callers can enforce ownership before serving the story.
func Get(id story.Id) (story.StoryMultilingual, string, error) {
	var content string
	var authorId string
	err := loadStmt.QueryRow(id).Scan(&content, &authorId)
	if err != nil {
		return story.StoryMultilingual{}, "", fmt.Errorf("failed to load story from db: %w", err)
	}
	s := story.StoryMultilingual{}
	err = json.Unmarshal([]byte(content), &s)
	if err != nil {
		return story.StoryMultilingual{}, "", fmt.Errorf("failed to unmarshal story: %w", err)
	}
	return s, authorId, nil
}

func Delete(id story.Id, authorId string) (int64, error) {
	tx, err := db.Db.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.Stmt(deleteStmt).Exec(id, authorId)
	if err != nil {
		return 0, fmt.Errorf("failed to delete story from db: %w", err)
	}
	cnt, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get the number of rows affected: %w", err)
	}
	if cnt == 0 {
		return 0, nil
	}

	weResult, err := tx.Exec("DELETE FROM word_explanation WHERE story_id = ?", id)
	if err != nil {
		return 0, fmt.Errorf("failed to delete word explanations: %w", err)
	}
	eResult, err := tx.Exec("DELETE FROM explanation WHERE story_id = ?", id)
	if err != nil {
		return 0, fmt.Errorf("failed to delete explanations: %w", err)
	}
	ttsResult, err := tx.Exec("DELETE FROM tts WHERE story_id = ?", id)
	if err != nil {
		return 0, fmt.Errorf("failed to delete tts data: %w", err)
	}
	favoriteResult, err := tx.Exec("DELETE FROM user_favorite_story WHERE story_id = ?", id)
	if err != nil {
		return 0, fmt.Errorf("failed to delete favorite marks: %w", err)
	}

	weCount, _ := weResult.RowsAffected()
	eCount, _ := eResult.RowsAffected()
	ttsCount, _ := ttsResult.RowsAffected()
	favoriteCount, _ := favoriteResult.RowsAffected()
	slog.Info(fmt.Sprintf("Deleting story %s: removed %d word_explanations, %d explanations, %d tts entries, %d favorite marks",
		id, weCount, eCount, ttsCount, favoriteCount))

	err = tx.Commit()
	if err != nil {
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}
	return cnt, nil
}

var someTopics = []string{
	"family",
	"friendship",
	"love",
	"nature",
	"animals",
	"travel",
	"work",
	"school",
	"art",
	"health",
	"adventure",
	"mystery",
	"fantasy",
	"science fiction",
	"horror",
	"comedy",
	"romance",
	"drama",
	"thriller",
	"action",
	"historical",
	"biographical",
	"philosophical",
	"political",
	"social",
	"psychological",
	"educational",
	"inspirational",
	"motivational",
}

var someMoods = []string{
	"funny",
	"motivational",
	"inspirational",
	"uplifting",
	"romantic",
	"exciting",
	"scary",
	"mysterious",
	"thought-provoking",
	"educational",
	"informative",
}

func randomTopics() []string {
	topics1 := someTopics[rand.Intn(len(someTopics))]
	topics2 := someTopics[rand.Intn(len(someTopics))]
	if topics1 == topics2 {
		return []string{topics1}
	} else {
		return []string{topics1, topics2}
	}
}

func randomMoods() []string {
	return []string{someMoods[rand.Intn(len(someMoods))]}
}

func eraseNewlines(s string) string {
	return strings.ReplaceAll(s, "\n", " ")
}

func Generate(ctx context.Context, params InputParameters, authorId string) (story.StoryMultilingual, error) {
	traceL := params.L
	if traceL == "" {
		traceL = "-"
	}
	trace := telemetry.NewTrace(fmt.Sprintf("Generating a story %s->%s %s: %s - %s",
		traceL, params.R, params.Level,
		strings.Join(params.Topics, ","), strings.Join(params.Moods, ",")))
	defer trace.Stop()

	storyId := "g_" + stringutil.RandomBase32(20)
	dirPath := "generated/" + datetime() + "_" + storyId
	_, err := cache.MakeDir(dirPath)
	if err != nil {
		return story.StoryMultilingual{}, fmt.Errorf("failed to create cache directory for story: %w", err)
	}

	if len(params.Topics) == 0 {
		params.Topics = randomTopics()
	}
	if len(params.Moods) == 0 {
		params.Moods = randomMoods()
	}

	err = cache.WriteFileString(dirPath+"/query.txt", query(params.Level, params.Topics, params.Moods))
	logIfError("failed to write query", err)

	sEn, err := generateStoryInEnglish(ctx, params.Level, params.Topics, params.Moods)
	if err != nil {
		return story.StoryMultilingual{}, fmt.Errorf("failed to generate story: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}

	err = cache.WriteFileString(dirPath+"/story_en.txt", sEn)
	logIfError("failed to write story en", err)

	if params.L != "" {
		return translateAndConvertBilingualToStructured(ctx, params, authorId, storyId, dirPath, sEn)
	}
	return translateAndConvertMonolingualToStructured(ctx, params, authorId, storyId, dirPath, sEn)
}

// annotateGendersIfSupported runs the gender annotation LLM step on text in
// the given target locale and writes the annotated text to the per-story
// cache directory for debugging. On any failure it logs loudly and returns
// the original text unchanged - story generation must not be aborted just
// because the (cosmetic) gender coloring couldn't be produced. Cancellation
// is the exception: when ctx is cancelled, return the cancellation error so
// the pipeline stops instead of silently falling back and continuing.
func annotateGendersIfSupported(ctx context.Context, text, locale, storyId, dirPath string) (string, error) {
	if !gender.Supports(locale) {
		return text, nil
	}
	annotated, err := gender.Annotate(ctx, text, locale)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return "", ctxErr
		}
		slog.Error(fmt.Sprintf("gender.Annotate failed for story %s (%s): %v", storyId, locale, err))
		return text, nil
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}
	writeErr := cache.WriteFileString(dirPath+"/story_"+locale+"_gendered.txt", annotated)
	logIfError("failed to write gendered story "+locale, writeErr)
	return annotated, nil
}

func translateAndConvertBilingualToStructured(
	ctx context.Context,
	params InputParameters,
	authorId string,
	storyId string,
	dirPath string,
	sEn string,
) (story.StoryMultilingual, error) {
	sL := sEn
	var err error
	if params.L != "en" {
		sL, err = translateStory(ctx, "en", params.L, sEn)
		if err != nil {
			return story.StoryMultilingual{}, fmt.Errorf("failed to translate story en->%s: %w", params.L, err)
		}
		if err := ctx.Err(); err != nil {
			return story.StoryMultilingual{}, err
		}
		err = cache.WriteFileString(dirPath+"/story_"+params.L+".txt", sL)
		logIfError("failed to write story "+params.L, err)
	}

	sR := sEn
	if params.R != "en" {
		sR, err = translateStory(ctx, params.L, params.R, sL)
		if err != nil {
			return story.StoryMultilingual{},
				fmt.Errorf("failed to translate story %s->%s: %w", params.L, params.R, err)
		}
		if err := ctx.Err(); err != nil {
			return story.StoryMultilingual{}, err
		}
		err = cache.WriteFileString(dirPath+"/story_"+params.R+".txt", sR)
		logIfError("failed to write story "+params.R, err)
	}

	sR, err = annotateGendersIfSupported(ctx, sR, params.R, storyId, dirPath)
	if err != nil {
		return story.StoryMultilingual{}, err
	}
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}

	// TODO: add translation validation (sentence count, etc.)
	sSt, err := convertBilingualStoryToStructured(ctx, sL, sR)
	if err != nil {
		return story.StoryMultilingual{}, fmt.Errorf("failed to convert translated story to structured: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}

	sMult := story.StoryMultilingual{
		Id:    storyId,
		Level: params.Level,
		Localizations: map[string]story.Story{
			params.L: {
				Title: eraseNewlines(sSt.OriginalTitle),
				Chapters: []story.Chapter{
					{
						Paragraphs: toStoryParagraphsFromBilingual(sSt, func(s SentenceWithTranslation) string { return s.Original }),
					},
				},
			},
			params.R: {
				// The structurer extracts the title from the annotated R
				// text, so it may carry a {m/f/n} marker (e.g.
				// "Das Haus{n}"). Titles are intentionally kept
				// marker-free / uncolored, so strip here.
				Title: eraseNewlines(gender.Strip(sSt.TranslatedTitle)),
				Chapters: []story.Chapter{
					{
						Paragraphs: toStoryParagraphsFromBilingual(sSt, func(s SentenceWithTranslation) string { return s.Translated }),
					},
				},
			},
		},
	}

	story.CalculateSentenceAndSegmentIndices(&sMult)
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}
	err = Store(ctx, sMult, params, authorId, SourceGenerated)
	return sMult, err
}

func translateAndConvertMonolingualToStructured(
	ctx context.Context,
	params InputParameters,
	authorId string,
	storyId string,
	dirPath string,
	sEn string,
) (story.StoryMultilingual, error) {
	sR := sEn
	var err error
	if params.R != "en" {
		sR, err = translateStory(ctx, "en", params.R, sEn)
		if err != nil {
			return story.StoryMultilingual{},
				fmt.Errorf("failed to translate story en->%s: %w", params.R, err)
		}
		if err := ctx.Err(); err != nil {
			return story.StoryMultilingual{}, err
		}
		err = cache.WriteFileString(dirPath+"/story_"+params.R+".txt", sR)
		logIfError("failed to write story "+params.R, err)
	}

	sR, err = annotateGendersIfSupported(ctx, sR, params.R, storyId, dirPath)
	if err != nil {
		return story.StoryMultilingual{}, err
	}
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}

	sSt, err := ConvertMonolingualStoryToStructured(ctx, sR)
	if err != nil {
		return story.StoryMultilingual{}, fmt.Errorf("failed to convert story to structured: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}

	sMult := story.StoryMultilingual{
		Id:    storyId,
		Level: params.Level,
		Localizations: map[string]story.Story{
			params.R: {
				// Strip any gender marker the structurer attached to the
				// title - titles render uncolored. See bilingual path for
				// the full rationale.
				Title: eraseNewlines(gender.Strip(sSt.Title)),
				Chapters: []story.Chapter{
					{Paragraphs: ToStoryParagraphsFromMonolingual(sSt)},
				},
			},
		},
	}

	story.CalculateSentenceAndSegmentIndices(&sMult)
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}
	err = Store(ctx, sMult, params, authorId, SourceGenerated)
	return sMult, err
}

func Test() {
	params := InputParameters{
		Level:  "A1",
		L:      "de",
		R:      "ru",
		Topics: []string{"family", "friendship"},
	}
	_, err := Generate(context.Background(), params, "test")
	if err != nil {
		panic(fmt.Sprintf("Failed to generate story: %v", err))
	}
}
