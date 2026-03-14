import os
from client import *
import languages
from tts import tts

LIMIT = 0


def unique_strings_from_pairs(pairs):
    return list(set(key for pair in pairs for key in pair))


for l, r in languages.pairs:
    print(f"{l}->{r}")
    voice = languages.voices_title[l]

    intros_path = data_path() / f"{l}/intros"
    os.makedirs(intros_path, exist_ok=True)
    intros = {
        f"hello_{l}_{r}.mp3": languages.intro_hello[l][r],
        "video_structure_l_r.mp3": languages.intro_video_structure_l_r[l],
        "video_structure_r_l.mp3": languages.intro_video_structure_r_l[l],
        "video_structure_r_l_f.mp3": languages.intro_video_structure_r_l_f[l],
        "levels.mp3": languages.intro_levels[l],
        "like_subscribe.mp3": languages.intro_like_and_subscribe[l],
    }
    for filename, text in intros.items():
        intro_path = intros_path / filename
        if not os.path.exists(intro_path):
            print(f"intro {filename}")
            tts(text, voice, intro_path)

    transitions_path = data_path() / f"{l}/transitions"
    os.makedirs(transitions_path, exist_ok=True)
    transitions = {
        "left.mp3": languages.transitions_l[l],
        "right.mp3": languages.transitions_r[l],
        "test.mp3": languages.transitions_test[l],
    }
    for filename, text in transitions.items():
        transition_path = transitions_path / filename
        if not os.path.exists(transition_path):
            print(f"transition {filename}")
            text = text.replace("...", ".").replace("!", ".")
            tts(text, voice, transition_path)
