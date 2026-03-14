export interface LocalizationStrings {
  loading_story_list: string;
  loading_story_list_error: string;
  loading_generated_story_list_error: string;
  select_story: string;
  loading_story: string;
  loading_story_error: string;
  story_not_found_error: string;
  loading_explain: string;
  loading_explain_error: string;
  settings_title: string;
  settings_i_speak: string;
  settings_i_learn: string;
  close_button_caption: string;
  my_stories_header: string;
  stories_header: string;
  generate_story_button: string;
  show_translation_checkbox: string;
  show_translation_by_sentence_checkbox: string;
  login_button: string;
  signup_button: string;
  logout_button: string;
  levels: Record<string, string>;
  moods: Record<string, string>;
  topics: Record<string, string>;
}

const strings = new Map<string, LocalizationStrings>([
  [
    "en",
    {
      loading_story_list: "Loading story list...",
      loading_story_list_error: "Error loading story list",
      loading_generated_story_list_error: "Error loading generated story list",
      select_story: "Select a story",
      loading_story: "Loading story...",
      loading_story_error: "Error loading story",
      story_not_found_error: "Story not found :(",
      loading_explain: "Loading explanation...",
      loading_explain_error: "Error loading explanation",
      settings_title: "Settings",
      settings_i_speak: "I speak:",
      settings_i_learn: "I learn:",
      close_button_caption: "Close",
      my_stories_header: "My stories",
      stories_header: "Original stories",
      generate_story_button: "Generate new story",
      show_translation_checkbox: "Show translation",
      show_translation_by_sentence_checkbox: "By sentence",
      login_button: "Login",
      signup_button: "Sign up",
      logout_button: "Logout",
      levels: {
        A1: "Beginner",
        B1: "Intermediate",
        C1: "Advanced",
      },
      moods: {
        romantic: "Romantic",
        dark: "Dark",
        funny: "Funny",
        silly: "Silly",
        scary: "Scary",
        hopeful: "Hopeful",
        mysterious: "Mysterious",
        exciting: "Exciting",
        charming: "Charming",
        thoughtful: "Thoughtful",
        inspiring: "Inspiring",
        witty: "Witty",
      },
      topics: {
        office: "Office",
        family: "Family",
        travel: "Travel",
        sports: "Sports",
        technology: "Technology",
        cooking: "Cooking",
        fashion: "Fashion",
        music: "Music",
        science: "Science",
        history: "History",
        nature: "Nature",
        movies: "Movies",
      },
    },
  ],
  [
    "de",
    {
      loading_story_list: "Lade Geschichtenliste...",
      loading_story_list_error: "Fehler beim Laden der Geschichtenliste",
      loading_generated_story_list_error:
        "Fehler beim Laden der Liste der generierten Storys",
      select_story: "Wähle eine Geschichte",
      loading_story: "Lade Geschichte...",
      loading_story_error: "Fehler beim Laden der Geschichte",
      story_not_found_error: "Geschichte nicht gefunden :(",
      loading_explain: "Lade Erklärung...",
      loading_explain_error: "Fehler beim Laden der Erklärung",
      settings_title: "Einstellungen",
      settings_i_speak: "Ich spreche:",
      settings_i_learn: "Ich lerne:",
      close_button_caption: "Schließen",
      my_stories_header: "Meine Geschichten",
      stories_header: "Originalgeschichten",
      generate_story_button: "Neue Geschichte generieren",
      show_translation_checkbox: "Übersetzung anzeigen",
      show_translation_by_sentence_checkbox: "Nach Sätzen",
      login_button: "Einloggen",
      signup_button: "Registrieren",
      logout_button: "Ausloggen",
      levels: {
        A1: "Anfänger",
        B1: "Mittelstufe",
        C1: "Fortgeschritten",
      },
      moods: {
        romantic: "Romantisch",
        dark: "Düster",
        funny: "Lustig",
        silly: "Albern",
        scary: "Gruselig",
        hopeful: "Hoffnungsvoll",
        mysterious: "Geheimnisvoll",
        exciting: "Aufregend",
        charming: "Bezaubernd",
        thoughtful: "Nachdenklich",
        inspiring: "Inspirierend",
        witty: "Witzig",
      },
      topics: {
        office: "Büro",
        family: "Familie",
        travel: "Reisen",
        sports: "Sport",
        technology: "Technologie",
        cooking: "Kochen",
        fashion: "Mode",
        music: "Musik",
        science: "Wissenschaft",
        history: "Geschichte",
        nature: "Natur",
        movies: "Filme",
      },
    },
  ],
  [
    "ru",
    {
      loading_story_list: "Загрузка списка историй...",
      loading_story_list_error: "Ошибка загрузки списка историй",
      loading_generated_story_list_error:
        "Ошибка загрузки списка сгенерированных историй",
      select_story: "Выберите историю",
      loading_story: "Загрузка истории...",
      loading_story_error: "Ошибка загрузки истории",
      story_not_found_error: "История не найдена :(",
      loading_explain: "Загрузка объяснения...",
      loading_explain_error: "Ошибка загрузки объяснения",
      settings_title: "Настройки",
      settings_i_speak: "Я говорю на:",
      settings_i_learn: "Я учу:",
      close_button_caption: "Закрыть",
      my_stories_header: "Мои истории",
      stories_header: "Авторские истории",
      generate_story_button: "Сгенерировать новую историю",
      show_translation_checkbox: "Показать перевод",
      show_translation_by_sentence_checkbox: "По предложениям",
      login_button: "Войти",
      signup_button: "Зарегистрироваться",
      logout_button: "Выйти",
      levels: {
        A1: "Начинающий",
        B1: "Средний",
        C1: "Продвинутый",
      },
      moods: {
        romantic: "Романтическое",
        dark: "Мрачное",
        funny: "Смешное",
        silly: "Глупое",
        scary: "Страшное",
        hopeful: "Обнадеживающее",
        mysterious: "Таинственное",
        exciting: "Захватывающее",
        charming: "Очаровательное",
        thoughtful: "Задумчивое",
        inspiring: "Вдохновляющее",
        witty: "Остроумное",
      },
      topics: {
        office: "Офис",
        family: "Семья",
        travel: "Путешествия",
        sports: "Спорт",
        technology: "Технологии",
        cooking: "Кулинария",
        fashion: "Мода",
        music: "Музыка",
        science: "Наука",
        history: "История",
        nature: "Природа",
        movies: "Кино",
      },
    },
  ],
]);

export function lstr(locale: string): LocalizationStrings {
  const s = strings.get(locale);
  if (!s) {
    console.error("Unknown localization locale", locale);
    return strings.get("en")!;
  }
  return s;
}
