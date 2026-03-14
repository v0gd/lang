from client import *
import languages
import difflib

en_lines = read_lines("en/story_raw.txt")


def create_context(lines, i):
    l = max(i - 5, 0)
    r = min(i + 2, len(lines))
    return " ".join(lines[l:r])


for l, lang in languages.ALL.items():
    if l == "en":
        continue

    input_filename = f"{l}/story_raw.txt"
    if not path_in_last_dir_exists(input_filename):
        continue

    print(f"Improving {l}...")

    lines = read_lines(input_filename)
    assert len(en_lines) == len(lines), f"{len(en_lines)} != {len(lines)}"

    output_filename_1 = f"{l}/story_corrected_raw.txt"
    if path_in_last_dir_exists(output_filename_1):
        corrected_1 = read_lines(output_filename_1)
    else:
        print(f"Correction 1")
        corrected_1 = []
        for line in lines:
            corrected_line = gpt_multiturn(
                [
                    {
                        "role": "user",
                        "content": f"You are a {lang} language expert, seing the following paragraph in {lang}, what subtle improvements can you make? Analyze it word by word and print only the corrected paragraph.\n\n{line}",
                    }
                ],
                pedantic=True,
            ).strip()
            corrected_1.append(corrected_line)
        diff = list(difflib.unified_diff(lines, corrected_1))
        print("Diff: " + "\n".join(diff))
        write_in_last_dir(output_filename_1, "\n\n".join(corrected_1))

    # output_filename_2 = f"{l}/story_corrected_2.txt"
    # if path_in_last_dir_exists(output_filename_2):
    #     corrected_2 = read_lines(output_filename_2)
    # else:
    #     print(f"Correction 2")
    #     corrected_2 = []
    #     for i in range(len(en_lines)):
    #         context = create_context(en_lines, i)
    #         corrected_line = gpt_multiturn([
    #             {"role": "user", "content": f"You are a {lang} language expert, working on single sentence translation which must be perfect. Here is a text context in English: {context}\n\nYou are very picky {lang} language expert and want the perfect translation. Analyze the translation word by word, and see how it can be improved to mirror the original sentence as much as possible and to sound natural in {lang} language. Print only the corrected sentence.\n\n Here is the original sentence and its translation to {lang}:\n\n{en_lines[i]}\n{lines[i]}"}
    #         ], pedantic=True).strip()
    #         corrected_2.append(corrected_line)
    #     diff = list(difflib.unified_diff(lines, corrected_2))
    #     print('Diff: ' + '\n'.join(diff))
    #     write_in_last_dir(output_filename_2, "\n\n".join(corrected_2))

    assert len(lines) == len(corrected_1)
    if not path_in_last_dir_exists(f"{l}/correction_explanation.txt"):
        explanations = []
        for line, corrected_line_1 in zip(lines, corrected_1):
            if line != corrected_line_1:
                explanation = gpt_multiturn(
                    [
                        {
                            "role": "user",
                            "content": f"You are a {lang} language expert, analyze the difference between the following 2 paragraphs word by word. Which paragraph is better and why? Be concise in your response\n\n{line}\n\n{corrected_line_1}",
                        }
                    ],
                    pedantic=True,
                ).strip()
                explanations.append(
                    f"{line}\n{corrected_line_1}\n{explanation}"
                )
        write_in_last_dir(
            f"{l}/correction_explanation.txt", "\n\n\n\n".join(explanations)
        )
