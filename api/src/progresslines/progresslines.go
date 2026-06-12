// Package progresslines serves the playful status lines shown in the
// frontend's story-generation progress overlay. The lines are hardcoded per
// UI locale: some are generic (fit any story), others are mood-specific and
// only enter the pool when the user picked that mood for the story.
package progresslines

import (
	"fmt"
	"log/slog"
	"math/rand/v2"
)

// Count is how many lines one request returns. At the frontend's ~5s
// rotation this covers about a minute of generation before lines repeat.
const Count = 12

var genericByLocale = map[string][]string{
	"en": {
		"Sharpening the pencils",
		"Convincing the protagonist to cooperate",
		"Teaching the verbs to behave",
		"Herding adjectives into place",
		"Brewing fresh metaphors",
		"Counting the commas, twice",
		"Letting the plot thicken",
		"Negotiating with the grammar",
		"Dusting off the dictionary",
		"Asking the muse politely",
		"Untangling the word order",
		"Spilling a little ink for atmosphere",
		"Borrowing a cup of vowels from the neighbors",
	},
	"de": {
		"Die Bleistifte werden gespitzt",
		"Die Hauptfigur wird zur Mitarbeit überredet",
		"Den Verben werden Manieren beigebracht",
		"Die Adjektive werden in Position gebracht",
		"Frische Metaphern werden aufgebrüht",
		"Die Kommas werden gezählt, zweimal",
		"Die Handlung darf sich verdichten",
		"Mit der Grammatik wird verhandelt",
		"Das Wörterbuch wird entstaubt",
		"Die Muse wird höflich gebeten",
		"Die Wortstellung wird entwirrt",
		"Etwas Tinte wird für die Atmosphäre verschüttet",
		"Beim Nachbarn wird eine Tasse Vokale geborgt",
	},
	"ru": {
		"Точим карандаши",
		"Уговариваем главного героя сотрудничать",
		"Учим глаголы хорошим манерам",
		"Расставляем прилагательные по местам",
		"Завариваем свежие метафоры",
		"Считаем запятые, дважды",
		"Даём сюжету загустеть",
		"Ведём переговоры с грамматикой",
		"Сдуваем пыль со словаря",
		"Вежливо просим музу",
		"Распутываем порядок слов",
		"Проливаем немного чернил для атмосферы",
		"Одалживаем у соседей чашку гласных",
	},
}

// Keys must match the mood ids the frontend sends to /generate
// (web/src/GenerateView.tsx).
var moodByLocale = map[string]map[string][]string{
	"en": {
		"romantic": {
			"Lighting the candles",
			"Adding a meaningful glance",
			"Teaching the hearts to skip a beat",
		},
		"dark": {
			"Dimming the lights",
			"Feeding the ravens",
			"Hiding something in the basement",
		},
		"funny": {
			"Testing the jokes on the office plant",
			"Slipping on a banana peel for research",
			"Tickling the punchlines",
		},
		"silly": {
			"Putting socks on the protagonist's hands",
			"Replacing all hats with teapots",
			"Practicing a solo on the kazoo",
		},
		"scary": {
			"Creaking the floorboards",
			"Checking under the bed",
			"Turning off the lights one by one",
		},
		"hopeful": {
			"Watering a tiny seedling",
			"Opening the curtains wide",
			"Saving a sunrise for the last page",
		},
		"mysterious": {
			"Misplacing an important clue",
			"Whispering in the corridor",
			"Locking a drawer and losing the key",
		},
		"exciting": {
			"Revving the engines",
			"Tightening the cliffhangers",
			"Setting up the chase scene",
		},
		"charming": {
			"Polishing the smiles",
			"Teaching the cat to bow",
			"Arranging fresh flowers on every page",
		},
		"thoughtful": {
			"Staring meaningfully out the window",
			"Pondering, then pondering some more",
			"Underlining a quiet truth",
		},
		"inspiring": {
			"Climbing a metaphorical mountain",
			"Polishing the moral of the story",
			"Charging the motivational batteries",
		},
		"witty": {
			"Sharpening the wordplay",
			"Fencing with double meanings",
			"Rehearsing the comebacks",
		},
	},
	"de": {
		"romantic": {
			"Die Kerzen werden angezündet",
			"Ein bedeutungsvoller Blick wird eingefügt",
			"Den Herzen wird das Höherschlagen beigebracht",
		},
		"dark": {
			"Das Licht wird gedimmt",
			"Die Raben werden gefüttert",
			"Im Keller wird etwas versteckt",
		},
		"funny": {
			"Die Witze werden an der Büropflanze getestet",
			"Zu Forschungszwecken wird auf einer Bananenschale ausgerutscht",
			"Die Pointen werden gekitzelt",
		},
		"silly": {
			"Der Hauptfigur werden Socken über die Hände gezogen",
			"Alle Hüte werden durch Teekannen ersetzt",
			"Ein Kazoo-Solo wird geprobt",
		},
		"scary": {
			"Die Dielen werden zum Knarren gebracht",
			"Unter dem Bett wird nachgesehen",
			"Die Lichter gehen eins nach dem anderen aus",
		},
		"hopeful": {
			"Ein kleiner Setzling wird gegossen",
			"Die Vorhänge werden weit geöffnet",
			"Ein Sonnenaufgang wird für die letzte Seite aufgehoben",
		},
		"mysterious": {
			"Ein wichtiger Hinweis wird verlegt",
			"Im Korridor wird geflüstert",
			"Eine Schublade wird abgeschlossen und der Schlüssel verloren",
		},
		"exciting": {
			"Die Motoren werden warmgefahren",
			"Die Cliffhanger werden festgezurrt",
			"Die Verfolgungsjagd wird vorbereitet",
		},
		"charming": {
			"Das Lächeln wird poliert",
			"Der Katze wird das Verbeugen beigebracht",
			"Auf jeder Seite werden frische Blumen arrangiert",
		},
		"thoughtful": {
			"Es wird bedeutungsvoll aus dem Fenster gestarrt",
			"Es wird nachgedacht, und dann noch etwas mehr",
			"Eine leise Wahrheit wird unterstrichen",
		},
		"inspiring": {
			"Ein metaphorischer Berg wird bestiegen",
			"Die Moral der Geschichte wird poliert",
			"Die Motivationsbatterien werden aufgeladen",
		},
		"witty": {
			"Die Wortspiele werden geschärft",
			"Es wird mit Doppeldeutigkeiten gefochten",
			"Die schlagfertigen Antworten werden geprobt",
		},
	},
	"ru": {
		"romantic": {
			"Зажигаем свечи",
			"Добавляем многозначительный взгляд",
			"Учим сердца биться чаще",
		},
		"dark": {
			"Приглушаем свет",
			"Кормим воронов",
			"Прячем кое-что в подвале",
		},
		"funny": {
			"Проверяем шутки на офисном фикусе",
			"Поскальзываемся на банановой кожуре — для науки",
			"Доводим шутки до кондиции",
		},
		"silly": {
			"Надеваем носки на руки главного героя",
			"Заменяем все шляпы на чайники",
			"Репетируем соло на казу",
		},
		"scary": {
			"Заставляем половицы скрипеть",
			"Проверяем под кроватью",
			"Выключаем свет, лампу за лампой",
		},
		"hopeful": {
			"Поливаем маленький росток",
			"Распахиваем шторы",
			"Бережём рассвет для последней страницы",
		},
		"mysterious": {
			"Теряем важную улику",
			"Шепчемся в коридоре",
			"Запираем ящик и теряем ключ",
		},
		"exciting": {
			"Прогреваем моторы",
			"Затягиваем интригу потуже",
			"Готовим сцену погони",
		},
		"charming": {
			"Полируем улыбки",
			"Учим кота кланяться",
			"Расставляем свежие цветы на каждой странице",
		},
		"thoughtful": {
			"Многозначительно смотрим в окно",
			"Размышляем",
			"Подчёркиваем тихую истину",
		},
		"inspiring": {
			"Взбираемся на метафорическую гору",
			"Полируем мораль истории",
			"Заряжаем батарейки вдохновения",
		},
		"witty": {
			"Оттачиваем игру слов",
			"Фехтуем двусмысленностями",
			"Репетируем остроумные ответы",
		},
	},
}

func shuffledCopy(lines []string) []string {
	copied := make([]string, len(lines))
	copy(copied, lines)
	rand.Shuffle(len(copied), func(i, j int) {
		copied[i], copied[j] = copied[j], copied[i]
	})
	return copied
}

// Choose returns up to Count random lines for the given UI locale, mixing
// mood-specific lines (at most half) with generic ones. Unknown moods are
// silently skipped (the mood list is free-form user input); an unknown locale
// is a programming error on the caller's side and falls back to English.
func Choose(locale string, moods []string) []string {
	generic, ok := genericByLocale[locale]
	if !ok {
		slog.Error(fmt.Sprintf("progresslines: unknown locale %q, falling back to en", locale))
		locale = "en"
		generic = genericByLocale[locale]
	}

	var moodPool []string
	for _, mood := range moods {
		moodPool = append(moodPool, moodByLocale[locale][mood]...)
	}
	moodPool = shuffledCopy(moodPool)
	genericPool := shuffledCopy(generic)

	moodCount := min(len(moodPool), Count/2)
	genericCount := min(len(genericPool), Count-moodCount)

	lines := make([]string, 0, moodCount+genericCount)
	lines = append(lines, moodPool[:moodCount]...)
	lines = append(lines, genericPool[:genericCount]...)
	rand.Shuffle(len(lines), func(i, j int) {
		lines[i], lines[j] = lines[j], lines[i]
	})
	return lines
}
