from client import *
import languages

if path_in_last_dir_exists("mapping_grouped.txt"):
    lines = read_lines_and_remove_union_numbers("mapping_grouped.txt")

    locales = sorted(languages.ALL.keys())
    locales.remove("en")
    locales.insert(0, "en")
    print("Cleaning grouped text: " + str(locales))
    N = len(locales)
    grouped = [list() for _ in range(len(lines) // N)]

    for i in range(len(lines)):
        if i % N == 0:
            grouped[i // N].append(f"{i // N}.")
        line = lines[i]
        if line.startswith("+"):
            line = line[1:].strip()
        grouped[i // N].append(line)

    write_in_last_dir(
        f"mapping_grouped_clean.txt",
        "\n\n\n".join(["\n".join(g) for g in grouped]),
    )
