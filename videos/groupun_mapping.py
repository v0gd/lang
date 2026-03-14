from client import *
import languages

exclude = []

if path_in_last_dir_exists("mapping_grouped.txt"):
    lines = read_lines("mapping_grouped.txt")

    locales = sorted(languages.ALL.keys())
    locales.remove("en")
    for l in exclude:
        locales.remove(l)
    locales.insert(0, "en")
    print("Ungrouping locales: " + str(locales))
    N = len(locales)
    ungrouped = [list() for _ in range(N)]

    for i in range(len(lines)):
        ungrouped[i % N].append(lines[i])

    for i in range(N):
        write_in_last_dir(
            f"{locales[i]}/mapping.txt", "\n\n".join(ungrouped[i])
        )
