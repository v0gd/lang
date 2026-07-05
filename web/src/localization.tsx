export interface LocalizationStrings {
  loading_story_list: string;
  loading_story_list_error: string;
  loading_generated_story_list_error: string;
  select_story: string;
  loading_story: string;
  loading_story_error: string;
  story_not_found_error: string;
  story_alignment_error: string;
  loading_explain: string;
  loading_explain_error: string;
  listen_button: string;
  listen_stop: string;
  listen_loading: string;
  listen_error: string;
  save_word_button: string;
  saving_word: string;
  word_saved: string;
  save_word_error: string;
  save_word_limit_error: string;
  remove_word_button: string;
  remove_word_error: string;
  my_dictionary_nav: string;
  my_dictionary_header: string;
  my_dictionary_loading: string;
  my_dictionary_error: string;
  my_dictionary_empty: string;
  my_dictionary_meaning_pending: string;
  my_dictionary_examples_heading: string;
  my_dictionary_prev_page: string;
  my_dictionary_next_page: string;
  my_dictionary_page_label: string;
  my_dictionary_delete: string;
  my_dictionary_delete_confirm: string;
  my_dictionary_delete_cancel: string;
  my_dictionary_deleting: string;
  my_dictionary_delete_error: string;
  my_dictionary_login_prompt: string;
  settings_title: string;
  settings_i_speak: string;
  settings_i_learn: string;
  close_button_caption: string;
  cancel_button: string;
  generate_overlay_message: string;
  // Template; {level} is replaced with the CEFR code (A1/B1/C1).
  generate_overlay_headline: string;
  scan_overlay_message: string;
  upload_overlay_message: string;
  my_stories_header: string;
  stories_header: string;
  generate_story_button: string;
  scan_button: string;
  scan_no_target_text_error: string;
  scan_error_disallowed: string;
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
  upload_error_disallowed: string;
  upload_error_no_target_text: string;
  upload_error_generic: string;
  reader_menu_label: string;
  reader_menu_words_section: string;
  translation_menu_title: string;
  translation_unavailable: string;
  translation_mode_hidden: string;
  translation_mode_by_paragraph: string;
  translation_mode_by_sentence: string;
  color_noun_genders_checkbox: string;
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
  delete_story_confirm_title: string;
  delete_story_confirm_message: string;
  delete_story_confirm_button: string;
  delete_story_button_label: string;
  favorite_story_button_label: string;
  unfavorite_story_button_label: string;
  account_menu_label: string;
  login_title_signin: string;
  login_title_signup: string;
  login_subtitle_signin: string;
  login_subtitle_signup: string;
  login_email_label: string;
  login_password_label: string;
  login_submit_signin: string;
  login_submit_signup: string;
  login_or: string;
  login_google_button: string;
  login_toggle_to_signup_question: string;
  login_toggle_to_signin_question: string;
  login_toggle_to_signup: string;
  login_toggle_to_signin: string;
  login_error_invalid_credentials: string;
  login_error_email_in_use: string;
  login_error_weak_password: string;
  login_error_invalid_email: string;
  login_error_too_many_requests: string;
  login_error_generic: string;
  home_hero_title_pre: string;
  home_hero_title_highlight: string;
  home_hero_subtitle: string;
  home_how_read_title: string;
  home_how_read_description: string;
  home_how_tap_title: string;
  home_how_tap_description: string;
  home_how_save_title: string;
  home_how_save_description: string;
  home_stories_heading: string;
  home_create_heading: string;
  home_create_subtitle: string;
  home_create_generate_title: string;
  home_create_generate_description: string;
  home_create_scan_title: string;
  home_create_scan_description: string;
  home_create_upload_title: string;
  home_create_upload_description: string;
  home_cta_title: string;
  home_cta_subtitle: string;
  home_cta_button: string;
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
      story_alignment_error:
        "This story's translation doesn't line up — try regenerating it",
      loading_explain: "Loading explanation...",
      loading_explain_error: "Error loading explanation",
      listen_button: "Listen",
      listen_stop: "Stop",
      listen_loading: "Loading...",
      listen_error: "Couldn't play the audio — try again",
      save_word_button: "Save to dictionary",
      saving_word: "Saving...",
      word_saved: "Saved",
      save_word_error: "Couldn't save — try again",
      save_word_limit_error:
        "Dictionary full (1000 words) — remove some to save more",
      remove_word_button: "Remove from dictionary",
      remove_word_error: "Couldn't remove — try again",
      my_dictionary_nav: "My dictionary",
      my_dictionary_header: "My dictionary",
      my_dictionary_loading: "Loading your dictionary...",
      my_dictionary_error: "Couldn't load your dictionary — try again",
      my_dictionary_empty:
        "No saved words yet. Tap a word while reading and save it to your dictionary.",
      my_dictionary_meaning_pending: "Translation pending...",
      my_dictionary_examples_heading: "Examples",
      my_dictionary_prev_page: "Previous",
      my_dictionary_next_page: "Next",
      my_dictionary_page_label: "Page",
      my_dictionary_delete: "Delete",
      my_dictionary_delete_confirm: "Delete?",
      my_dictionary_delete_cancel: "Cancel",
      my_dictionary_deleting: "Deleting...",
      my_dictionary_delete_error: "Couldn't delete — try again",
      my_dictionary_login_prompt: "Log in to see your saved words",
      settings_title: "Settings",
      settings_i_speak: "I speak:",
      settings_i_learn: "I learn:",
      close_button_caption: "Close",
      cancel_button: "Cancel",
      generate_overlay_message: "Crafting your story",
      generate_overlay_headline: "Your {level} story is on its way",
      scan_overlay_message: "Reading your page",
      upload_overlay_message: "Polishing your text",
      my_stories_header: "My stories",
      stories_header: "Original stories",
      generate_story_button: "Create a new story",
      scan_button: "Scan",
      scan_no_target_text_error:
        "No text in your learned language was found in the image",
      scan_error_disallowed:
        "The text in this image isn't allowed as learning material. Please try a different page.",
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
      upload_error_disallowed:
        "This text isn't allowed as learning material. Please try a different passage.",
      upload_error_no_target_text:
        "No text in your learned language was found in the passage",
      upload_error_generic: "Couldn't process the text — try again",
      reader_menu_label: "Reading options",
      reader_menu_words_section: "Words",
      translation_menu_title: "Translation",
      translation_unavailable: "No translation available for this story.",
      translation_mode_hidden: "Hidden",
      translation_mode_by_paragraph: "By paragraph",
      translation_mode_by_sentence: "By sentence",
      color_noun_genders_checkbox: "Color nouns by gender",
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
      delete_story_confirm_title: "Delete this story?",
      delete_story_confirm_message:
        "The story and all its data will be permanently removed.",
      delete_story_confirm_button: "Delete",
      delete_story_button_label: "Delete story",
      favorite_story_button_label: "Add to favorites",
      unfavorite_story_button_label: "Remove from favorites",
      account_menu_label: "Account menu",
      login_title_signin: "Welcome Back",
      login_title_signup: "Create Account",
      login_subtitle_signin: "Sign in to continue your experience",
      login_subtitle_signup: "Sign up to start your journey",
      login_email_label: "Email",
      login_password_label: "Password",
      login_submit_signin: "Sign In",
      login_submit_signup: "Create Account",
      login_or: "OR",
      login_google_button: "Continue with Google",
      login_toggle_to_signup_question: "Don't have an account yet? ",
      login_toggle_to_signin_question: "Already have an account? ",
      login_toggle_to_signup: "Sign up",
      login_toggle_to_signin: "Sign in",
      login_error_invalid_credentials: "Wrong email or password",
      login_error_email_in_use: "An account with this email already exists",
      login_error_weak_password:
        "Password is too weak — use at least 6 characters",
      login_error_invalid_email: "This email address doesn't look right",
      login_error_too_many_requests:
        "Too many attempts — please wait a moment and try again",
      login_error_generic: "Sign-in failed — please try again",
      home_hero_title_pre: "Learn a language by",
      home_hero_title_highlight: "reading stories.",
      home_hero_subtitle:
        "Short parallel stories at your level, with translations and instant word explanations. Start reading right away — no account needed.",
      home_how_read_title: "Read at your level",
      home_how_read_description:
        "Every story comes with a translation right beneath the original.",
      home_how_tap_title: "Tap any word",
      home_how_tap_description:
        "Get an instant explanation of any word, right in context.",
      home_how_save_title: "Grow your dictionary",
      home_how_save_description:
        "Save the words you want to remember and review them anytime.",
      home_stories_heading: "Start reading — it's free",
      home_create_heading: "Make it personal",
      home_create_subtitle:
        "With a free account you can turn anything into a story:",
      home_create_generate_title: "Generate a story",
      home_create_generate_description:
        "Pick a level, mood and topic — get a brand-new story in seconds.",
      home_create_scan_title: "Scan a book page",
      home_create_scan_description:
        "Photograph a page and read it with tap-to-explain.",
      home_create_upload_title: "Upload any text",
      home_create_upload_description:
        "Paste a letter, article or book excerpt and turn it into a parallel reader.",
      home_cta_title: "Ready to dive in?",
      home_cta_subtitle:
        "Create a free account to generate stories, scan pages and save words.",
      home_cta_button: "Sign up — it's free",
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
      story_alignment_error:
        "Die Übersetzung dieser Geschichte passt nicht zusammen — bitte neu generieren",
      loading_explain: "Lade Erklärung...",
      loading_explain_error: "Fehler beim Laden der Erklärung",
      listen_button: "Anhören",
      listen_stop: "Stopp",
      listen_loading: "Wird geladen...",
      listen_error: "Audio konnte nicht abgespielt werden — bitte erneut versuchen",
      save_word_button: "Ins Wörterbuch speichern",
      saving_word: "Wird gespeichert...",
      word_saved: "Gespeichert",
      save_word_error: "Speichern fehlgeschlagen — bitte erneut versuchen",
      save_word_limit_error:
        "Wörterbuch voll (1000 Wörter) — bitte einige entfernen",
      remove_word_button: "Aus dem Wörterbuch entfernen",
      remove_word_error: "Entfernen fehlgeschlagen — bitte erneut versuchen",
      my_dictionary_nav: "Mein Wörterbuch",
      my_dictionary_header: "Mein Wörterbuch",
      my_dictionary_loading: "Wörterbuch wird geladen...",
      my_dictionary_error:
        "Wörterbuch konnte nicht geladen werden — bitte erneut versuchen",
      my_dictionary_empty:
        "Noch keine gespeicherten Wörter. Tippe beim Lesen auf ein Wort und speichere es in deinem Wörterbuch.",
      my_dictionary_meaning_pending: "Übersetzung folgt...",
      my_dictionary_examples_heading: "Beispiele",
      my_dictionary_prev_page: "Zurück",
      my_dictionary_next_page: "Weiter",
      my_dictionary_page_label: "Seite",
      my_dictionary_delete: "Löschen",
      my_dictionary_delete_confirm: "Löschen?",
      my_dictionary_delete_cancel: "Abbrechen",
      my_dictionary_deleting: "Wird gelöscht...",
      my_dictionary_delete_error: "Löschen fehlgeschlagen — bitte erneut versuchen",
      my_dictionary_login_prompt:
        "Einloggen, um deine gespeicherten Wörter zu sehen",
      settings_title: "Einstellungen",
      settings_i_speak: "Ich spreche:",
      settings_i_learn: "Ich lerne:",
      close_button_caption: "Schließen",
      cancel_button: "Abbrechen",
      generate_overlay_message: "Deine Geschichte wird gestaltet",
      generate_overlay_headline: "Deine {level}-Geschichte ist unterwegs",
      scan_overlay_message: "Deine Seite wird gelesen",
      upload_overlay_message: "Dein Text wird aufbereitet",
      my_stories_header: "Meine Geschichten",
      stories_header: "Originalgeschichten",
      generate_story_button: "Neue Geschichte generieren",
      scan_button: "Scannen",
      scan_no_target_text_error:
        "Im Bild wurde kein Text in deiner Lernsprache gefunden",
      scan_error_disallowed:
        "Der Text in diesem Bild ist nicht als Lernmaterial zugelassen. Bitte versuche es mit einer anderen Seite.",
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
      upload_error_disallowed:
        "Dieser Text ist nicht als Lernmaterial zugelassen. Bitte versuche es mit einem anderen Auszug.",
      upload_error_no_target_text:
        "In diesem Text wurde keine Lernsprache gefunden",
      upload_error_generic:
        "Text konnte nicht verarbeitet werden — bitte erneut versuchen",
      reader_menu_label: "Leseoptionen",
      reader_menu_words_section: "Wörter",
      translation_menu_title: "Übersetzung",
      translation_unavailable:
        "Für diese Geschichte ist keine Übersetzung verfügbar.",
      translation_mode_hidden: "Ausgeblendet",
      translation_mode_by_paragraph: "Nach Absätzen",
      translation_mode_by_sentence: "Nach Sätzen",
      color_noun_genders_checkbox: "Substantive nach Geschlecht einfärben",
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
      delete_story_confirm_title: "Diese Geschichte löschen?",
      delete_story_confirm_message:
        "Die Geschichte und alle zugehörigen Daten werden dauerhaft entfernt.",
      delete_story_confirm_button: "Löschen",
      delete_story_button_label: "Geschichte löschen",
      favorite_story_button_label: "Zu Favoriten hinzufügen",
      unfavorite_story_button_label: "Aus Favoriten entfernen",
      account_menu_label: "Kontomenü",
      login_title_signin: "Willkommen zurück",
      login_title_signup: "Konto erstellen",
      login_subtitle_signin: "Melde dich an, um weiterzumachen",
      login_subtitle_signup: "Registriere dich und leg los",
      login_email_label: "E-Mail",
      login_password_label: "Passwort",
      login_submit_signin: "Anmelden",
      login_submit_signup: "Konto erstellen",
      login_or: "ODER",
      login_google_button: "Mit Google fortfahren",
      login_toggle_to_signup_question: "Noch kein Konto? ",
      login_toggle_to_signin_question: "Schon ein Konto? ",
      login_toggle_to_signup: "Registrieren",
      login_toggle_to_signin: "Anmelden",
      login_error_invalid_credentials: "Falsche E-Mail oder falsches Passwort",
      login_error_email_in_use:
        "Mit dieser E-Mail existiert bereits ein Konto",
      login_error_weak_password:
        "Passwort ist zu schwach — mindestens 6 Zeichen verwenden",
      login_error_invalid_email: "Diese E-Mail-Adresse sieht nicht richtig aus",
      login_error_too_many_requests:
        "Zu viele Versuche — bitte kurz warten und erneut versuchen",
      login_error_generic: "Anmeldung fehlgeschlagen — bitte erneut versuchen",
      home_hero_title_pre: "Lerne eine Sprache durch",
      home_hero_title_highlight: "Geschichten.",
      home_hero_subtitle:
        "Kurze parallele Geschichten auf deinem Niveau, mit Übersetzung und sofortigen Worterklärungen. Leg gleich los — ganz ohne Konto.",
      home_how_read_title: "Lies auf deinem Niveau",
      home_how_read_description:
        "Jede Geschichte kommt mit einer Übersetzung direkt unter dem Original.",
      home_how_tap_title: "Tippe auf ein Wort",
      home_how_tap_description:
        "Erhalte sofort eine Erklärung — direkt im Kontext.",
      home_how_save_title: "Bau dein Wörterbuch auf",
      home_how_save_description:
        "Speichere Wörter, die du dir merken willst, und wiederhole sie jederzeit.",
      home_stories_heading: "Gleich loslesen — kostenlos",
      home_create_heading: "Mach es persönlich",
      home_create_subtitle:
        "Mit einem kostenlosen Konto machst du aus allem eine Geschichte:",
      home_create_generate_title: "Geschichte generieren",
      home_create_generate_description:
        "Wähle Niveau, Stimmung und Thema — und erhalte in Sekunden eine neue Geschichte.",
      home_create_scan_title: "Buchseite scannen",
      home_create_scan_description:
        "Fotografiere eine Seite und lies sie mit Tipp-Erklärungen.",
      home_create_upload_title: "Eigenen Text hochladen",
      home_create_upload_description:
        "Füge einen Brief, Artikel oder Buchauszug ein und mach daraus eine parallele Lektüre.",
      home_cta_title: "Bereit loszulegen?",
      home_cta_subtitle:
        "Erstelle ein kostenloses Konto, um Geschichten zu generieren, Seiten zu scannen und Wörter zu speichern.",
      home_cta_button: "Kostenlos registrieren",
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
      story_alignment_error:
        "Перевод этой истории не совпадает с оригиналом — попробуйте сгенерировать её заново",
      loading_explain: "Загрузка объяснения...",
      loading_explain_error: "Ошибка загрузки объяснения",
      listen_button: "Слушать",
      listen_stop: "Стоп",
      listen_loading: "Загрузка...",
      listen_error: "Не удалось воспроизвести аудио — попробуйте ещё раз",
      save_word_button: "Сохранить в словарь",
      saving_word: "Сохранение...",
      word_saved: "Сохранено",
      save_word_error: "Не удалось сохранить — попробуйте ещё раз",
      save_word_limit_error:
        "Словарь заполнен (1000 слов) — удалите часть, чтобы добавить ещё",
      remove_word_button: "Удалить из словаря",
      remove_word_error: "Не удалось удалить — попробуйте ещё раз",
      my_dictionary_nav: "Мой словарь",
      my_dictionary_header: "Мой словарь",
      my_dictionary_loading: "Загрузка словаря...",
      my_dictionary_error: "Не удалось загрузить словарь — попробуйте ещё раз",
      my_dictionary_empty:
        "Пока нет сохранённых слов. Нажмите на слово во время чтения и сохраните его в словарь.",
      my_dictionary_meaning_pending: "Перевод готовится...",
      my_dictionary_examples_heading: "Примеры",
      my_dictionary_prev_page: "Назад",
      my_dictionary_next_page: "Вперёд",
      my_dictionary_page_label: "Страница",
      my_dictionary_delete: "Удалить",
      my_dictionary_delete_confirm: "Удалить?",
      my_dictionary_delete_cancel: "Отмена",
      my_dictionary_deleting: "Удаление...",
      my_dictionary_delete_error: "Не удалось удалить — попробуйте ещё раз",
      my_dictionary_login_prompt: "Войдите, чтобы увидеть сохранённые слова",
      settings_title: "Настройки",
      settings_i_speak: "Я говорю на:",
      settings_i_learn: "Я учу:",
      close_button_caption: "Закрыть",
      cancel_button: "Отмена",
      generate_overlay_message: "Создаём вашу историю",
      generate_overlay_headline: "Ваша история уровня {level} уже в пути",
      scan_overlay_message: "Читаем вашу страницу",
      upload_overlay_message: "Обрабатываем ваш текст",
      my_stories_header: "Мои истории",
      stories_header: "Авторские истории",
      generate_story_button: "Сгенерировать новую историю",
      scan_button: "Сканировать",
      scan_no_target_text_error:
        "На изображении не найден текст на изучаемом языке",
      scan_error_disallowed:
        "Текст на этом изображении нельзя использовать как учебный материал. Попробуйте другую страницу.",
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
      upload_error_disallowed:
        "Этот текст нельзя использовать как учебный материал. Попробуйте другой отрывок.",
      upload_error_no_target_text:
        "В тексте не найден фрагмент на изучаемом языке",
      upload_error_generic: "Не удалось обработать текст — попробуйте ещё раз",
      reader_menu_label: "Настройки чтения",
      reader_menu_words_section: "Слова",
      translation_menu_title: "Перевод",
      translation_unavailable: "Для этой истории нет перевода.",
      translation_mode_hidden: "Скрыт",
      translation_mode_by_paragraph: "По абзацам",
      translation_mode_by_sentence: "По предложениям",
      color_noun_genders_checkbox: "Окрашивать существительные по роду",
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
      delete_story_confirm_title: "Удалить эту историю?",
      delete_story_confirm_message:
        "История и все её данные будут удалены безвозвратно.",
      delete_story_confirm_button: "Удалить",
      delete_story_button_label: "Удалить историю",
      favorite_story_button_label: "Добавить в избранное",
      unfavorite_story_button_label: "Убрать из избранного",
      account_menu_label: "Меню аккаунта",
      login_title_signin: "С возвращением",
      login_title_signup: "Создать аккаунт",
      login_subtitle_signin: "Войдите, чтобы продолжить",
      login_subtitle_signup: "Зарегистрируйтесь, чтобы начать",
      login_email_label: "Электронная почта",
      login_password_label: "Пароль",
      login_submit_signin: "Войти",
      login_submit_signup: "Создать аккаунт",
      login_or: "ИЛИ",
      login_google_button: "Продолжить с Google",
      login_toggle_to_signup_question: "Ещё нет аккаунта? ",
      login_toggle_to_signin_question: "Уже есть аккаунт? ",
      login_toggle_to_signup: "Зарегистрироваться",
      login_toggle_to_signin: "Войти",
      login_error_invalid_credentials: "Неверная почта или пароль",
      login_error_email_in_use: "Аккаунт с этой почтой уже существует",
      login_error_weak_password:
        "Пароль слишком простой — используйте не менее 6 символов",
      login_error_invalid_email: "Похоже, адрес почты указан неверно",
      login_error_too_many_requests:
        "Слишком много попыток — подождите немного и попробуйте снова",
      login_error_generic: "Не удалось войти — попробуйте ещё раз",
      home_hero_title_pre: "Учите язык, читая",
      home_hero_title_highlight: "истории.",
      home_hero_subtitle:
        "Короткие параллельные истории вашего уровня — с переводом и мгновенными объяснениями слов. Начните читать прямо сейчас, без регистрации.",
      home_how_read_title: "Читайте на своём уровне",
      home_how_read_description:
        "К каждой истории — перевод прямо под оригиналом.",
      home_how_tap_title: "Нажмите на любое слово",
      home_how_tap_description:
        "Мгновенное объяснение слова прямо в контексте.",
      home_how_save_title: "Собирайте свой словарь",
      home_how_save_description:
        "Сохраняйте слова, которые хотите запомнить, и повторяйте их в любой момент.",
      home_stories_heading: "Начните читать — это бесплатно",
      home_create_heading: "Сделайте чтение личным",
      home_create_subtitle:
        "С бесплатным аккаунтом любая тема или текст превращается в историю:",
      home_create_generate_title: "Сгенерируйте историю",
      home_create_generate_description:
        "Выберите уровень, настроение и тему — новая история будет готова за секунды.",
      home_create_scan_title: "Сканируйте страницу книги",
      home_create_scan_description:
        "Сфотографируйте страницу и читайте её с объяснениями по нажатию.",
      home_create_upload_title: "Загрузите свой текст",
      home_create_upload_description:
        "Вставьте письмо, статью или отрывок книги и превратите его в параллельное чтение.",
      home_cta_title: "Готовы начать?",
      home_cta_subtitle:
        "Создайте бесплатный аккаунт, чтобы генерировать истории, сканировать страницы и сохранять слова.",
      home_cta_button: "Зарегистрироваться бесплатно",
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
