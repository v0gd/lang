from dataclasses import dataclass
from pathlib import Path


@dataclass
class SentenceFlat:
    group_type: str | None
    group_data: str | None
    localizations: list[str]


@dataclass
class StoryMultilingualFlat:
    id: str
    locales: list[str]
    titles: list[str]
    sentences: list[SentenceFlat]


def _validate_story(story: StoryMultilingualFlat):
    if not story.locales:
        raise ValueError("Locales not found in the story")
    if len(story.locales) != len(story.titles):
        raise ValueError("Number of locales and titles do not match")
    for i, sentence in enumerate(story.sentences):
        if len(sentence.localizations) != len(story.locales):
            raise ValueError(
                f"Number of locales and sentences do not match for {i}th sentence"
            )


def parse_story(story_id: str, lines: list[str]) -> StoryMultilingualFlat:
    story = StoryMultilingualFlat(
        id=story_id, locales=[], titles=[], sentences=[]
    )
    group_type: str | None = None
    group_data: str | None = None
    for line in lines:
        line = line.strip()

        if line.startswith("#") or not line:
            continue

        if not story.locales:
            story.locales = [l.strip() for l in line.split(",")]
            continue

        tag = line.split()[0] if line.startswith("/") else ""
        value = line[len(tag) :].strip()

        if tag == "/t":
            story.titles.append(value)
            continue

        if tag == "":
            if not story.sentences or len(
                story.sentences[-1].localizations
            ) == len(story.locales):
                new_sentence = SentenceFlat(
                    group_type=group_type,
                    group_data=group_data,
                    localizations=[],
                )
                story.sentences.append(new_sentence)
            story.sentences[-1].localizations.append(value)
            group_type = ""
            group_data = ""

        group_type = tag if tag else None
        group_data = value if tag and value else None

    _validate_story(story)

    return story


if __name__ == "__main__":
    test_story_path = Path(
        "/mnt/hgfs/shared/data/stories/015-beneath-paint/C1/mapping_grouped_new_format.txt"
    )
    with open(test_story_path, "r", encoding="utf-8") as file:
        all_lines = file.read().splitlines()
    parsed_story = parse_story("015-beneath-paint", all_lines)
    print(parsed_story)
