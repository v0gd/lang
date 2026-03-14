from client import *
import languages

assert not path_in_last_dir_exists(
    "mapping_grouped.txt"
), "Grouped mapping already exists"

grouped = [[line] for line in read_lines("en/story.txt")]

exclude = []

flip = False
for l in sorted(languages.ALL.keys()):
    if l == "en" or l in exclude:
        continue
    lines = read_lines(f"{l}/story.txt")
    assert len(lines) == len(grouped)
    for i, line in enumerate(lines):
        grouped[i].append(line)

write_in_last_dir(
    "mapping_grouped.txt",
    "\n\n\n".join(["\n".join(group) for group in grouped]),
)
