package explanation

import (
	"database/sql"
	"errors"
	"fmt"
	"lang/api/db"
	"lang/api/llm"
	"lang/api/story"
	"lang/api/telemetry"
	"log/slog"
	"strings"
)

type Explanation struct {
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

func llmRole(l, r, level string) string {
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

func llmQueryContent(l, lSentence, r, rSentence string) string {
	if l == "en" {
		return fmt.Sprintf(`Explain part by part the following translation from %s to English:

"%s"

in %s:

"%s"
`, LANGUAGES_EN[r], rSentence, LANGUAGES_EN[r], lSentence)
	}

	if l == "ru" {
		return fmt.Sprintf(`Объясни по частям следующий перевод с %s на русский язык:

"%s"

%s перевод:

"%s"
`, LANGUAGES_RU[r], rSentence, LANGUAGES_RU[r], lSentence)
	}

	if l == "de" {
		return fmt.Sprintf(`Erkläre in Teilen die folgende Übersetzung von %s ins Deutsch:

"%s"

auf %s:

"%s"
`, LANGUAGES_DE[r], rSentence, LANGUAGES_DE[r], lSentence)
	}

	panic(fmt.Sprintf("Unknown language %s", l))
}

type ExplanationId struct {
	StoryId      story.Id
	L            story.Locale
	LSentenceIdx int
	R            story.Locale
	RSentenceIdx int
}

func (eId ExplanationId) String() string {
	return fmt.Sprintf("%s_%s_%d_%s_%d", eId.StoryId, eId.L, eId.LSentenceIdx, eId.R, eId.RSentenceIdx)
}

var (
	storeStmt *sql.Stmt
	loadStmt  *sql.Stmt
)

func Setup() {
	// cached = loadAll()
	var err error = nil
	storeStmt, err = db.Db.Prepare(
		"INSERT INTO explanation (story_id, l, r, l_sentence_idx, r_sentence_idx, content) " +
			"VALUES (?, ?, ?, ?, ?, ?) " +
			"ON DUPLICATE KEY UPDATE content = content;")
	if err != nil {
		panic(err)
	}
	loadStmt, err = db.Db.Prepare(
		"SELECT content FROM explanation " +
			"WHERE story_id = ? AND l = ? AND l_sentence_idx = ? AND r = ? AND r_sentence_idx = ?")
	if err != nil {
		panic(err)
	}
}

func store(eId ExplanationId, e Explanation) error {
	_, err := storeStmt.Exec(eId.StoryId, eId.L, eId.R, eId.LSentenceIdx, eId.RSentenceIdx, e.Content)
	if err != nil {
		return fmt.Errorf("failed to store explanation in db: %w", err)
	}
	return nil
}

func load(eId ExplanationId) (Explanation, error) {
	var content string
	err := loadStmt.QueryRow(eId.StoryId, eId.L, eId.LSentenceIdx, eId.R, eId.RSentenceIdx).Scan(&content)
	if err != nil {
		return Explanation{}, fmt.Errorf("failed to load explanation from db: %w", err)
	}
	return Explanation{
		LSentenceIdx: eId.LSentenceIdx,
		RSentenceIdx: eId.RSentenceIdx,
		Content:      content,
	}, nil
}

func generate(
	eId ExplanationId, lSentence, rSentence string,
) (Explanation, error) {
	response, err := llm.Invoke(
		llmRole(eId.L, eId.R, "C1"), llmQueryContent(eId.L, lSentence, eId.R, rSentence), llm.Gpt4o)
	if err != nil {
		return Explanation{}, err
	}
	response = strings.ReplaceAll(response, "<p>", `<p class="mt-2">`)
	return Explanation{
		LSentenceIdx: eId.LSentenceIdx,
		RSentenceIdx: eId.RSentenceIdx,
		Content:      response,
	}, nil
}

func Get(eId ExplanationId, lSentence string, rSentence string) (Explanation, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Getting explanation %s", eId.String()))
	defer trace.Stop()

	e, err := load(eId)
	if err == nil {
		return e, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return Explanation{}, fmt.Errorf("failed to load explanation from db: %w", err)
	}

	e, err = generate(eId, lSentence, rSentence)
	if err != nil {
		return Explanation{}, fmt.Errorf("failed to generate explanation: %w", err)
	}

	err = store(eId, e)
	if err != nil {
		slog.Error(fmt.Sprintf("Failed to store explanation in db: %v", err))
		return e, nil
	}

	// There might be a race condition when 2 requests try to store the same explanation
	// at the same time. If the explanation was already stored by another request, load it.
	e, err = load(eId)
	if err != nil {
		return Explanation{}, fmt.Errorf("failed to load explanation from db: %w", err)
	}

	return e, nil
}

func Test() {
	println("Testing Explanation")
	eId := ExplanationId{
		StoryId:      "test-story",
		L:            "en",
		LSentenceIdx: 1,
		R:            "ru",
		RSentenceIdx: 2,
	}
	_, err := Get(eId, "This is an English sentence.", "Это английское предложение.")
	if err != nil {
		panic(err)
	}
	expl, err := Get(eId, "This is an English sentence.", "Это английское предложение.")
	if err != nil {
		panic(err)
	}
	fmt.Println("Explanation:", expl)
	println("Explanation test passed")
}
