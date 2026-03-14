from client import *
import languages

import groupun_mapping

OVERRIDE_FILES = True

subs = {
    "de": {
        "Clara": "Klara",
        "Beatrice": "Beatris",
    },
    "ru": {},
    "en": {},
}


def get_token_in_quotes(token: str):
    prefix_pos = 0
    for i in range(len(token)):
        if token[i].isalnum():
            prefix_pos = i
            break
    suffix_pos = 0
    for i in range(len(token) - 1, -1, -1):
        if token[i].isalnum():
            suffix_pos = i
            break
    if prefix_pos > suffix_pos:
        return token
    return f"{token[:prefix_pos]}'{token[prefix_pos:suffix_pos + 1]}'{token[suffix_pos + 1:]}"


def get_token_with_punct(token, punct):
    for i in range(len(token) - 1, -1, -1):
        if token[i].isalnum():
            if i < len(token) - 1 and (
                token[i + 1] == punct or token[i + 1] in "!?."
            ):
                return token
            return token[: i + 1] + punct + token[i + 1 :]


def is_punctuation(token):
    return all([not c.isalnum() for c in token])


for l in languages.ALL.keys():
    input_filepath = f"{l}/mapping.txt"
    lines = read_lines_and_remove_union_numbers(input_filepath)
    for i in range(len(lines)):
        for old, new in subs[l].items():
            lines[i] = lines[i].replace(old, new)

    lines_merged = []
    for line in lines:
        if line.startswith("+"):
            lines_merged[-1] = (
                lines_merged[-1] + ' <break time="1s"/>' + line[1:]
            )
        else:
            lines_merged.append(line)
    lines_merged = [line.replace("@", "\n") for line in lines_merged]

    if OVERRIDE_FILES or not path_in_last_dir_exists(f"{l}/narration.txt"):
        write_in_last_dir(
            f"{l}/narration.txt", '<break time="1s"/>\n'.join(lines_merged)
        )
        # text = "\n\n".join(lines_merged)
        # print(f"Grouping {l} sentences...")
        # grouped_text = gpt_multiturn([
        #     {
        #         "role": "user",
        #         "content": "Group sentences in the following story into paragraphs, but keep the <break time> elements in sentences and the title untouched:\n" + text
        #     }
        # ], pedantic=True)
        # if l == 'ru':
        #     grouped_text = gpt_multiturn([
        #         {
        #             "role": "user",
        #             "content": "Замени букву 'е' на 'ё' где необходимо в следующем тексте, но не трогай элементы <break time>:\n" + grouped_text
        #         }
        #     ], pedantic=True)
        # write_in_last_dir(f"{l}/narration.txt", grouped_text)
        # TODO: double check narration

    with_commas = [lines_merged[0]]
    with_quotes = [lines_merged[0]]
    to_skip = ["<break", 'time="1s"/>']
    for line in lines_merged[1:]:
        tokens = line.split()
        if not tokens:
            continue
        tokens_with_commas = []
        tokens_with_quotes = []
        for token in tokens:
            if token in to_skip or is_punctuation(token):
                tokens_with_commas.append(token)
                tokens_with_quotes.append(token)
                continue
            if l == "en":
                token = get_token_with_punct(token, ".").capitalize()
            else:
                token = get_token_with_punct(token, ",")
            tokens_with_commas.append(token)
            tokens_with_quotes.append(get_token_in_quotes(token))
        with_commas.append('"' + " ".join(tokens_with_commas) + '"')
        with_quotes.append(" ".join(tokens_with_quotes))
    write_in_last_dir(
        f"{l}/narration_with_commas.txt",
        '<break time="1s"/>\n'.join(with_commas),
    )
    write_in_last_dir(
        f"{l}/narration_in_quotes.txt", '<break time="1s"/>\n'.join(with_quotes)
    )
