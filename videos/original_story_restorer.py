from client import *

from client import *
import shutil, re, languages
import re


def pack_numbers(line: str):
    numbers = re.findall(r"\((\d+)\)", line)
    unique_numbers = list(set(int(number) for number in numbers))
    unique_numbers.sort()
    if unique_numbers and unique_numbers[0] == 0:
        unique_numbers = unique_numbers[1:]
    for i, num in enumerate(unique_numbers):
        line = line.replace(f"({num})", f"({i + 1})")
    return line


filename = f"en/story_ml.txt"
if path_in_last_dir_exists(filename):
    lines = read_lines_and_remove_union_numbers(filename)
    text = "\n".join(lines)
    text = gpt_multiturn(
        [
            {
                "role": "user",
                "content": f"Group the following sentences into paragraphs, keep the title separately on the first line: {text}",
            }
        ]
    )
    write_in_last_dir("en/original.txt", text)

else:
    print("No input, nothing to do")
