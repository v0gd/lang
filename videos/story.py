from pathlib import Path
from dataclasses import dataclass
import re
import json

# Token groups for German language start with G, for Russian with R
TOKEN_GROUPS_REGEX = re.compile(r"\([GR]\d+(,[GR]\d+)*\)")

VALID_LEVELS = [
    "A1",
    "A1-A2",
    "A2",
    "A2-B1",
    "B1",
    "B1-B2",
    "B2",
    "B2-C1",
    "C1",
]


@dataclass
class Token:
    text: str
    group_ids: list[str]

    def to_str(self) -> str:
        if len(self.group_ids) == 0:
            return self.text
        groups = ",".join(self.group_ids)
        return f"{self.text}({groups})"


@dataclass
class Segment:
    tokens: list[Token]
    index: int

    def to_str(self) -> str:
        return " ".join(token.to_str() for token in self.tokens)

    def to_str_no_groups(self) -> str:
        return " ".join(token.text for token in self.tokens)


@dataclass
class Sentence:
    segments: list[Segment]
    index: int

    def to_plain_str(self) -> str:
        return " ".join(segment.to_str_no_groups() for segment in self.segments)


@dataclass
class Scene:
    sentences: list[Sentence]
    image_id: str | None


@dataclass
class Paragraph:
    scenes: list[Scene]
    image_id: str | None


@dataclass
class Chapter:
    title: str | None
    paragraphs: list[Paragraph]


@dataclass
class Story:
    title: str
    chapters: list[Chapter]
    image_id: str | None


@dataclass
class StoryMultilingual:
    id: str
    level: str
    localizations: dict[str, Story]


def _parse_sentence(line: str) -> Sentence:
    segments: list[Segment] = []
    line = line.replace("@", "\n")
    for segment in line.split("||"):
        segment = segment.rstrip()
        tokens: list[Token] = []
        for token in segment.split(" "):
            group_ids: list[str] = []
            match = TOKEN_GROUPS_REGEX.search(token)
            if match:
                group_ids = match.group().strip("()").split(",")
            text = re.sub(TOKEN_GROUPS_REGEX, "", token)
            tokens.append(Token(text=text, group_ids=group_ids))
        segments.append(Segment(tokens, index=0))
    return Sentence(segments, index=0)


def _recalculate_sentence_and_segment_indexes(story: StoryMultilingual) -> None:
    for story_localization in story.localizations.values():
        sentence_idx = 0
        segment_idx = 0
        for chapter in story_localization.chapters:
            for paragraph in chapter.paragraphs:
                for scene in paragraph.scenes:
                    for sentence in scene.sentences:
                        sentence.index = sentence_idx
                        sentence_idx += 1
                        for segment in sentence.segments:
                            segment.index = segment_idx
                            segment_idx += 1


def parse_story(lines: list[str]) -> StoryMultilingual:
    locales: list[str] = []
    current_locale_idx = 0
    stories: list[Story] = []
    story_id: str | None = None
    level: str | None = None

    def next_story_locale_idx() -> int:
        nonlocal current_locale_idx
        current_locale_idx = (current_locale_idx + 1) % len(locales)
        return current_locale_idx

    def start_stories(titles: list[str], image_id: str | None):
        assert len(titles) == len(locales)
        for title in titles:
            stories.append(Story(title=title, chapters=[], image_id=image_id))

    def ensure_chapters():
        for story in stories:
            if not story.chapters:
                story.chapters.append(Chapter(title=None, paragraphs=[]))

    def start_chapter(titles: list[str | None]):
        assert len(titles) == len(stories)
        for story, title in zip(stories, titles):
            story.chapters.append(Chapter(title=title, paragraphs=[]))

    def ensure_paragraphs():
        ensure_chapters()
        for story in stories:
            chapter = story.chapters[-1]
            if not chapter.paragraphs:
                chapter.paragraphs.append(Paragraph(scenes=[], image_id=None))

    def start_paragraph(image_id: str | None):
        ensure_chapters()
        for story in stories:
            chapter = story.chapters[-1]
            chapter.paragraphs.append(Paragraph(scenes=[], image_id=image_id))

    def ensure_scenes():
        ensure_paragraphs()
        for story in stories:
            chapter = story.chapters[-1]
            paragraph = chapter.paragraphs[-1]
            if not paragraph.scenes:
                paragraph.scenes.append(Scene(sentences=[], image_id=None))

    def start_scene(image_id: str | None):
        ensure_paragraphs()
        for story in stories:
            chapter = story.chapters[-1]
            paragraph = chapter.paragraphs[-1]
            paragraph.scenes.append(Scene(sentences=[], image_id=image_id))

    last_tag = ""
    for line in lines:
        try:
            line = line.strip()

            if line.startswith("#") or not line:
                continue

            if not story_id:
                story_id, level = line.split(maxsplit=1)
                assert level in VALID_LEVELS
                continue

            if not locales:
                locales = [l.strip() for l in line.split(",")]
                continue

            tag = line.split()[0] if line.startswith("/") else ""
            if tag != last_tag:
                assert current_locale_idx == 0, f"Line: {line}"
                last_tag = tag
            value = line[len(tag) :].strip()
            params = {}
            if tag and value:
                params = json.loads(value)

            if tag == "/t":
                start_stories(params["titles"], params.get("image_id"))
                continue

            if tag == "":
                ensure_scenes()
                sentence = _parse_sentence(value)
                stories[current_locale_idx].chapters[-1].paragraphs[-1].scenes[
                    -1
                ].sentences.append(sentence)
                next_story_locale_idx()
                continue

            if tag == "/s":
                start_scene(params.get("image_id"))
                continue

            if tag == "/p":
                start_paragraph(params.get("image_id"))
                continue

            if tag == "/c":
                titles = params.get("titles")
                if not titles:
                    titles = [None] * len(locales)
                start_chapter(titles)
                continue
        except Exception as e:
            print(f"Error on line: {line}")
            raise e

    assert current_locale_idx == 0
    assert story_id is not None
    assert level is not None

    story = StoryMultilingual(
        id=story_id,
        level=level,
        localizations={
            locale: story for locale, story in zip(locales, stories)
        },
    )
    _recalculate_sentence_and_segment_indexes(story)
    return story


if __name__ == "__main__":
    test_story_path = Path(
        "/mnt/hgfs/shared/data/stories/015-beneath-paint/C1/mapping_grouped_new_format.txt"
    )
    with open(test_story_path, "r", encoding="utf-8") as file:
        all_lines = file.read().splitlines()
    parsed_story = parse_story(all_lines)
    print(
        json.dumps(
            parsed_story,
            indent=1,
            ensure_ascii=False,
            default=lambda o: o.__dict__,
        )
    )
