package explanation

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"lang/api/db"
	"lang/api/dictionary"
	"lang/api/gender"
	"lang/api/llm"
	"lang/api/story"
	"lang/api/telemetry"
	"log/slog"
	"strings"
	"sync"
	"unicode"
)

type SentenceExplanation struct {
	LSentenceIdx int    `json:"l_sentence_idx"`
	RSentenceIdx int    `json:"r_sentence_idx"`
	Content      string `json:"text"`
}

var (
	LANGUAGES_EN = map[string]string{
		"en": "English",
		"ru": "Russian",
		"de": "German",
	}

	LANGUAGES_RU = map[string]string{
		"en": "английский",
		"ru": "русский",
		"de": "немецкий",
	}

	LANGUAGES_DE = map[string]string{
		"en": "Englisch",
		"ru": "Russisch",
		"de": "Deutsch",
	}
)

func sentenceLlmRole(l, r, level string) string {
	return fmt.Sprintf(
		`You are professional teacher that specializes in teaching %s to %s speakers. You are explaining a given sentence translation to a student who is at %s level of proficiency in %s.
    
You must adjust your explanation according to the student's %s level of proficiency in %s, meaning focus on individual words for beginners, and on more advanced grammar and idiomatic expressions for advanced students.

Sometime translation may be not very close to retain literary style in the target language, in such cases explain how literal translation would look like.
    
You must always provide explanation in %s language.

Explain individual word translations that might be new for the given level of proficiency, e.g. for A1 level you might provide translation for words like "knife" or "table", for B2 you should provide translation for words like "obligation", but not for "car" or "running" (its expected that the student already know them well at B2 level).

You must pay special attention to compound verb, phrasal verbs, idiomatic expressions, and other complex grammar structures. Explain their meaning in the target language. For example, in German "Du musst damit auf, bevor es zu spät ist, hören." "... auf ... hören" is a separable verb "aufhören" which means "to stop", and it should be explained like this.

If the student learns German or Russian, you must explain word gender and case of the corresponding German or Russian word where applicable (e.g. for nouns).

You must explain unusual word order if applicable.

You must be concise. You must NOT repeat the whole input sentences in your explanation, only give part-by-part explanation.

Do not explain what translation means if it is already clear from the translation itself, for example, if the student speaks Russian and learns German:
1. do not explain """Drinnen - "Внутри". Обозначает, что действие происходит внутри помещения или здания.""" because for a russian speaking student it's obvious that "внутри" already means "действие происходит внутри помещения или здания". 
2. do not explain """"Geschäftigkeit" - суета, занятость, передает активность матери.""", because for a russian speaking student it's obvious that "суета, занятость" already conducts "активность".

You must always format your answer as a list of valid HTML paragraphs using only <p>, <strong>, <em> tags.

When you quote an excerpt from the story or its translation, use straight ASCII double quotes ("...") only. If the excerpt already begins and ends with quotation marks of any style (typographic German „...", French «...», single '...', etc.), strip those outer quotes when referencing the excerpt and wrap it in straight quotes exactly once. Never produce nested quotes like "„Kaffee"" or ""text"".

Example input for Russian speakers learning English (A2 level):
The phone rang, its shrill ringing slicing through the quiet of Clara's afternoon.
Зазвонил телефон, его резкий шум нарушил тишину дня Клары.

Expected output:
<p>
  <strong>The phone rang</strong> - <em>"Телефон зазвонил"</em>, <em>rang</em> - past simple форма глагола <em>ring</em> (звонить).
</p>
<p>
  <strong>its shrill ringing</strong> - <em>"его резкий шум"</em>. Дословно <em>"его пронзительный звон"</em>. <em>Its</em> - притяжательная форма местоимения <em>it</em>.
</p>
<p>
  <strong>slicing through the quiet of Clara's afternoon</strong> - <em>"разрезая тишину дня Клары"</em>. Дословно <em>"прорезая сквозь тишину послеобеденного времени Клары"</em>. <em>Clara's</em> - притяжательная форма имени <em>Clara</em>.
</p>


Example input for Russian speakers learning English (B1 level):
Driven by a mix of longing and a strange sense of obligation, she set off on her way.
Движимая смесью тоски и странного чувства долга, она приехала.

Expected output:
<p>
  <strong>Driven by a mix of longing and a strange sense of obligation</strong> - <em>"Движимая смесью тоски и странного чувства долга"</em>. <em>Driven</em> (побужденная, двигаемая) - пассивная форма глагола <em>drive</em>. <em>Longing</em> - тоска. <em>Obligation</em> - обязательность, долг.
</p>
<p>
  <strong>she set off on her way</strong> - <em>"она приехала"</em>. Дословно <em>"она отправилась в свой путь"</em>. <em>Set off</em> - отправиться в путь, начать движение.
</p>


Example input for English speakers learning German (A2 level):
Du musst damit auf, bevor es zu spät ist, hören.
You must stop it before it's too late.

Expected output:
<p>
  <strong>Du musst damit</strong> - <em>"You must (with) it"<em>. <em>"Auf"</em> is a part of the separable verb <em>"aufhören"</em>.
</p>
<p>
  <strong>bevor es zu spät ist</strong> - <em>"before it's too late"<em> is a subordinate clause. The conjugated verb typically moves to the end of subordinate clauses, so <em>"ist"</em> is at the end.
</p>
<p>
  <strong>...auf ...hören</strong> - is a separable verb <em>"to stop"<em>. <em>"Hören"</em> means <em>"to listen"<em> or <em>"to hear"<em>, but <em>"aufhören"</em> means <em>"to stop"</em>. The sentence contains modal verb <em>"müssen"</em> (must), so the verb <em>"hören"</em> goes to the end of the sentence.
</p>
`,
		LANGUAGES_EN[r],
		LANGUAGES_EN[l],
		level,
		LANGUAGES_EN[r],
		level,
		LANGUAGES_EN[r],
		LANGUAGES_EN[l],
	)
}

func sentenceLlmQueryContent(l, maybeLSentence, r, rSentence string) string {
	maybeLSentence = strings.TrimSpace(maybeLSentence)

	if l == "en" {
		if maybeLSentence == "" {
			return fmt.Sprintf(`Explain part by part the following %s sentence for English speakers:

"%s"
`, LANGUAGES_EN[r], rSentence)
		}

		return fmt.Sprintf(`Explain part by part the following translation from %s to English:

"%s"

in %s:

"%s"
`, LANGUAGES_EN[r], rSentence, LANGUAGES_EN[r], maybeLSentence)
	}

	if l == "ru" {
		if maybeLSentence == "" {
			return fmt.Sprintf(`Объясни по частям следующее предложение на %s языке для русскоязычных:

"%s"
`, LANGUAGES_RU[r], rSentence)
		}

		return fmt.Sprintf(`Объясни по частям следующий перевод с %s на русский язык:

"%s"

%s перевод:

"%s"
`, LANGUAGES_RU[r], rSentence, LANGUAGES_RU[r], maybeLSentence)
	}

	if l == "de" {
		if maybeLSentence == "" {
			return fmt.Sprintf(`Erkläre in Teilen den folgenden %s Satz für Deutschsprachige:

"%s"
`, LANGUAGES_DE[r], rSentence)
		}

		return fmt.Sprintf(`Erkläre in Teilen die folgende Übersetzung von %s ins Deutsch:

"%s"

auf %s:

"%s"
`, LANGUAGES_DE[r], rSentence, LANGUAGES_DE[r], maybeLSentence)
	}

	panic(fmt.Sprintf("Unknown language %s", l))
}

type SentenceExplanationId struct {
	StoryId      story.Id
	L            story.Locale
	LSentenceIdx int
	R            story.Locale
	RSentenceIdx int
}

func (eId SentenceExplanationId) String() string {
	return fmt.Sprintf("%s_%s_%d_%s_%d", eId.StoryId, eId.L, eId.LSentenceIdx, eId.R, eId.RSentenceIdx)
}

var (
	sentenceStoreStmt *sql.Stmt
	sentenceLoadStmt  *sql.Stmt
	wordStoreStmt     *sql.Stmt
	wordLoadStmt      *sql.Stmt
)

func Setup() {
	var err error
	sentenceStoreStmt, err = db.Db.Prepare(
		"INSERT INTO explanation (story_id, l, r, l_sentence_idx, r_sentence_idx, content) " +
			"VALUES (?, ?, ?, ?, ?, ?) " +
			"ON DUPLICATE KEY UPDATE content = content;")
	if err != nil {
		panic(err)
	}
	sentenceLoadStmt, err = db.Db.Prepare(
		"SELECT content FROM explanation " +
			"WHERE story_id = ? AND l = ? AND l_sentence_idx = ? AND r = ? AND r_sentence_idx = ?")
	if err != nil {
		panic(err)
	}
	wordStoreStmt, err = db.Db.Prepare(
		"INSERT INTO word_explanation (story_id, l, r, l_sentence_idx, r_sentence_idx, word_idx, content, dictionary_entry_id) " +
			"VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
			"ON DUPLICATE KEY UPDATE content = content;")
	if err != nil {
		panic(err)
	}
	wordLoadStmt, err = db.Db.Prepare(
		"SELECT content, dictionary_entry_id FROM word_explanation " +
			"WHERE story_id = ? AND l = ? AND l_sentence_idx = ? AND r = ? AND r_sentence_idx = ? AND word_idx = ?")
	if err != nil {
		panic(err)
	}
}

func storeSentence(ctx context.Context, eId SentenceExplanationId, e SentenceExplanation) error {
	_, err := sentenceStoreStmt.ExecContext(ctx, eId.StoryId, eId.L, eId.R, eId.LSentenceIdx, eId.RSentenceIdx, e.Content)
	if err != nil {
		return fmt.Errorf("failed to store sentence explanation in db: %w", err)
	}
	return nil
}

func loadSentence(eId SentenceExplanationId) (SentenceExplanation, error) {
	var content string
	err := sentenceLoadStmt.QueryRow(eId.StoryId, eId.L, eId.LSentenceIdx, eId.R, eId.RSentenceIdx).Scan(&content)
	if err != nil {
		return SentenceExplanation{}, fmt.Errorf("failed to load sentence explanation from db: %w", err)
	}
	return SentenceExplanation{
		LSentenceIdx: eId.LSentenceIdx,
		RSentenceIdx: eId.RSentenceIdx,
		Content:      content,
	}, nil
}

func generateSentence(
	ctx context.Context, eId SentenceExplanationId, maybeLSentence, rSentence string,
) (SentenceExplanation, error) {
	response, err := llm.Invoke(
		ctx,
		sentenceLlmRole(eId.L, eId.R, "C1"), sentenceLlmQueryContent(eId.L, maybeLSentence, eId.R, rSentence), llm.Gpt)
	if err != nil {
		return SentenceExplanation{}, err
	}
	response = strings.ReplaceAll(response, "<p>", `<p class="mt-2">`)
	return SentenceExplanation{
		LSentenceIdx: eId.LSentenceIdx,
		RSentenceIdx: eId.RSentenceIdx,
		Content:      response,
	}, nil
}

func GetSentence(ctx context.Context, eId SentenceExplanationId, maybeLSentence string, rSentence string) (SentenceExplanation, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Getting sentence explanation %s", eId.String()))
	defer trace.Stop()

	e, err := loadSentence(eId)
	if err == nil {
		return e, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return SentenceExplanation{}, fmt.Errorf("failed to load sentence explanation from db: %w", err)
	}

	e, err = generateSentence(ctx, eId, maybeLSentence, rSentence)
	if err != nil {
		return SentenceExplanation{}, fmt.Errorf("failed to generate sentence explanation: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return SentenceExplanation{}, err
	}

	err = storeSentence(ctx, eId, e)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return SentenceExplanation{}, ctxErr
		}
		slog.Error(fmt.Sprintf("Failed to store sentence explanation in db: %v", err))
		return e, nil
	}
	if err := ctx.Err(); err != nil {
		return SentenceExplanation{}, err
	}

	// There might be a race condition when 2 requests try to store the same explanation
	// at the same time. If the explanation was already stored by another request, load it.
	e, err = loadSentence(eId)
	if err != nil {
		return SentenceExplanation{}, fmt.Errorf("failed to load sentence explanation from db: %w", err)
	}

	return e, nil
}

// --- Word Explanation ---

// WordExplanation is the result of clicking a word: the human-readable
// explanation shown in the popup (Content) plus the id of the global dictionary
// sense the word was resolved to (DictionaryEntryId). The id is invalid/NULL
// when the word was not ingested into the dictionary (e.g. the ingest step
// failed); the frontend only shows the Save button when it is set.
type WordExplanation struct {
	Content           string
	DictionaryEntryId sql.NullInt64
}

type WordExplanationId struct {
	StoryId      story.Id
	L            story.Locale
	LSentenceIdx int
	R            story.Locale
	RSentenceIdx int
	WordIdx      int
}

func (wId WordExplanationId) String() string {
	return fmt.Sprintf("%s_%s_%d_%s_%d_w%d", wId.StoryId, wId.L, wId.LSentenceIdx, wId.R, wId.RSentenceIdx, wId.WordIdx)
}

// ExtractWord splits sentenceText by whitespace, skips empty tokens,
// and returns the non-empty token at wordIdx with leading/trailing
// punctuation stripped. This logic must match the frontend tokenization exactly.
//
// Any {m}/{f}/{n} gender markers are stripped before tokenization. Markers
// carry no whitespace so they don't change token indices, but they would
// otherwise leak into the extracted word (e.g. "Haus{n" after a partial
// punctuation trim) and confuse downstream prompts.
func ExtractWord(sentenceText string, wordIdx int) (string, error) {
	tokens := strings.Fields(gender.Strip(sentenceText))
	if wordIdx < 0 || wordIdx >= len(tokens) {
		return "", fmt.Errorf("word_idx %d out of range (sentence has %d words)", wordIdx, len(tokens))
	}
	token := tokens[wordIdx]
	word := strings.TrimFunc(token, unicode.IsPunct)
	if word == "" {
		return token, nil
	}
	return word, nil
}

func wordLlmRole(l, r string) string {
	const bt = "`"
	return fmt.Sprintf(
		`You are a concise %s language teacher for %s speakers. You explain individual words in context. Always respond in %s.

Give a brief explanation: translation and part of speech. Add grammar notes only when they clarify this specific word in this specific sentence, such as a noun's gender/case, a verb form, or an idiomatic usage. Do not add generic "not applicable" grammar disclaimers, for example do not say that an interjection/adverb/particle has no gender, case, or normal forms.

Always put every referenced word, phrase, dictionary form, inflected form, and sentence excerpt or its translation in quotation marks. This includes text copied from the story sentence, translations, articles attached to nouns, and full sentence examples. For example, write `+bt+`"Haus"`+bt+`, `+bt+`"das Haus"`+bt+`, `+bt+`"Das Haus ist alt."`+bt+`, and `+bt+` - "Дом"`+bt+`, not `+bt+`Haus`+bt+`, `+bt+`das Haus`+bt+`, `+bt+`Das Haus ist alt`+bt+`, or `+bt+`- Дом`+bt+`.

Use straight ASCII double quotes (`+bt+`"..."`+bt+`) only. If an excerpt from the story already starts and ends with quotation marks of any style (typographic German `+bt+`„..."`+bt+`, French `+bt+`«...»`+bt+`, single `+bt+`'...'`+bt+`, etc.), strip those outer quotes when you reference the excerpt and wrap it in straight quotes once. Never produce nested quotes like `+bt+`"„Kaffee""`+bt+` or `+bt+`""text""`+bt+` - there must be exactly one pair of straight quotes around each referenced item.

Keep it to 1-3 short sentences. Do NOT use HTML formatting, respond in plain text only.`,
		LANGUAGES_EN[r],
		LANGUAGES_EN[l],
		LANGUAGES_EN[l],
	)
}

func wordLlmQueryContent(l, r, word, rSentence, maybeLSentence string) string {
	maybeLSentence = strings.TrimSpace(maybeLSentence)

	if l == "en" {
		if maybeLSentence == "" {
			return fmt.Sprintf(`Explain the word "%s" in the following %s sentence:
"%s"`, word, LANGUAGES_EN[r], rSentence)
		}

		return fmt.Sprintf(`Explain the word "%s" in the following %s sentence:
"%s"
Translation: "%s"`, word, LANGUAGES_EN[r], rSentence, maybeLSentence)
	}

	if l == "ru" {
		if maybeLSentence == "" {
			return fmt.Sprintf(`Объясни слово "%s" в следующем предложении на %s языке:
"%s"`, word, LANGUAGES_RU[r], rSentence)
		}

		return fmt.Sprintf(`Объясни слово "%s" в следующем предложении на %s языке:
"%s"
Перевод: "%s"`, word, LANGUAGES_RU[r], rSentence, maybeLSentence)
	}

	if l == "de" {
		if maybeLSentence == "" {
			return fmt.Sprintf(`Erkläre das Wort "%s" im folgenden %s Satz:
"%s"`, word, LANGUAGES_DE[r], rSentence)
		}

		return fmt.Sprintf(`Erkläre das Wort "%s" im folgenden %s Satz:
"%s"
Übersetzung: "%s"`, word, LANGUAGES_DE[r], rSentence, maybeLSentence)
	}

	panic(fmt.Sprintf("Unknown language %s", l))
}

func storeWord(ctx context.Context, wId WordExplanationId, e WordExplanation) error {
	_, err := wordStoreStmt.ExecContext(ctx, wId.StoryId, wId.L, wId.R, wId.LSentenceIdx, wId.RSentenceIdx, wId.WordIdx, e.Content, e.DictionaryEntryId)
	if err != nil {
		return fmt.Errorf("failed to store word explanation in db: %w", err)
	}
	return nil
}

func loadWord(wId WordExplanationId) (WordExplanation, error) {
	var content string
	var dictionaryEntryId sql.NullInt64
	err := wordLoadStmt.QueryRow(wId.StoryId, wId.L, wId.LSentenceIdx, wId.R, wId.RSentenceIdx, wId.WordIdx).Scan(&content, &dictionaryEntryId)
	if err != nil {
		return WordExplanation{}, fmt.Errorf("failed to load word explanation from db: %w", err)
	}
	return WordExplanation{Content: content, DictionaryEntryId: dictionaryEntryId}, nil
}

func explainWord(ctx context.Context, l, r, word, maybeLSentence, rSentence string) (string, error) {
	response, err := llm.Invoke(
		ctx,
		wordLlmRole(l, r), wordLlmQueryContent(l, r, word, rSentence, maybeLSentence), llm.Gpt)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(response), nil
}

// generateWord runs the word task graph: the human-readable explanation
// (explainWord) and the dictionary ingest (analyze + dedupe + save, in the
// dictionary package) run in parallel, and we join on both before returning.
//
// The explanation is the user-facing product: if it fails, the whole thing
// fails. The dictionary ingest is a side benefit; if it fails we log loudly and
// return the explanation with a NULL dictionary entry id (the word simply won't
// be Save-able), rather than denying the user their explanation.
func generateWord(ctx context.Context, wId WordExplanationId, word, maybeLSentence, rSentence string) (WordExplanation, error) {
	var (
		wg         sync.WaitGroup
		content    string
		explainErr error
		entryId    int64
		ingestErr  error
	)

	wg.Add(2)
	go func() {
		defer wg.Done()
		content, explainErr = explainWord(ctx, wId.L, wId.R, word, maybeLSentence, rSentence)
	}()
	go func() {
		defer wg.Done()
		entryId, ingestErr = dictionary.Ingest(ctx, wId.R, word, rSentence)
	}()
	wg.Wait()

	if explainErr != nil {
		return WordExplanation{}, explainErr
	}

	result := WordExplanation{Content: content}
	if ingestErr != nil {
		// Don't fail the explanation over a dictionary bookkeeping error. A
		// cancelled request is expected and not worth an error log.
		if ctx.Err() == nil {
			slog.Error(fmt.Sprintf("Failed to ingest word %q into dictionary: %v", word, ingestErr))
		}
	} else {
		result.DictionaryEntryId = sql.NullInt64{Int64: entryId, Valid: true}
	}
	return result, nil
}

func GetWord(ctx context.Context, wId WordExplanationId, maybeLSentence string, rSentence string) (WordExplanation, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Getting word explanation %s", wId.String()))
	defer trace.Stop()

	e, err := loadWord(wId)
	if err == nil {
		return e, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return WordExplanation{}, fmt.Errorf("failed to load word explanation from db: %w", err)
	}

	word, err := ExtractWord(rSentence, wId.WordIdx)
	if err != nil {
		return WordExplanation{}, fmt.Errorf("failed to extract word: %w", err)
	}

	e, err = generateWord(ctx, wId, word, maybeLSentence, rSentence)
	if err != nil {
		return WordExplanation{}, fmt.Errorf("failed to generate word explanation: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return WordExplanation{}, err
	}

	err = storeWord(ctx, wId, e)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return WordExplanation{}, ctxErr
		}
		slog.Error(fmt.Sprintf("Failed to store word explanation in db: %v", err))
		return e, nil
	}
	if err := ctx.Err(); err != nil {
		return WordExplanation{}, err
	}

	e, err = loadWord(wId)
	if err != nil {
		return WordExplanation{}, fmt.Errorf("failed to load word explanation from db: %w", err)
	}

	return e, nil
}

func Test() {
	println("Testing SentenceExplanation")
	eId := SentenceExplanationId{
		StoryId:      "test-story",
		L:            "en",
		LSentenceIdx: 1,
		R:            "ru",
		RSentenceIdx: 2,
	}
	_, err := GetSentence(context.Background(), eId, "This is an English sentence.", "Это английское предложение.")
	if err != nil {
		panic(err)
	}
	expl, err := GetSentence(context.Background(), eId, "This is an English sentence.", "Это английское предложение.")
	if err != nil {
		panic(err)
	}
	fmt.Println("SentenceExplanation:", expl)
	println("SentenceExplanation test passed")
}
