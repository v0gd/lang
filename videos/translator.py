from client import *
import os
import languages
import difflib

input_paragraphs = read_lines("en/story_raw.txt")

for l, lang in languages.ALL.items():
    print(f"Translating to {l}...")
    if l == "en":
        continue
    make_dir_in_last_dir(l)

    output_file = f"{l}/story_raw.txt"
    if not path_in_last_dir_exists(output_file):
        print("Translating...")
        translated = []
        for p in input_paragraphs:
            # p = gpt_multiturn([
            #         {"role": "user", "content": f"You are a {lang} language expert. Seing the following paragraph in English carefully translate it to {lang}.\n\n{p}"}
            #     ], pedantic=True).strip()
            p = gpt_multiturn(
                [
                    {
                        "role": "user",
                        "content": f"What is the most direct and grammatically correct translation of the following text to {lang}:\n\n{p}",
                    }
                ],
                pedantic=True,
            ).strip()
            translated.append(p)
            write_in_last_dir(output_file, "\n\n".join(translated))

    validation_file = f"{l}/story_raw_validation.txt"
    if not path_in_last_dir_exists(validation_file):
        print("Validating...")
        translated_paragraphs = read_lines(output_file)
        assert len(translated_paragraphs) == len(input_paragraphs)
        validated = []
        for pl, pr in zip(input_paragraphs, translated_paragraphs):
            p = gpt_multiturn(
                [
                    {
                        "role": "user",
                        "content": f"You are a {lang} language teacher. Carefully analyze the following translation word by word and correct it.\n\n{pl}\n\n{pr}",
                    }
                ],
                pedantic=True,
            ).strip()
            validated.append(p)
            write_in_last_dir(validation_file, "\n\n\n\n".join(validated))
