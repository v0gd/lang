from client import *
import languages
import groupun_mapping

for l in languages.ALL.keys():
    input_filename = f"{l}/mapping.txt"
    if not path_in_last_dir_exists(input_filename):
        continue
    lines = read_lines_and_remove_union_numbers(input_filename)
    result = []
    idx = 0
    for line in lines:
        if not line.startswith("+"):
            result.append(f"{idx}. {line}")
            idx += 1
        else:
            result[-1] = result[-1] + f"\n{line}"
    write_in_last_dir(f"{l}/sentence_numbers.txt", "\n\n".join(result))
