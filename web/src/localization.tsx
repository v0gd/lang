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
  cancel_button: string;
  generate_overlay_message: string;
  scan_overlay_message: string;
  upload_overlay_message: string;
  my_stories_header: string;
  stories_header: string;
  generate_story_button: string;
  scan_button: string;
  scan_no_target_text_error: string;
  scan_error: string;
  upload_button: string;
  upload_title_pre: string;
  upload_title_post: string;
  upload_textarea_placeholder: string;
  upload_textarea_heading: string;
  upload_submit: string;
  upload_in_progress: string;
  upload_login_prompt: string;
  upload_too_long: string;
  upload_error_prompt_injection: string;
  upload_error_disallowed: string;
  upload_error_no_target_text: string;
  upload_error_generic: string;
  show_translation_checkbox: string;
  show_translation_by_sentence_checkbox: string;
  color_noun_genders_checkbox: string;
  color_noun_genders_explanation: string;
  color_noun_genders_masculine: string;
  color_noun_genders_feminine: string;
  color_noun_genders_neuter: string;
  login_button: string;
  signup_button: string;
  logout_button: string;
  settings_theme: string;
  settings_theme_dark: string;
  settings_theme_light: string;
  generate_title_pre: string;
  generate_title_post: string;
  generate_level_heading: string;
  generate_mood_heading: string;
  generate_topic_heading: string;
  generate_topic_optional: string;
  generate_login_prompt: string;
  generate_button: string;
  generate_level_required: string;
  generate_error: string;
  generate_in_progress: string;
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
      cancel_button: "Cancel",
      generate_overlay_message: "Crafting your story",
      scan_overlay_message: "Reading your page",
      upload_overlay_message: "Polishing your text",
      my_stories_header: "My stories",
      stories_header: "Original stories",
      generate_story_button: "Create a new story",
      scan_button: "Scan",
      scan_no_target_text_error:
        "No text in your learned language was found in the image",
      scan_error: "Couldn't process the image — try again",
      upload_button: "Upload text",
      upload_title_pre: "Upload your own",
      upload_title_post: "text.",
      upload_textarea_heading: "PASTE A PASSAGE",
      upload_textarea_placeholder:
        "Paste a passage in the language you're learning — a letter, an article, a few pages of a book...",
      upload_submit: "Upload",
      upload_in_progress: "Processing...",
      upload_login_prompt: "Log in to upload your own text",
      upload_too_long: "Text is too long",
      upload_error_prompt_injection:
        "This text looks like an instruction for the AI, not reading material. Please paste plain text.",
      upload_error_disallowed:
        "This text isn't allowed as learning material. Please try a different passage.",
      upload_error_no_target_text:
        "No text in your learned language was found in the passage",
      upload_error_generic: "Couldn't process the text — try again",
      show_translation_checkbox: "Show translation",
      show_translation_by_sentence_checkbox: "By sentence",
      color_noun_genders_checkbox: "Color nouns by gender",
      color_noun_genders_explanation:
        "Nouns are tinted by grammatical gender so you can pick up the article over time.",
      color_noun_genders_masculine: "masculine",
      color_noun_genders_feminine: "feminine",
      color_noun_genders_neuter: "neuter",
      login_button: "Login",
      signup_button: "Sign up",
      logout_button: "Logout",
      settings_theme: "Theme",
      settings_theme_dark: "Dark",
      settings_theme_light: "Light",
      generate_title_pre: "Create a new",
      generate_title_post: "story.",
      generate_level_heading: "YOUR LEVEL",
      generate_mood_heading: "Mood",
      generate_topic_heading: "Topic",
      generate_topic_optional: "Optional",
      generate_login_prompt: "Log in to generate a new story",
      generate_button: "Create",
      generate_level_required: "Choose a level",
      generate_error: "Error — try again",
      generate_in_progress: "Generating...",
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
      cancel_button: "Abbrechen",
      generate_overlay_message: "Deine Geschichte wird gestaltet",
      scan_overlay_message: "Deine Seite wird gelesen",
      upload_overlay_message: "Dein Text wird aufbereitet",
      my_stories_header: "Meine Geschichten",
      stories_header: "Originalgeschichten",
      generate_story_button: "Neue Geschichte generieren",
      scan_button: "Scannen",
      scan_no_target_text_error:
        "Im Bild wurde kein Text in deiner Lernsprache gefunden",
      scan_error: "Bild konnte nicht verarbeitet werden — bitte erneut versuchen",
      upload_button: "Text einfügen",
      upload_title_pre: "Eigenen",
      upload_title_post: "Text hochladen.",
      upload_textarea_heading: "TEXT EINFÜGEN",
      upload_textarea_placeholder:
        "Füge einen Text in deiner Lernsprache ein — einen Brief, einen Artikel, ein paar Buchseiten...",
      upload_submit: "Hochladen",
      upload_in_progress: "Wird verarbeitet...",
      upload_login_prompt: "Einloggen, um eigenen Text hochzuladen",
      upload_too_long: "Text ist zu lang",
      upload_error_prompt_injection:
        "Dieser Text wirkt wie eine Anweisung an die KI, nicht wie Lesematerial. Bitte füge einfachen Text ein.",
      upload_error_disallowed:
        "Dieser Text ist nicht als Lernmaterial zugelassen. Bitte versuche es mit einem anderen Auszug.",
      upload_error_no_target_text:
        "In diesem Text wurde keine Lernsprache gefunden",
      upload_error_generic:
        "Text konnte nicht verarbeitet werden — bitte erneut versuchen",
      show_translation_checkbox: "Übersetzung anzeigen",
      show_translation_by_sentence_checkbox: "Nach Sätzen",
      color_noun_genders_checkbox: "Substantive nach Geschlecht einfärben",
      color_noun_genders_explanation:
        "Substantive werden nach grammatikalischem Geschlecht eingefärbt, damit du dir den Artikel mit der Zeit merken kannst.",
      color_noun_genders_masculine: "maskulin",
      color_noun_genders_feminine: "feminin",
      color_noun_genders_neuter: "neutrum",
      login_button: "Einloggen",
      signup_button: "Registrieren",
      logout_button: "Ausloggen",
      settings_theme: "Design",
      settings_theme_dark: "Dunkel",
      settings_theme_light: "Hell",
      generate_title_pre: "Neue",
      generate_title_post: "Geschichte erstellen.",
      generate_level_heading: "DEIN NIVEAU",
      generate_mood_heading: "Stimmung",
      generate_topic_heading: "Thema",
      generate_topic_optional: "Optional",
      generate_login_prompt: "Einloggen, um eine Geschichte zu generieren",
      generate_button: "Generieren!",
      generate_level_required: "Niveau wählen",
      generate_error: "Fehler — erneut versuchen",
      generate_in_progress: "Wird generiert...",
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
      cancel_button: "Отмена",
      generate_overlay_message: "Создаём вашу историю",
      scan_overlay_message: "Читаем вашу страницу",
      upload_overlay_message: "Обрабатываем ваш текст",
      my_stories_header: "Мои истории",
      stories_header: "Авторские истории",
      generate_story_button: "Сгенерировать новую историю",
      scan_button: "Сканировать",
      scan_no_target_text_error:
        "На изображении не найден текст на изучаемом языке",
      scan_error: "Не удалось обработать изображение — попробуйте ещё раз",
      upload_button: "Загрузить текст",
      upload_title_pre: "Загрузите свой",
      upload_title_post: "текст.",
      upload_textarea_heading: "ВСТАВЬТЕ ОТРЫВОК",
      upload_textarea_placeholder:
        "Вставьте текст на изучаемом языке — письмо, статью, несколько страниц книги...",
      upload_submit: "Загрузить",
      upload_in_progress: "Обработка...",
      upload_login_prompt: "Войдите, чтобы загрузить свой текст",
      upload_too_long: "Текст слишком длинный",
      upload_error_prompt_injection:
        "Этот текст похож на инструкцию для ИИ, а не на материал для чтения. Вставьте, пожалуйста, обычный текст.",
      upload_error_disallowed:
        "Этот текст нельзя использовать как учебный материал. Попробуйте другой отрывок.",
      upload_error_no_target_text:
        "В тексте не найден фрагмент на изучаемом языке",
      upload_error_generic: "Не удалось обработать текст — попробуйте ещё раз",
      show_translation_checkbox: "Показать перевод",
      show_translation_by_sentence_checkbox: "По предложениям",
      color_noun_genders_checkbox: "Окрашивать существительные по роду",
      color_noun_genders_explanation:
        "Существительные подсвечиваются по грамматическому роду, чтобы со временем запомнить артикль.",
      color_noun_genders_masculine: "мужской",
      color_noun_genders_feminine: "женский",
      color_noun_genders_neuter: "средний",
      login_button: "Войти",
      signup_button: "Зарегистрироваться",
      logout_button: "Выйти",
      settings_theme: "Тема",
      settings_theme_dark: "Тёмная",
      settings_theme_light: "Светлая",
      generate_title_pre: "Создать новую",
      generate_title_post: "историю.",
      generate_level_heading: "ВАШ УРОВЕНЬ",
      generate_mood_heading: "Настроение",
      generate_topic_heading: "Тема",
      generate_topic_optional: "Необязательно",
      generate_login_prompt: "Войдите, чтобы сгенерировать историю",
      generate_button: "Сгенерировать!",
      generate_level_required: "Выберите уровень",
      generate_error: "Ошибка — попробуйте снова",
      generate_in_progress: "Генерация...",
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
