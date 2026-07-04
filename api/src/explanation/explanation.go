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
	// CEFR level the explanation is tuned for; fixed because explanations are
	// stored in the db per sentence, not per user level.
	const level = "C1"
	// The role prompt is the shared static prefix across all sentences of a
	// language pair, so the cache key groups requests by (l, r, level).
	response, err := llm.Invoke(
		ctx,
		sentenceLlmRole(eId.L, eId.R, level),
		sentenceLlmQueryContent(eId.L, maybeLSentence, eId.R, rSentence),
		llm.Gpt,
		fmt.Sprintf("sentence-explanation-%s-%s-%s", eId.L, eId.R, level))
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

// wordLlmRole is static for a given (l, r) pair. Together with the story text
// at the top of wordLlmQueryContent it forms the stable prompt prefix that
// lets OpenAI's prompt cache apply across word clicks within the same story -
// don't interpolate any per-word data here.
func wordLlmRole(l, r string) string {
	const bt = "`"
	return fmt.Sprintf(
		`You are a concise %s language teacher for %s speakers. You explain individual words in context. Always respond in %s.

The user input starts with the full text of the story the sentence comes from. Use it only as context to disambiguate the word's meaning, register, and references; explain only the requested word in its sentence, never summarize or comment on the story itself.

Give a brief explanation: the translation, plus grammar notes only when they clarify this specific word in this specific sentence, such as a noun's gender/case, a verb form, or an idiomatic usage. Be grammatically precise: name an inflected form fully and exactly once (e.g. "3rd person singular present"), never vaguely if it is contains any ambiguity ("a present-tense form"). Do not name the part of speech ("is a noun", "is a verb") as a standalone fact if it's obvious from the translation. Mention the part of speech only when it resolves a real ambiguity in this sentence.

State each fact exactly once - never restate the same grammar point in different words. If it helps to understand translation and/or grammar, then quote some minimal fragment of the sentence a point needs (a few words) with translation.

Example: for the word "Fenster" in the sentence fragment "aus dem Fenster", a good explanation for a English speaker learning German is: `+bt+`"Fenster" means "window". Here it is dative singular ("dem Fenster") because the preposition "aus" takes the dative; "aus dem Fenster" means "out of the window".`+bt+`

Counterexample: for the word "schließt" in the sentence "In diesem Winter schließt das Kino", do NOT write `+bt+`"Schließt" means "closes". It is the present-tense form of "schließen"; in "In diesem Winter schließt das Kino", German uses present tense to narrate the event, translated naturally as "closes" or "will close".`+bt+` - it quotes the whole sentence, states the tense twice, and never names the exact form. Write instead: `+bt+`"Schließt" means "closes" - 3rd person singular present of "schließen": "schließt das Kino" - "the cinema closes".`+bt+`

Counterexample: `+bt+`"Meine" means "my" in "Meine Frau" - "my wife". It has the feminine nominative singular ending "-e" because "Frau" is feminine and is the subject of "hat ... geliebt".`+bt+` - it's repeated twice that "Frau" is feminine and the part about subject doesn't add much value for a nominative word (unlike accusative, dative, or genitive). A better example: `+bt+`"Meine" means "my" in "Meine Frau" - "my wife". It has the feminine nominative singular ending "-e".`+bt+`

The rule of thumb: every output word must count.

Always put every referenced word, phrase, dictionary form, inflected form, and sentence excerpt or its translation in quotation marks. This includes text copied from the story sentence, translations, articles attached to nouns, and full sentence examples. For example, write `+bt+`"Haus"`+bt+`, `+bt+`"das Haus"`+bt+`, `+bt+`"Das Haus ist alt."`+bt+`, and `+bt+` - "Дом"`+bt+`, not `+bt+`Haus`+bt+`, `+bt+`das Haus`+bt+`, `+bt+`Das Haus ist alt`+bt+`, or `+bt+`- Дом`+bt+`.

Use straight ASCII double quotes (`+bt+`"..."`+bt+`) only. If an excerpt from the story already starts and ends with quotation marks of any style (typographic German `+bt+`„..."`+bt+`, French `+bt+`«...»`+bt+`, single `+bt+`'...'`+bt+`, etc.), strip those outer quotes when you reference the excerpt and wrap it in straight quotes once. Never produce nested quotes like `+bt+`"„Kaffee""`+bt+` or `+bt+`""text""`+bt+` - there must be exactly one pair of straight quotes around each referenced item.

Keep it to 1-2 short sentences. Do NOT use HTML formatting, respond in plain text only.`,
		LANGUAGES_EN[r],
		LANGUAGES_EN[l],
		LANGUAGES_EN[l],
	)
}

// wordLlmQueryContent builds the user message. The story text deliberately
// comes FIRST and the per-click parts (word, sentence, translation) LAST:
// OpenAI's prompt cache matches the exact token prefix, so every word click
// within the same story shares the "system role + story text" prefix and only
// pays full input price for the short variable tail.
func wordLlmQueryContent(l, r, storyText, word, rSentence, maybeLSentence string) string {
	maybeLSentence = strings.TrimSpace(maybeLSentence)

	if l == "en" {
		if maybeLSentence == "" {
			return fmt.Sprintf(`Full text of the story for context:
"""
%s
"""

Explain the word "%s" in the following %s sentence:
"%s"`, storyText, word, LANGUAGES_EN[r], rSentence)
		}

		return fmt.Sprintf(`Full text of the story for context:
"""
%s
"""

Explain the word "%s" in the following %s sentence:
"%s"
Translation: "%s"`, storyText, word, LANGUAGES_EN[r], rSentence, maybeLSentence)
	}

	if l == "ru" {
		if maybeLSentence == "" {
			return fmt.Sprintf(`Полный текст истории для контекста:
"""
%s
"""

Объясни слово "%s" в следующем предложении на %s языке:
"%s"`, storyText, word, LANGUAGES_RU[r], rSentence)
		}

		return fmt.Sprintf(`Полный текст истории для контекста:
"""
%s
"""

Объясни слово "%s" в следующем предложении на %s языке:
"%s"
Перевод: "%s"`, storyText, word, LANGUAGES_RU[r], rSentence, maybeLSentence)
	}

	if l == "de" {
		if maybeLSentence == "" {
			return fmt.Sprintf(`Der vollständige Text der Geschichte als Kontext:
"""
%s
"""

Erkläre das Wort "%s" im folgenden %s Satz:
"%s"`, storyText, word, LANGUAGES_DE[r], rSentence)
		}

		return fmt.Sprintf(`Der vollständige Text der Geschichte als Kontext:
"""
%s
"""

Erkläre das Wort "%s" im folgenden %s Satz:
"%s"
Übersetzung: "%s"`, storyText, word, LANGUAGES_DE[r], rSentence, maybeLSentence)
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

func explainWord(ctx context.Context, wId WordExplanationId, word, storyText, maybeLSentence, rSentence string) (string, error) {
	// The shared prompt prefix is "role + story text", so the cache key groups
	// requests by (l, r, story): word clicks within the same story route to
	// the same cache shard and reuse the cached story prefix.
	response, err := llm.Invoke(
		ctx,
		wordLlmRole(wId.L, wId.R),
		wordLlmQueryContent(wId.L, wId.R, storyText, word, rSentence, maybeLSentence),
		llm.Gpt,
		fmt.Sprintf("word-explanation-%s-%s-%s", wId.L, wId.R, wId.StoryId))
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
func generateWord(ctx context.Context, wId WordExplanationId, word, storyText, maybeLSentence, rSentence string) (WordExplanation, error) {
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
		content, explainErr = explainWord(ctx, wId, word, storyText, maybeLSentence, rSentence)
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

// GetWord returns the explanation for a word click, generating and persisting
// it on first request. storyText is the full story text in the learned
// language (r); it is fed to the LLM as context and must be identical across
// calls for the same story so the provider prompt cache can reuse the prefix.
func GetWord(ctx context.Context, wId WordExplanationId, storyText string, maybeLSentence string, rSentence string) (WordExplanation, error) {
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

	e, err = generateWord(ctx, wId, word, storyText, maybeLSentence, rSentence)
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
