from mapper_lib import *
import languages

visited = set(["en"])
for l, r in languages.pairs:
    for locale in [l, r]:
        if locale in visited:
            continue
        visited.add(l)
        map_and_cache(
            read_lines("en/story_ml.txt"),
            "en",
            [],
            locale,
            override_mapping=False,
        )
