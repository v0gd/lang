from client import *
import shutil, re
import re


def pack_numbers(line: str, start_idx: int) -> tuple[str, int]:
    numbers = re.findall(r"\((\d+)\)", line)
    unique_numbers = list(set(int(number) for number in numbers))
    unique_numbers.sort()
    if unique_numbers and unique_numbers[0] == 0:
        unique_numbers = unique_numbers[1:]
    for i, num in enumerate(unique_numbers):
        line = line.replace(f"({num})", f"({i + start_idx})")
    line = line.replace(f"(0)", "")
    return (line, start_idx + len(unique_numbers))


filename = f"en/story_ml.txt"
if path_in_last_dir_exists(filename):
    print(f"Packing {filename}")
    shutil.copy2(
        path_in_last_dir(filename), path_in_last_dir(filename + ".bac")
    )
    lines = read_lines(filename)
    start_idx = 1
    packed_lines = []
    for i in range(len(lines)):
        if not lines[i].startswith("+"):
            start_idx = 1
        packed_line, start_idx = pack_numbers(lines[i], start_idx)
        if not packed_line.startswith("+"):
            packed_lines.append("")
        packed_lines.append(packed_line)
    if packed_lines and packed_lines[0] == "":
        packed_lines = packed_lines[1:]
    write_in_last_dir(filename, "\n".join(packed_lines))
else:
    print("No input, nothing to do")
