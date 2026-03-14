import sys
from elevenlabs import Voice, VoiceSettings

ALL = {
    "en": "English",
    "de": "German",
    "ru": "Russian",
}


def _pairs() -> list[tuple[str, str]]:
    args = sys.argv[2:]
    return [tuple(arg.split("_")) for arg in args]


pairs = _pairs()
print("Language pairs " + ", ".join([f"{p[0]}-{p[1]}" for p in pairs]))


# voices = {
#     # 'en': Voice(
#     #     name='Antoni',
#     #     voice_id='ErXwobaYiN019PkySvjV',
#     #     settings=VoiceSettings(stability=0.9, similarity_boost=0.9, style=0.0, use_speaker_boost=True),
#     # ),
#     'en': Voice(
#         name='Lily',
#         voice_id='pFZP5JQG7iQjIQuC4Bku',
#         settings=VoiceSettings(stability=0.9, similarity_boost=0.9, style=0.0, use_speaker_boost=True),
#     ),
#     'de': Voice(
#         name='Lily',
#         voice_id='pFZP5JQG7iQjIQuC4Bku',
#         settings=VoiceSettings(stability=0.9, similarity_boost=0.9, style=0.0, use_speaker_boost=True),
#     ),
#     'ru': Voice(
#         name='Matilda',
#         voice_id='XrExE9yKIg1WjnnlVkGX',
#         settings=VoiceSettings(stability=0.9, similarity_boost=0.9, style=0.0, use_speaker_boost=True),
#     ),
# }

voices_title = {
    # 'en': Voice(
    #     name='Antoni',
    #     voice_id='ErXwobaYiN019PkySvjV',
    #     settings=VoiceSettings(stability=1, similarity_boost=1, style=0.0, use_speaker_boost=True),
    # ),
    "en": Voice(
        name="Therese",
        voice_id="Oh87FQRZz8MsCLUFi5NY",
        settings=VoiceSettings(
            stability=1, similarity_boost=1, style=0.0, use_speaker_boost=True
        ),
    ),
    "de": Voice(
        name="Lily",
        voice_id="pFZP5JQG7iQjIQuC4Bku",
        settings=VoiceSettings(
            stability=1, similarity_boost=1, style=0.0, use_speaker_boost=True
        ),
    ),
    "ru": Voice(
        name="Matilda",
        voice_id="XrExE9yKIg1WjnnlVkGX",
        settings=VoiceSettings(
            stability=1, similarity_boost=1, style=0.0, use_speaker_boost=True
        ),
    ),
}

intro_hello = {
    "ru": {
        "de": "В этом видео вы услышите простую историю на немецком языке.",
        "en": "В этом видео вы услышите простую историю на английском языке.",
    },
    "en": {
        "de": "In this video, you will hear a simple story in German.",
    },
    "de": {
        "en": "In diesem Video hören Sie eine einfache Geschichte auf Englisch.",
    },
}

intro_video_structure_l_r = {
    "ru": 'Сначала вы услышите историю по частям с переводом. <break time="0.7s"/> Затем мы повторим всю историю целиком без перевода.',
    "en": 'First, you will hear the story in parts with translation. <break time="0.7s"/> Then we will repeat the whole story without translation.',
    "de": 'Zuerst hören Sie die Geschichte in Abschnitten mit Übersetzung. <break time="0.7s"/> Dann wiederholen wir die ganze Geschichte ohne Übersetzung.',
}

intro_video_structure_r_l = {
    "ru": 'Сначала вы услышите всю историю целиком без перевода. <break time="0.7s"/> Затем мы повторим историю по частям с переводом.',
    "en": 'First, you will hear the whole story without translation. <break time="0.7s"/> Then we will repeat the story in parts with translation.',
    "de": 'Zuerst hören Sie die ganze Geschichte ohne Übersetzung. <break time="0.7s"/> Dann wiederholen wir die Geschichte in Abschnitten mit Übersetzung.',
}

intro_video_structure_r_l_f = {
    "ru": 'Сначала вы услышите всю историю целиком без перевода. <break time="0.7s"/> Затем мы повторим историю по частям с переводом. <break time="0.7s"/> И в конце вы сможете проверить свои знания, снова прослушав историю без перевода и без субтитров.',
    "en": 'First, you will hear the whole story without translation. <break time="0.7s"/> Then we will repeat the story in parts with translation. <break time="0.7s"/> Finally, you will be able to check your knowledge by listening to the story again without translation or subtitles.',
    "de": 'Zuerst hören Sie die ganze Geschichte ohne Übersetzung. <break time="0.7s"/> Dann wiederholen wir die Geschichte in Abschnitten mit Übersetzung. <break time="0.7s"/> Zum Schluss können Sie Ihr Wissen überprüfen, indem Sie die Geschichte noch einmal ohne Übersetzung oder Untertitel anhören.',
}

intro_levels = {
    "ru": "На нашем канале вы найдете адаптацию этой истории для разных уровней.",
    "en": "On our channel, you will find adaptations of this story for different levels.",
    "de": "Auf unserem Kanal finden Sie Adaptionen dieser Geschichte für verschiedene Sprachniveaus.",
}

intro_like_and_subscribe = {
    "ru": "Оставляйте комментарии, ставьте лайк и подписывайтесь! Это очень поможет развитию канала!",
    "en": "Leave comments, like, and subscribe!",
    "de": "Hinterlassen Sie Kommentare.",
}

# intro_audios_r_l_test = {
#     'ru': {
#         'de': [
#             'Здравствуйте! В этом видео вы услышите простую историю на немецком языке.',
#             'Сначала вы услышите историю без перевода. Попробуйте уловить знакомые слова и выражения. <break time="0.7s"/> Затем мы повторим историю по частям, сопровождая переводом. <break time="0.7s"/> И в конце, вы попробуете самостоятельно перевести некоторые услышанные предложения. <break time="0.7s"/>',
#             'На нашем канале вы найдете адаптацию этой истории для разных уровней. <break time="0.7s"/> При желании вы также можете изменить скорость в настройках плеера.',
#             'Оставляйте комментарии, ставьте лайк и подписывайтесь! Это очень поможет развитию канала!',
#         ],
#         'en': [
#             'Здравствуйте! В этом видео вы услышите простую историю на английском языке.',
#         ]
#     },
#     'en': {
#         'de': [
#             'In this video, you will hear a simple story in German.',
#             'First, you will hear the story without translation. Try to catch familiar words and expressions. <break time="0.7s"/> Then, we will repeat the story in parts, accompanied by translation. <break time="0.7s"/> Finally, you will try to translate some of the sentences you heard. <break time="0.7s"/> If you wish, you can change the playback speed in the player settings.',
#             'Leave comments, like, and subscribe! It really helps the channel grow!',
#         ],
#         'ru': [
#             'In this video, you will hear a simple story in Russian.',
#         ]
#     },
# }

intro_texts_r_l_test = {
    "ru": [
        "",
        "1. История без перевода.\n2. История с переводом.\n3. Тест.",
        "Ссылки в описании",
        "Оставляйте комментарии, ставьте лайк и подписывайтесь!",
    ],
    "en": [
        "",
        "1. Story without translation.\n2. Story with translation.\n3. Test.",
        # 'Leave comments, like, and subscribe!',
    ],
    "de": [
        "",
        "1. Geschichte ohne Übersetzung.\n2. Geschichte mit Übersetzung.\n3. Test.",
    ],
}

intro_texts_l_r = {
    "ru": [
        "",
        "1. История с переводом.\n2. История без перевода.",
        "Ссылки в описании",
        # 'Оставляйте комментарии, ставьте лайк и подписывайтесь!',
    ],
    "en": [
        "",
        "1. Story with translation.\n2. Story without translation.",
        "Links are in the description",
        # 'Leave comments, like, and subscribe!',
    ],
    "de": [
        "",
        "1. Geschichte mit Übersetzung.\n2. Geschichte ohne Übersetzung.",
        "Links sind in der Beschreibung.",
    ],
}

intro_texts_r_l = {
    "ru": [
        "",
        "1. История без перевода.\n2. История с переводом.",
        "Ссылки в описании",
        # 'Оставляйте комментарии, ставьте лайк и подписывайтесь!',
    ],
    "en": [
        "",
        "1. Story without translation.\n2. Story with translation.",
        "Links are in the description",
        # 'Leave comments, like, and subscribe!',
    ],
    "de": [
        "",
        "1. Geschichte ohne Übersetzung.\n2. Geschichte mit Übersetzung.",
        "Links sind in der Beschreibung.",
    ],
}

intro_texts_r_l_f = {
    "ru": [
        "",
        "1. История без перевода.\n2. История с переводом.\n3. История без перевода и субтитров.",
        "Ссылки в описании",
        # 'Оставляйте комментарии, ставьте лайк и подписывайтесь!',
    ],
    "en": [
        "",
        "1. Story with subtitles.\n2. Story with translation.\n3. Story without translation or subtitles.",
        "Links are in the description",
        # 'Leave comments, like, and subscribe!',
    ],
    "de": [
        "",
        "1. Geschichte mit Untertiteln.\n2. Geschichte mit Übersetzung.\n3. Geschichte ohne Übersetzung und Untertitel.",
        "Links sind in der Beschreibung.",
    ],
}

# intro_audios_l_r = {
#     'ru': {
#         'de': [
#             'Здравствуйте! В этом видео вы услышите простую историю на немецком языке.',
#             'Сначала вы услышите историю по частям с переводом. <break time="0.7s"/> Затем мы повторим всю историю целиком без перевода.',
#             'На нашем канале вы найдете адаптацию этой истории для разных уровней. <break time="0.7s"/> При желании вы также можете изменить скорость в настройках плеера.',
#             'Оставляйте комментарии, ставьте лайк и подписывайтесь! Это очень поможет развитию канала!',
#         ],
#         'en': [
#             'Здравствуйте! В этом видео вы услышите простую историю на английском языке.',
#         ]
#     },
# }

transitions_l = {
    "en": "Now listen to the story with translation. Try to remember new words and expressions.",
    "ru": "Теперь прослушайте историю по частям с переводом. Постарайтесь запомнить новые слова и выражения.",
    "de": "Hören Sie sich jetzt die Geschichte mit Übersetzung an. Versuchen Sie, sich neue Wörter und Ausdrücke zu merken.",
}

transitions_r = {
    "ru": "Теперь прослушайте всю историю целиком без перевода.",
    "en": "Now listen to the whole story without translation.",
    "de": "Hören Sie sich jetzt die ganze Geschichte ohne Übersetzung an.",
}

transitions_test = {
    "en": "Now let's test your knowledge. Try to understand and translate the following sentences into English.",
    "ru": "Теперь давайте проверим ваши знания. Попробуйте понять и перевести на русский следующие предложения.",
    "de": "Jetzt testen wir Ihr Wissen. Versuchen Sie, die folgenden Sätze zu verstehen und ins Englische zu übersetzen.",
}

thanks = {
    "en": "Thank you for watching!",
    "de": "Danke fürs Zuschauen!",
    "ru": "Спасибо за просмотр!",
}
