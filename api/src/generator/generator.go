package generator

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"lang/api/cache"
	"lang/api/db"
	"lang/api/llm"
	"lang/api/story"
	"lang/api/stringutil"
	"lang/api/telemetry"
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
		"INSERT INTO story (id, author_id, language_level, locales, titles, input_params, content) " +
			"VALUES (?, ?, ?, ?, ?, ?, ?) " +
			"ON DUPLICATE KEY UPDATE locales = locales;") // Duplicate key should neven happen
	if err != nil {
		panic(err)
	}
	loadStmt, err = db.Db.Prepare(
		"SELECT content FROM story " +
			"WHERE id = ? and deleted = 0;")
	if err != nil {
		panic(err)
	}
	loadListStmt, err = db.Db.Prepare(
		"SELECT id, language_level, locales, titles FROM story " +
			"WHERE author_id = ? and deleted = 0;")
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

func store(s story.StoryMultilingual, params InputParameters, authorId string) error {
	sJson, err := json.Marshal(s)
	if err != nil {
		return fmt.Errorf("failed to marshal story: %w", err)
	}
	paramsJson, err := json.Marshal(params)
	if err != nil {
		return fmt.Errorf("failed to marshal input parameters: %w", err)
	}
	locales := make([]string, 0, len(s.Localizations))
	titles := make([]string, 0, len(s.Localizations))
	for l, s := range s.Localizations {
		locales = append(locales, l)
		titles = append(titles, s.Title)
	}
	localesStr := strings.Join(locales, ",")
	titlesStr := strings.Join(titles, "\n")
	_, err = storeStmt.Exec(s.Id, authorId, s.Level, localesStr, titlesStr, paramsJson, sJson)
	if err != nil {
		return fmt.Errorf("failed to store story in db: %w", err)
	}
	return nil
}

func query(level string, topics []string, moods []string) string {
	return fmt.Sprintf(`You should write a story in English for %s language proficiency level.

The story should be roughly 2 pages long.

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

func toStoryParagraphs(storyStructured StoryWithTranslation, extractor extractSentence) []story.Paragraph {
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

func convertTranslatedStoryToStructured(sl string, sr string) (StoryWithTranslation, error) {
	sJson, err := llm.InvokeStructured(
		"",
		fmt.Sprintf(
			"Given the following text in original language and then its translation, "+
				"extract the title, paragraphs and sentences with the corresponding translations:\n\n"+
				"%s\n\nTranslation:\n\n%s", sl, sr),
		storyWithTranslationSchema,
		llm.Gpt4oMini)
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

func generateStory(level string, topics []string, moods []string) (string, error) {
	trace := telemetry.NewTrace(
		fmt.Sprintf("Generating a story %s: %s - %s", level, strings.Join(topics, ","), strings.Join(moods, ",")))
	defer trace.Stop()

	// TODO: icnrease temperature
	sText, err := llm.Invoke("You are a professional writer for language learners.", query(level, topics, moods), llm.Gpt4o)
	if err != nil {
		return "", fmt.Errorf("failed to generate story, llm error: %w", err)
	}

	return sText, nil
}

var languageMap = map[string]string{
	"en": "English",
	"de": "German",
	"ru": "Russian",
}

func translateStory(l string, r string, s string) (string, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Translating story from %s->%s", l, r))
	defer trace.Stop()

	rLang, ok := languageMap[r]
	if !ok {
		return "", fmt.Errorf("unsupported language: %s", r)
	}

	return llm.Invoke(
		fmt.Sprintf(
			"You are a professional translator for language learners and native %s speaker. "+
				"You try to translate text as close to the original as possible (the students will compare texts word by word), "+
				"while it should sound absolutely natural in the target language.", rLang),
		fmt.Sprintf("Translate the following text to %s:\n\n%s", rLang, s),
		llm.Gpt4o)
}

func logIfError(msg string, err error) {
	if err != nil {
		fmt.Printf("%s: %v\n", msg, err)
	}
}

func datetime() string {
	now := time.Now()
	return now.Format("060102_150405")
}

type InputParameters struct {
	Level  story.Level  `json:"level"`
	L      story.Locale `json:"l"`
	R      story.Locale `json:"r"`
	Topics []string     `json:"topics"`
	Moods  []string     `json:"mood"`
}

func List(authorId string) ([]story.StoryDescriptor, error) {
	rows, err := loadListStmt.Query(authorId)
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

func Get(id story.Id) (story.StoryMultilingual, error) {
	var content string
	err := loadStmt.QueryRow(id).Scan(&content)
	if err != nil {
		return story.StoryMultilingual{}, fmt.Errorf("failed to load story from db: %w", err)
	}
	s := story.StoryMultilingual{}
	err = json.Unmarshal([]byte(content), &s)
	if err != nil {
		return story.StoryMultilingual{}, fmt.Errorf("failed to unmarshal story: %w", err)
	}
	return s, nil
}

func Delete(id story.Id, authorId string) (int64, error) {
	result, err := deleteStmt.Exec(id, authorId)
	if err != nil {
		return 0, fmt.Errorf("failed to delete story from db: %w", err)
	}
	cnt, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get the number of rows affected: %w", err)
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

func Generate(params InputParameters) (story.StoryMultilingual, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Generating a story %s->%s %s: %s - %s",
		params.L, params.R, params.Level,
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

	sEn, err := generateStory(params.Level, params.Topics, params.Moods)
	if err != nil {
		return story.StoryMultilingual{}, fmt.Errorf("failed to generate story: %w", err)
	}

	err = cache.WriteFileString(dirPath+"/story_en.txt", sEn)
	logIfError("failed to write story en", err)

	sL := sEn
	if params.L != "en" {
		sL, err = translateStory("en", params.L, sEn)
		if err != nil {
			return story.StoryMultilingual{}, fmt.Errorf("failed to translate story en->%s: %w", params.L, err)
		}
		err = cache.WriteFileString(dirPath+"/story_"+params.L+".txt", sL)
		logIfError("failed to write story "+params.L, err)
	}

	sR := sEn
	if params.R != "en" {
		sR, err = translateStory(params.L, params.R, sL)
		if err != nil {
			return story.StoryMultilingual{},
				fmt.Errorf("failed to translate story %s->%s: %w", params.L, params.R, err)
		}
		err = cache.WriteFileString(dirPath+"/story_"+params.R+".txt", sR)
		logIfError("failed to write story "+params.R, err)
	}

	// TODO: add translation validation (sentence count, etc.)
	sSt, err := convertTranslatedStoryToStructured(sL, sR)
	if err != nil {
		return story.StoryMultilingual{}, fmt.Errorf("failed to convert translated story to structured: %w", err)
	}

	sMult := story.StoryMultilingual{
		Id:    storyId,
		Level: params.Level,
		Localizations: map[string]story.Story{
			params.L: {
				Title: eraseNewlines(sSt.OriginalTitle),
				Chapters: []story.Chapter{
					{
						Paragraphs: toStoryParagraphs(sSt, func(s SentenceWithTranslation) string { return s.Original }),
					},
				},
			},
			params.R: {
				Title: eraseNewlines(sSt.TranslatedTitle),
				Chapters: []story.Chapter{
					{
						Paragraphs: toStoryParagraphs(sSt, func(s SentenceWithTranslation) string { return s.Translated }),
					},
				},
			},
		},
	}

	story.CalculateSentenceAndSegmentIndices(&sMult)
	err = store(sMult, params, "test-author")
	return sMult, err
}

func Test() {
	params := InputParameters{
		Level:  "A1",
		L:      "de",
		R:      "ru",
		Topics: []string{"family", "friendship"},
	}
	_, err := Generate(params)
	if err != nil {
		panic(fmt.Sprintf("Failed to generate story: %v", err))
	}
}
