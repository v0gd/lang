from client import (
    read_lines,
    read_lines_and_remove_union_numbers,
    LATEST_LEVEL_RANGE,
    LATEST_LEVEL,
)

_description_prefix = {
    "ru": """Учите {lang_nominative} язык на слух через простые рассказы. В этом видео вы найдете рассказ уровня {level} с параллельным переводом для изучения {lang_dative} языка.

Вы можете читать текст с экрана и/или слушать историю.""",
    "en": """Learn {lang_nominative} by listening to simple stories. In this video, you will find a level {level} story with parallel translation for learning {lang_nominative}.

You can read the text on the screen and/or listen to the story.""",
    "de": """Lernen Sie {lang_nominative}, indem Sie einfachen Geschichten zuhören. In diesem Video finden Sie eine Geschichte auf dem Niveau {level} mit paralleler Übersetzung zum {lang_nominative}lernen.

Sie können den Text auf dem Bildschirm lesen und/oder der Geschichte zuhören.
""",
}

_description_language_nominative = {
    "ru": {
        "de": "немецкий",
        "en": "английский",
    },
    "en": {
        "de": "German",
    },
    "de": {
        "en": "Englisch",
    },
}
_description_language_nominative_uppercase = {
    "ru": {"de": "Немецкий", "en": "Английский"},
    "en": {
        "de": "German",
    },
    "de": {
        "en": "Englisch",
    },
}
_description_language_dative = {
    "ru": {
        "de": "немецкого",
        "en": "английского",
    },
    "en": {
        "de": "German",
    },
    "de": {
        "en": "Englisch",
    },
}

_titles = {
    "ru": {
        "A1": "{lang_nominative} на слух для начинающих ({level}) | Рассказ: {title}",
        "A2": "{lang_nominative} на слух для начинающих ({level}) | Рассказ: {title}",
        "B1": "{lang_nominative} на слух, средний уровень ({level}) | Рассказ: {title}",
        "B2": "{lang_nominative} на слух, средний уровень ({level}) | Рассказ: {title}",
        "C1": "{lang_nominative} на слух, продвинутый уровень ({level}) | Рассказ: {title}",
    },
    "en": {
        "A1": "Learn {lang_nominative} for Beginners ({level}) | {title}",
        "A2": "Learn {lang_nominative} for Beginners ({level}) | {title}",
        "B1": "Learn {lang_nominative}, Intermediate level ({level}) | {title}",
        "B2": "Learn {lang_nominative}, Intermediate level ({level}) | {title}",
        "C1": "Learn {lang_nominative}, Advanced level ({level}) | {title}",
    },
    "de": {
        "A1": "{lang_nominative} lernen für Anfänger ({level}) | {title}",
        "A2": "{lang_nominative} lernen für Anfänger ({level}) | {title}",
        "B1": "{lang_nominative} lernen für Fortgeschrittene ({level}) | {title}",
        "B2": "{lang_nominative} lernen für Fortgeschrittene ({level}) | {title}",
        "C1": "{lang_nominative} lernen für Fortgeschrittene ({level}) | {title}",
    },
}


def get_description_prefix(l, r, level) -> str:
    return _description_prefix[l].format_map(
        {
            "level": level,
            "lang_nominative": _description_language_nominative[l][r],
            "lang_dative": _description_language_dative[l][r],
        }
    )


description_chapter_intro = {
    "ru": "Вступление",
    "en": "Intro",
    "de": "Intro",
}

description_chaper_l = {
    "ru": "История с переводом",
    "en": "Story with Translation",
    "de": "Geschichte mit Übersetzung",
}

description_chaper_r = {
    "ru": "История с субтитрами",
    "en": "Story with Subtitles",
    "de": "Geschichte mit Untertiteln",
}

description_chaper_f = {
    "ru": "История без субтитров",
    "en": "Story without Subtitles",
    "de": "Geschichte ohne Untertitel",
}


def read_video_description(l):
    lines = read_lines("../video_description.txt")
    for line in lines:
        if line.startswith(l):
            return line[len("en:") :].strip()
    assert False, f"Video description not found for {l}"


def create_description(l, r, schema, t_text1, t_text2, t_text3):
    def format_time(t):
        return f"{int(t) // 60}:{int(t) % 60:02}"

    description_level = LATEST_LEVEL_RANGE.replace("_", ",")
    text = _titles[l][LATEST_LEVEL].format_map(
        {
            "level": description_level,
            "lang_nominative": _description_language_nominative_uppercase[l][r],
            "title": read_lines_and_remove_union_numbers(f"{l}/mapping.txt")[0],
        }
    )

    text += "\n\n" + get_description_prefix(l, r, description_level)
    text += "\n\n" + read_video_description(l)
    text += f"\n\n0:00 {description_chapter_intro[l]}"
    if schema == "lr":
        text += f"\n{format_time(t_text1)} {description_chaper_l[l]}"
        text += f"\n{format_time(t_text2)} {description_chaper_r[l]}"
    elif schema == "rl":
        text += f"\n{format_time(t_text1)} {description_chaper_r[l]}"
        text += f"\n{format_time(t_text2)} {description_chaper_l[l]}"
    elif schema == "rlf":
        text += f"\n{format_time(t_text1)} {description_chaper_r[l]}"
        text += f"\n{format_time(t_text2)} {description_chaper_l[l]}"
        text += f"\n{format_time(t_text3)} {description_chaper_f[l]}"
    else:
        assert False
    return text


# print(create_description('ru', 'de', 'lr', 183.5, 198.2, 200))
