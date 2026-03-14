package story

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Example: "(1)", "(1, 22)"
var TOKEN_GROUPS_REGEX = regexp.MustCompile(`\(\d+(,\d+)*\)`)

var LEVELS = []string{
	"A1", "A1-A2",
	"A2", "A2-B1",
	"B1", "B1-B2",
	"B2", "B2-C1",
	"C1",
}

type Id = string
type Level = string
type Locale = string

type StoryDescriptor struct {
	Id      Id       `json:"id"`
	Level   Level    `json:"level"`
	Locales []Locale `json:"locales"`
	Titles  []string `json:"titles"` // Titles in the order of locales
}

type Token struct {
	Text     string `json:"text"`
	GroupIds []int  `json:"group_ids,omitempty"`
}

func (t Token) ToStr() string {
	if len(t.GroupIds) == 0 {
		return t.Text
	}
	parts := []string{}
	for _, id := range t.GroupIds {
		parts = append(parts, strconv.Itoa(id))
	}
	return fmt.Sprintf("%s(%s)", t.Text, strings.Join(parts, ","))
}

type Segment struct {
	// Either Tokens or Text will be set
	Tokens []Token `json:"tokens,omitempty"`
	Text   string  `json:"text,omitempty"`
	Index  int     `json:"index"`
}

func (s Segment) ToStr() string {
	parts := []string{}
	for _, token := range s.Tokens {
		parts = append(parts, token.ToStr())
	}
	return strings.Join(parts, " ")
}

func (s Segment) ToStrNoGroups() string {
	if len(s.Text) > 0 {
		return s.Text
	}

	parts := []string{}
	for _, token := range s.Tokens {
		parts = append(parts, token.Text)
	}
	return strings.Join(parts, " ")
}

type Sentence struct {
	Segments []Segment `json:"segments"`
	Index    int       `json:"index"`
}

func (sen Sentence) ToPlainStr() string {
	parts := []string{}
	for _, seg := range sen.Segments {
		parts = append(parts, seg.ToStrNoGroups())
	}
	return strings.Join(parts, " ")
}

type Scene struct {
	Sentences    []Sentence `json:"sentences"`
	MaybeImageId string     `json:"image_id,omitempty"`
}

type Paragraph struct {
	Scenes       []Scene `json:"scenes"`
	MaybeImageId string  `json:"image_id,omitempty"`
}

type Chapter struct {
	MaybeTitle string      `json:"title,omitempty"`
	Paragraphs []Paragraph `json:"paragraphs"`
}

type Story struct {
	Title        string    `json:"title"`
	Chapters     []Chapter `json:"chapters"`
	MaybeImageId string    `json:"image_id,omitempty"`
}

func (s Story) ToPlainStr() string {
	parts := []string{}
	if s.Title != "" {
		parts = append(parts, s.Title)
	}
	for _, chapter := range s.Chapters {
		if chapter.MaybeTitle != "" {
			parts = append(parts, chapter.MaybeTitle)
		}
		for _, paragraph := range chapter.Paragraphs {
			for _, scene := range paragraph.Scenes {
				for _, sentence := range scene.Sentences {
					parts = append(parts, sentence.ToPlainStr())
				}
			}
			parts = append(parts, "")
		}
	}
	return strings.Join(parts, "\n")
}

type StoryMultilingual struct {
	Id            Id               `json:"id"`
	Level         Level            `json:"level"`
	Localizations map[Locale]Story `json:"localizations"`
}

func hasTokenWithNonZeroGroup(tokens []Token) bool {
	for _, token := range tokens {
		if len(token.GroupIds) > 0 {
			return true
		}
	}
	return false
}

func ParseSentence(line string) Sentence {
	line = strings.ReplaceAll(line, "@", "\n")
	var segments []Segment
	for _, segStr := range strings.Split(line, "||") {
		segStr = strings.TrimRight(segStr, " ")
		var tokens []Token
		for _, tokStr := range strings.Split(segStr, " ") {
			if tokStr == "" {
				continue
			}
			match := TOKEN_GROUPS_REGEX.FindString(tokStr)
			var groupIds []int
			if match != "" {
				groupsRaw := strings.Trim(match, "()")
				for _, g := range strings.Split(groupsRaw, ",") {
					g = strings.TrimSpace(g)
					if g != "" && g != "0" {
						idVal, err := strconv.Atoi(g)
						if err != nil {
							panic(fmt.Sprintf("error parsing group id: %v", err))
						}
						groupIds = append(groupIds, idVal)
					}
				}
			}
			text := TOKEN_GROUPS_REGEX.ReplaceAllString(tokStr, "")
			tokens = append(tokens, Token{
				Text:     text,
				GroupIds: groupIds,
			})
		}
		if hasTokenWithNonZeroGroup(tokens) {
			segments = append(segments, Segment{Tokens: tokens})
		} else {
			segments = append(segments, Segment{Text: segStr})
		}
	}
	return Sentence{Segments: segments}
}

func CalculateSentenceAndSegmentIndices(story *StoryMultilingual) {
	for locale, localization := range story.Localizations {
		sentenceIdx := 0
		segmentIdx := 0
		for chapterIdx := range localization.Chapters {
			chapter := &localization.Chapters[chapterIdx]
			for pIdx := range chapter.Paragraphs {
				paragraph := &chapter.Paragraphs[pIdx]
				for sIdx := range paragraph.Scenes {
					scene := &paragraph.Scenes[sIdx]
					for senIdx := range scene.Sentences {
						sentence := &scene.Sentences[senIdx]
						sentence.Index = sentenceIdx
						sentenceIdx++
						for segIdx := range sentence.Segments {
							sentence.Segments[segIdx].Index = segmentIdx
							segmentIdx++
						}
					}
				}
			}
		}
		story.Localizations[locale] = localization
	}
}

func contains(slice []string, val string) bool {
	for _, v := range slice {
		if v == val {
			return true
		}
	}
	return false
}

func extractStringArray(params map[string]interface{}, key string) ([]string, error) {
	val, exists := params[key]
	if !exists {
		return nil, errors.New("key not found in map")
	}

	// Assert the value as []interface{}
	interfaceArray, ok := val.([]interface{})
	if !ok {
		return nil, errors.New("value is not an array")
	}

	// Convert []interface{} to []string
	stringArray := make([]string, len(interfaceArray))
	for i, v := range interfaceArray {
		str, ok := v.(string)
		if !ok {
			return nil, errors.New("array contains a non-string value")
		}
		stringArray[i] = str
	}

	return stringArray, nil
}

func extractOptionalStringArray(params map[string]interface{}, key string) ([]string, error) {
	_, exists := params[key]
	if !exists {
		return nil, nil
	}
	return extractStringArray(params, key)
}

func extractOptionalString(params map[string]interface{}, key string) (string, error) {
	val, exists := params[key]
	if !exists {
		return "", nil
	}
	str, ok := val.(string)
	if !ok {
		return "", errors.New("value is not a string")
	}
	return str, nil
}

func Parse(lines []string) StoryMultilingual {
	var storyId *Id
	var level *Level
	var locales []Locale
	currentLocaleIdx := 0
	currentLineIdx := 0
	currentLine := ""

	var stories []Story

	nextStoryLocaleIdx := func() int {
		currentLocaleIdx = (currentLocaleIdx + 1) % len(locales)
		return currentLocaleIdx
	}

	panicAtLine := func(msg string) {
		panic(fmt.Sprintf("%s at line %d: %s", msg, currentLineIdx, currentLine))
	}

	startStories := func(titles []string, maybeImageId string) {
		if len(titles) != len(locales) {
			panicAtLine("titles length mismatch with locales")
		}
		for _, title := range titles {
			stories = append(stories, Story{
				Title:        title,
				Chapters:     []Chapter{},
				MaybeImageId: maybeImageId,
			})
		}
	}

	ensureChapters := func() {
		for storyIdx := range stories {
			if len(stories[storyIdx].Chapters) == 0 {
				stories[storyIdx].Chapters = append(stories[storyIdx].Chapters, Chapter{Paragraphs: []Paragraph{}})
			}
		}
	}

	startChapter := func(titles []string) {
		if len(titles) != len(stories) {
			panicAtLine("chapter titles length mismatch")
		}
		for i, title := range titles {
			stories[i].Chapters = append(stories[i].Chapters, Chapter{
				MaybeTitle: title,
				Paragraphs: []Paragraph{},
			})
		}
	}

	ensureParagraphs := func() {
		ensureChapters()
		for storyIdx := range stories {
			chapter := &stories[storyIdx].Chapters[len(stories[storyIdx].Chapters)-1]
			if len(chapter.Paragraphs) == 0 {
				chapter.Paragraphs = append(chapter.Paragraphs, Paragraph{Scenes: []Scene{}})
			}
		}
	}

	startParagraph := func(maybeImageId string) {
		ensureChapters()
		for storyIdx := range stories {
			chapter := &stories[storyIdx].Chapters[len(stories[storyIdx].Chapters)-1]
			chapter.Paragraphs = append(chapter.Paragraphs, Paragraph{Scenes: []Scene{}, MaybeImageId: maybeImageId})
		}
	}

	ensureScenes := func() {
		ensureParagraphs()
		for storyIdx := range stories {
			chapter := &stories[storyIdx].Chapters[len(stories[storyIdx].Chapters)-1]
			p := &chapter.Paragraphs[len(chapter.Paragraphs)-1]
			if len(p.Scenes) == 0 {
				p.Scenes = append(p.Scenes, Scene{Sentences: []Sentence{}})
			}
		}
	}

	startScene := func(maybeImageId string) {
		ensureParagraphs()
		for storyIdx := range stories {
			chapter := &stories[storyIdx].Chapters[len(stories[storyIdx].Chapters)-1]
			p := &chapter.Paragraphs[len(chapter.Paragraphs)-1]
			p.Scenes = append(p.Scenes, Scene{Sentences: []Sentence{}, MaybeImageId: maybeImageId})
		}
	}

	var lastTag string
	for currentLineIdx, currentLine = range lines {
		line := strings.TrimSpace(currentLine)
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}

		if storyId == nil {
			parts := strings.SplitN(line, " ", 2)
			if len(parts) < 2 {
				panicAtLine("Invalid first line, expected 'STORY_ID LEVEL'")
			}
			sid, lvl := parts[0], parts[1]
			if !contains(LEVELS, lvl) {
				panicAtLine("Invalid language proficiency level")
			}
			storyId = &sid
			level = &lvl
			continue
		}

		if len(locales) == 0 {
			locales = strings.Split(line, ",")
			for i := range locales {
				locales[i] = strings.TrimSpace(locales[i])
			}
			continue
		}

		var tag string
		if strings.HasPrefix(line, "/") {
			tag = strings.Split(line, " ")[0]
		}

		if tag != lastTag && currentLocaleIdx != 0 {
			panicAtLine("locale index not reset when tag changed")
		}
		lastTag = tag

		value := strings.TrimSpace(line[len(tag):])
		params := map[string]interface{}{}
		if tag != "" && value != "" {
			err := json.Unmarshal([]byte(value), &params)
			if err != nil {
				panicAtLine(fmt.Sprintf("error parsing json params: %v", err))
			}
		}

		imageId, err := extractOptionalString(params, "image_id")
		if err != nil {
			panicAtLine(fmt.Sprintf("error parsing 'image_id': %v", err))
		}

		titles, err := extractOptionalStringArray(params, "titles")
		if err != nil {
			panicAtLine(fmt.Sprintf("error parsing 'titles': %v", err))
		}

		switch tag {
		case "/t":
			if titles == nil {
				panicAtLine("Missing titles")
			}
			startStories(titles, imageId)
		case "/s":
			startScene(imageId)
		case "/p":
			startParagraph(imageId)
		case "/c":
			if titles == nil {
				titles = make([]string, len(locales))
			}
			startChapter(titles)
		case "":
			// a sentence line
			ensureScenes()
			sen := ParseSentence(value)
			currentChapter := &stories[currentLocaleIdx].Chapters[len(stories[currentLocaleIdx].Chapters)-1]
			currentParagraph := &currentChapter.Paragraphs[len(currentChapter.Paragraphs)-1]
			currentScene := &currentParagraph.Scenes[len(currentParagraph.Scenes)-1]
			currentScene.Sentences = append(currentScene.Sentences, sen)
			nextStoryLocaleIdx()
		default:
			panicAtLine(fmt.Sprintf("Unknown tag: %s", tag))
		}
	}

	if currentLocaleIdx != 0 {
		panic("final locale index not zero")
	}
	if storyId == nil || level == nil {
		panic("story_id or level not defined")
	}

	locMap := make(map[string]Story)
	for i, loc := range locales {
		locMap[loc] = stories[i]
	}
	story := StoryMultilingual{
		Id:            *storyId,
		Level:         *level,
		Localizations: locMap,
	}
	CalculateSentenceAndSegmentIndices(&story)
	return story
}

func Test() {
	data := `
beneath-peeling-paint-c1 B2-C1
en, de, ru
/t { "titles": ["Beneath", "Unter", "Под"], "image_id": "4" } 
/c { "titles": ["Chapter I", "Kapitel I", "Глава I"] }
/s 
The phone rang(1) || slicing through.
Das schrille Klingeln(1) || durchbrach.
Зазвонил(2) телефон || нарушил.

It was Beatrice.
Es war Beatrice.
Это была Беатрис.

/s
News traveled fast in that small community.
Nachrichten verbreiteten sich schnell in dieser kleinen Gemeinde.
В этой маленькой общине новости распространялись быстро.

/p
/s
The words echoed inside her.
Die Worte hallten in ihr wider.
Слова эхом отозвались в ее душе́.

It wasn't just about the building.
Es ging nicht nur um das Gebäude.
Дело было не просто в здании.

/s
She realized with a pang.
Mit einem Stich im Herzen.
С болью она поняла, что.

/s
Driven by a mix of longing.
Angetrieben von einer Mischung aus Sehnsucht.
Движимая смесью тоски и странного чувства долга.

/c { "titles": ["Chapter II", "Kapitel II", "Глава II"] }
The paint.
Weiße Farbe.
Краска.

Weeds sprouted brazenly.
Unkraut spross dreist.
Сквозь трещины в тротуаре.

Yet, it was the silence that was most striking.
Doch am auffälligsten war die Stille.
Но больше всего поражала тишина.

/p { "image_id": "18" }
Inside, she didn't need to see.
Drinnen musste sie sich nicht auf ihre Augen verlassen.
Внутри ей не нужно было полагаться на зрение.

/s
She closed her eyes, seeing herself.
Sie schloss die Augen und sah sich selbst.
Она закрыла глаза, видя себя.

/p { "image_id": "8" }
Finally, she stood at the threshold.
Schließlich stand sie an der Schwelle.
Наконец, она остановилась у порога.
`
	lines := strings.Split(string(data), "\n")
	parsed := Parse(lines)
	out, err := json.MarshalIndent(parsed, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
}
