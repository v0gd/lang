import re
import sys
import os
import subprocess
from dataclasses import dataclass, field
import numpy as np
from imageio.plugins.ffmpeg import get_exe
from moviepy.editor import (  # type: ignore
    AudioClip,
    VideoClip,
    VideoFileClip,
    AudioFileClip,
    ImageClip,
    TextClip,
    CompositeVideoClip,
    CompositeAudioClip,
    ColorClip,
    concatenate_audioclips,
    concatenate_videoclips,
)
from client import (
    LATEST_LEVEL,
    path_in_last_dir,
    data_path,
    clean_strings,
    read_in_last_dir,
    make_dir_in_last_dir,
    path_in_last_dir_exists,
    LATEST_LEVEL_RANGE,
    write_in_last_dir,
    elapsed_str,
    read_lines,
)
import languages
from painter import word_numbers
import video_description
import create_thumbnail
from tuple_hash import tuple_to_hash
from story import Story, StoryMultilingual, parse_story

# import groupun_mapping  # must go before mapper
# import mapper

FFMPEG_BINARY = get_exe()
SCHEMAS = {
    "A1": "lr",
    "A2": "lr",
    "B1": "rlf",
    "B2": "rlf",
    "C1": "rlf",
}
SCHEMA = SCHEMAS[LATEST_LEVEL]

FPS = 8
H = 360
PATTERN = {"intro", "text1", "trans1", "text2", "trans2", "text3", "outro"}
SENTENCES = list(range(6))


FORCE_FULL_CONTENT = False
if FORCE_FULL_CONTENT:
    PATTERN = {"intro", "text1", "trans1", "text2", "trans2", "text3", "outro"}
    SENTENCES = []


PREVIEW_TEXT = False
if PREVIEW_TEXT:
    H = 540
    if SCHEMA[0] == "l":
        PATTERN = {"text1"}
    elif SCHEMA[1] == "l":
        PATTERN = {"text2"}
    else:
        assert False
    SENTENCES = []

RENDER_IN_PARTS = False

FORCE_FINAL = False or (len(sys.argv) > 1)
if FORCE_FINAL:
    FPS = 24
    H = 1080
    PATTERN = {"intro", "text1", "trans1", "text2", "trans2", "text3", "outro"}
    SENTENCES = []
    PREVIEW_TEXT = False
else:
    RENDER_IN_PARTS = False


@dataclass
class VideoRenderingState:
    video_part_number: int = 0
    video_parts_rendered: list[str] = field(default_factory=list)
    video_parts_rendered_t: float = 0


@dataclass
class AudioFiles:
    normal: dict[str, list[str]] = field(default_factory=dict)
    slow: dict[str, list[str]] = field(default_factory=dict)
    words: dict[str, list[str]] = field(default_factory=dict)

    def __init__(self, l: str, r: str):
        self.normal = {l: [], r: []}
        self.slow = {l: [], r: []}
        self.words = {l: [], r: []}


def h_adjusted(value):
    if H == 720:
        return value
    return value * H / 720


# Required to silence pylint error of missing 'resize' method
def resized(clip, w, h):
    return clip.resize((w, h))


W = H // 9 * 16
DEFAULT_FONT = "Literata-Regular"
FONT_HIGHLIGHTED = "Literata-SemiBold"
TITLE_FONT = "Literata-Medium"
FONTSIZE = h_adjusted(
    55 if LATEST_LEVEL.startswith("A") else (44 if LATEST_LEVEL == "B2" else 42)
)
TITLE_FONTSIZE = h_adjusted(55)
LINES_LIMIT = 3
FONTSIZE_LINE_NUMBER_EXTENSION_LIMIT = h_adjusted(42)
FONT_SIZES = [h_adjusted(v) for v in [55, 44, 42]]
INTERLINE_INTERVAL = 1.2
TRANSITION_FONTSIZE = h_adjusted(51)
TEXT_BUBLE_Y_L = h_adjusted(500)
TEXT_BUBLE_Y_R = h_adjusted(0)
TEXT_BUBLE_HEIGHT = h_adjusted(206)
DEFAULT_TEXT_ALIGN = "center"
DIALOG_TEXT_ALIGN = "west"
TEXT_X_POSITION = h_adjusted(40)
R_COLOR = (0, 0, 0)
L_COLOR = (0, 0, 0)
DARKENING = 0.5
CROSS_CHAPTER_FADE_DURATION = 1.0
DARKENING_COLOR = (np.uint8(253), np.uint8(240), np.uint8(216))


# Returns image name and two bools:
# is the image first in the sequence and if the image is first and last in sequence.
def get_screen_image_path(
    image_ids: list[str], screen_idx: int, animated: bool
) -> tuple[str, bool, bool]:
    location = "../images/animated" if animated else "../images/1080p"
    ext = "mp4" if animated else "png"
    is_first = (
        screen_idx == 0 or image_ids[screen_idx - 1] != image_ids[screen_idx]
    )
    is_last = (
        screen_idx == len(image_ids) - 1
        or image_ids[screen_idx + 1] != image_ids[screen_idx]
    )
    return (
        str(path_in_last_dir(f"{location}/({image_ids[screen_idx]}).{ext}")),
        is_first,
        is_last,
    )


def read_exclude_list() -> list[int]:
    if path_in_last_dir_exists("exclude.txt"):
        content = read_in_last_dir("exclude.txt")
        return [
            int(line.strip()) for line in content.splitlines() if line.strip()
        ]
    else:
        return []


excluded = read_exclude_list()


def list_mp3_files(directory):
    mp3_files = []
    for filename in os.listdir(directory):
        if filename.endswith(".mp3"):
            mp3_files.append(filename)
    mp3_files.sort(key=lambda x: abs(int(x.split(".")[0])))
    return [str(directory / f) for f in mp3_files]


def read_sentences(locale, l, r):
    result = []
    lines = clean_strings(
        read_in_last_dir(f"{l}_{r}/{locale}.txt").splitlines()
    )
    for line in lines:
        line = line.replace("@", "\n")
        if line.startswith("+"):
            result[-1].append(line[1:])
        else:
            result.append([line])
    return result


def read_test_indices():
    return [int(v) for v in read_in_last_dir("test.txt").split()]


def remove_number_parentheses(s):
    pattern = r"\(\d+\)"
    return re.sub(pattern, "", s)


def remove_number_brackets(s):
    pattern = r"\[\d+\]"
    return re.sub(pattern, "", s)


def create_darkening_layer(duration):
    darkening_layer = ColorClip(
        (W, H), color=DARKENING_COLOR, duration=duration
    )
    darkening_layer = darkening_layer.set_opacity(DARKENING)
    return darkening_layer


def concatenate_with_silence(
    audio_clip_paths,
    silence_durations: list[float],
    volumes: list[float] | None = None,
    dynamic_silence_after_last=False,
):
    clips = []
    if silence_durations[0] > 0:
        silence = AudioClip(
            lambda t: [0] * 2, duration=silence_durations[0], fps=44100
        )
        clips.append(silence)
    for idx, paths in enumerate(audio_clip_paths):
        audio_clips = [AudioFileClip(path).subclip(0, -0.1) for path in paths]
        if volumes:
            for i, _ in enumerate(audio_clips):
                audio_clips[i] = audio_clips[i].volumex(volumes[idx])
        clips += audio_clips
        silence_duration = silence_durations[idx + 1]
        if dynamic_silence_after_last and idx == len(audio_clip_paths) - 1:
            duration = sum([c.duration for c in audio_clips])
            silence_duration = min(max(0.8 * duration, silence_duration), 2.5)
        if silence_duration > 0:
            silence = AudioClip(
                lambda t: [0] * 2, duration=silence_duration, fps=44100
            )
            clips.append(silence)
    return concatenate_audioclips(clips)


def make_composite_video_clip(clips: list):
    return CompositeVideoClip(
        clips,
        size=(W, H),
        bg_color=(np.uint8(0), np.uint8(0), np.uint8(0)),
        override_transparent=True,
    )


COLOR_COEF = 0.9
COLOR_MAP: dict[int, tuple[int, int, int]] = {
    0: (255, 255, 255),
    1: (80, 0, 0),
    2: (0, 80, 80),
    3: (0, 0, 120),
    4: (80, 80, 0),
    5: (80, 0, 100),
    6: (0, 80, 100),
    7: (135, 81, 16),
    8: (128, 20, 117),
    9: (29, 127, 18),
}
# color_map = {
#     0: (255, 255, 255),
#     1: (70, 0, 0),
#     2: (0, 70, 70),
#     3: (0, 0, 70),
#     4: (70, 70, 0),
#     5: (70, 0, 70),
#     6: (0, 70, 70),
#     7: (135, 81, 16),
#     8: (128, 20, 117),
#     9: (29, 127, 18),
# }
# invert colors
# for color_key, color_value in color_map.items():
#     m = max(color_value)
#     new_color_value = (
#         255 + color_value[0] - m,
#         255 + color_value[1] - m,
#         255 + color_value[2] - m,
#     )
#     color_map[color_key] = new_color_value

# color_map = {
#     0: "default",
#     1: (255, 255 - 80, 255 - 80),
#     2: (255 - 80, 255, 255),
#     3: (255 - 80, 255 - 80, 255),
#     4: (255, 255, 255 - 80),
#     5: (235, 175, 255),
#     6: (0, 80, 100),
#     7: (135, 81, 16),
#     8: (128, 20, 117),
#     9: (29, 127, 18),
# }


class ClipWithPosition:
    def __init__(self, clip, position):
        self.clip = clip
        self.position = position

    def update_position(self, position):
        self.clip = self.clip.set_position(position)
        self.position = position


def extract_clips(clips_with_positions: list[list[ClipWithPosition]]) -> list:
    return [c.clip for part in clips_with_positions for c in part]


def bounding_box(parts: list[list[ClipWithPosition]]):
    if not parts or not parts[0]:
        return None

    pos0 = parts[0][0].position
    clip0 = parts[0][0].clip
    min_x, min_y = pos0
    max_x, max_y = pos0[0] + clip0.size[0], pos0[1] + clip0.size[1]

    for part in parts:
        for clip in part:
            pos = clip.position
            clip_min_x, clip_min_y = pos
            clip_max_x, clip_max_y = (
                pos[0] + clip.clip.size[0],
                pos[1] + clip.clip.size[1],
            )

            min_x = min(min_x, clip_min_x)
            min_y = min(min_y, clip_min_y)
            max_x = max(max_x, clip_max_x)
            max_y = max(max_y, clip_max_y)

    return (min_x, min_y, max_x - min_x, max_y - min_y)


def move_text_clips(parts: list[list[ClipWithPosition]], x, y):
    if not parts or not parts[0]:
        return
    x0, y0, _, _ = bounding_box(parts)
    for part in parts:
        for clip in part:
            pos = (clip.position[0] - x0 + x, clip.position[1] - y0 + y)
            clip.update_position(pos)


_text_clip_cache: dict[str, VideoClip] = {}
_text_clip_cache_hit = 0
_text_clip_file_cache_hit = 0
_text_clip_cache_miss = 0


def get_text_clip_cached(text, font, fontsize, color):
    global _text_clip_cache_hit, _text_clip_cache_miss, _text_clip_file_cache_hit
    fontsize_floor = int(fontsize)
    if isinstance(color, str):
        clr = color
    else:
        clr = f"rgb({color[0]}, {color[1]}, {color[2]})"
    key = (text, font, fontsize_floor, clr)

    key_hash = tuple_to_hash(key)

    if key in _text_clip_cache:
        _text_clip_cache_hit += 1
    else:
        cached_filepath = data_path(f"rendered_text_cache/{key_hash}.png")
        if os.path.exists(cached_filepath):
            _text_clip_file_cache_hit += 1
            clip = ImageClip(str(cached_filepath))
        else:
            _text_clip_cache_miss += 1
            clip = TextClip(
                text,
                font=font,
                fontsize=fontsize,
                color=clr,
                tempfilename=str(cached_filepath),
                remove_temp=False,
            )
        _text_clip_cache[key] = clip
    return _text_clip_cache[key]


def colored_text_line(
    line_parts: list[str],
    fontsize: float,
    color: tuple[int, int, int],
    font=DEFAULT_FONT,
    paint_colors=True,
) -> list[list[ClipWithPosition]]:
    clips: list[VideoClip] = []
    for part in line_parts:
        tokens = word_numbers(part)
        # difficulties = union_difficulties(part)
        part_clips: list[VideoClip] = []
        for i, token in enumerate(tokens):
            # difficulty = (0 if i not in difficulties else difficulties[i])
            # if difficulty < 2:
            #     clip_color = color
            # else:
            should_paint = paint_colors and token[1] != 0
            clip_color = list(
                color if not should_paint else COLOR_MAP[(token[1] - 1) % 9 + 1]
            )
            clip_color = [int(c * COLOR_COEF) for c in list(clip_color)]
            text = token[0] if i == 0 else " " + token[0]
            if not text:
                continue
            clip_font = font if not should_paint else FONT_HIGHLIGHTED
            clip = ClipWithPosition(
                get_text_clip_cached(
                    text, font=clip_font, fontsize=fontsize, color=clip_color
                ),
                position=(0, 0),
            )
            if part_clips or (clips and clips[-1]):
                if part_clips:
                    last_clip = part_clips[-1]
                else:
                    last_clip = clips[-1][-1]
                position = (last_clip.position[0] + last_clip.clip.size[0], 0)
                clip.update_position(position)
            part_clips.append(clip)
        clips.append(part_clips)
    return clips


def text_clip(
    parts: list[str],
    fontsize: float,
    color: tuple[int, int, int],
    align: str,
    font=DEFAULT_FONT,
    paint_colors=True,
) -> list[list[ClipWithPosition]]:
    max_width = 0
    parts_clips: list[VideoClip] = []
    current_line: list[str] = []
    parts = list(parts)
    parts[-1] = parts[-1] + "\n"  # Add terminating EOL
    lines_clips = []
    line_idx = 0
    for part in parts:
        current_line.append("")
        parts_clips.append([])
        for c in part:
            if c == "\n":
                line_clips = colored_text_line(
                    current_line,
                    fontsize,
                    color,
                    font=font,
                    paint_colors=paint_colors,
                )
                lines_clips.append(line_clips)
                max_width = max(max_width, bounding_box(line_clips)[2])
                for i, clips in enumerate(line_clips):
                    parts_clips[-(len(line_clips) - i)] += clips
                current_line = [""]
                line_idx += 1
            else:
                current_line[-1] = current_line[-1] + c
    for i, line_clips in enumerate(lines_clips):
        width = bounding_box(line_clips)[2]
        x_offset = 0 if align == "west" else (max_width - width) / 2
        y_offset = i * fontsize * INTERLINE_INTERVAL
        move_text_clips(line_clips, x_offset, y_offset)
    return parts_clips


def next_smaller_font_size(fontsize):
    for size in FONT_SIZES:
        if size < fontsize - 1:
            return size
    assert False


# Returns wrapped text and required font size
def wrap_text(
    parts: list[str],
    fontsize,
    max_width=h_adjusted(1180),
    limit_num_of_lines=True,
    font=DEFAULT_FONT,
    color=L_COLOR,
) -> tuple[list[str], float]:
    lines_count_limit = LINES_LIMIT
    if fontsize <= FONTSIZE_LINE_NUMBER_EXTENSION_LIMIT + 1:
        lines_count_limit += 1
    lines_count_limit = max(lines_count_limit, "".join(parts).count("\n") + 1)
    wrapped_parts: list[str] = []
    line = ""
    safe_char_count = int(max_width / fontsize * 1.5)
    for part in parts:
        wrapped_part = None
        for word in part.split(" "):
            clean_word = remove_number_brackets(remove_number_parentheses(word))
            is_safe = len(" ".join([line, clean_word])) <= safe_char_count
            if (
                not is_safe
                and get_text_clip_cached(
                    " ".join([line, clean_word]),
                    font=font,
                    fontsize=fontsize,
                    color=color,
                ).size[0]
                > max_width
            ):
                wrapped_part = (
                    wrapped_part if wrapped_part is not None else ""
                ) + "\n"
                line = clean_word
            else:
                line += (
                    " " + clean_word
                    if (line and line[-1] != " ")
                    else clean_word
                )
                if wrapped_part is None:
                    wrapped_part = ""
                elif not wrapped_part.endswith("\n"):
                    wrapped_part = wrapped_part + " "
            wrapped_part += word
        wrapped_parts.append(wrapped_part if wrapped_part is not None else "")

    text = "".join(wrapped_parts)
    if limit_num_of_lines and len(text.split("\n")) > lines_count_limit:
        fontsize = next_smaller_font_size(fontsize)
        return wrap_text(
            parts,
            fontsize,
            max_width=max_width,
            limit_num_of_lines=True,
            font=font,
        )
    return (wrapped_parts, fontsize)


def text_clip_with_shadow(
    part_texts: list[str],
    fontsize: float,
    color: tuple[int, int, int],
    duration: float,
    align="center",
    x_position=-1,
    y_position=-1,
    fade_in=0.25,
    fade_out=0.25,
    target_height=-1,
    font=DEFAULT_FONT,
    paint_colors=True,
):
    part_texts, fontsize = wrap_text(
        part_texts,
        fontsize=fontsize,
        font=font,
        limit_num_of_lines=True,
        color=color,
    )
    parts = text_clip(
        part_texts,
        fontsize=fontsize,
        color=color,
        align=align,
        font=font,
        paint_colors=paint_colors,
    )
    bb = bounding_box(parts)
    if x_position == -1:
        x_position = W / 2 - bb[2] / 2
    if y_position == -1:
        y_position = H / 2 - bb[3] / 2
    elif target_height != -1:
        # Corrections is required because font rendering tends to allocate
        # more space on top of the rendered glyphs, so aligned text is not centered
        correction = fontsize / 12
        y_position += (target_height - bb[3]) / 2 - correction
    move_text_clips(parts, x_position, y_position)
    for part in parts:
        for clip in part:
            clip.clip = clip.clip.set_duration(duration)
            if fade_in > 0:
                clip.clip = clip.clip.crossfadein(fade_in)
            if fade_out > 0:
                clip.clip = clip.clip.crossfadeout(fade_out)
    return parts


def clean_missing_caption_unions(l_caption: list[str], r_caption: list[str]):
    # Some language pairs might have unions not present in both languages.
    # Remove counterparts of the missing unions.
    for i in range(10):
        l_has_union = any([f"({i})" in part for part in l_caption])
        r_has_union = any([f"({i})" in part for part in r_caption])
        if (l_has_union and not r_has_union) or (
            r_has_union and not l_has_union
        ):
            for j, _ in enumerate(l_caption):
                l_caption[j] = l_caption[j].replace(f"({i})", "")
                r_caption[j] = r_caption[j].replace(f"({i})", "")


last_image_display_t = 0
last_image_path = ""


def compile_segment(
    screen_idx,
    audio_idxs,
    l_caption: list[str],
    l_color,
    r_caption: list[str],
    r_color,
    final_audio_clips,
    pattern,
    is_last_screen: bool,
    segment_idx,
    audio_files: AudioFiles,
    opacities: list[float] | None = None,
    override_image_fadein=None,
    override_image_fadeout=None,
    paint_colors=True,
    l="l",
    r="r",
    render_subtitles=True,
    image_ids: list[str] = [],
):
    global last_image_display_t, last_image_path
    assert len(l_caption) == len(r_caption)
    clean_missing_caption_unions(l_caption, r_caption)
    if screen_idx in excluded:
        print(f"skipping sentence {screen_idx} due to exclusion")
        return
    if (
        len("".join(l_caption).strip()) == 0
        or len("".join(r_caption).strip()) == 0
    ):
        raise ValueError("empty caption")

    is_last_segment_of_screen = segment_idx == len(l_caption) - 1

    align = DEFAULT_TEXT_ALIGN
    if l_caption[0].startswith("-") or l_caption[0].startswith("—"):
        align = DIALOG_TEXT_ALIGN

    fade_in = 0.0
    fade_out = 0.0
    if not PREVIEW_TEXT:
        assert audio_files is not None
        dynamic = False
        segment_audio_files = []
        silences = []
        volumes = []
        nmb = ""
        for c in pattern:
            if c == "d":
                dynamic = True
            elif c == "l":
                segment_audio_files.append(
                    [
                        audio_files.normal[l][audio_idx]
                        for audio_idx in audio_idxs
                    ]
                )
                volumes.append(0.9)
            elif c == "r":
                segment_audio_files.append(
                    [
                        audio_files.normal[r][audio_idx]
                        for audio_idx in audio_idxs
                    ]
                )
                volumes.append(1)
            elif c == "w":
                segment_audio_files.append(
                    [
                        audio_files.words[r][audio_idx]
                        for audio_idx in audio_idxs
                    ]
                )
                volumes.append(1)
            elif c == "s":
                segment_audio_files.append(
                    [audio_files.slow[r][audio_idx] for audio_idx in audio_idxs]
                )
                volumes.append(1)
            elif c == " ":
                if nmb:
                    silences.append(int(nmb) / 10.0)
                nmb = ""
            elif c == "i":
                fade_in = 0.25
            elif c == "o":
                fade_out = (
                    0.25 if not is_last_screen else CROSS_CHAPTER_FADE_DURATION
                )
            else:
                nmb += c
        if nmb:
            if is_last_screen and is_last_segment_of_screen:
                silences.append(4.0)
            else:
                silences.append(int(nmb) / 10.0)

        audio_clip = concatenate_with_silence(
            segment_audio_files,
            silences,
            volumes,
            dynamic_silence_after_last=dynamic,
        )
        duration = audio_clip.duration
    else:
        audio_clip = None
        duration = 1

    max_fade_in = fade_in
    max_fade_out = fade_out

    # n_txt_clips = text_clip_with_shadow(
    #     [f'{idx}.'], page_fontsize, (163, 157, 137),
    #     audio_clip.duration, x_position= 1205, y_position=630)
    l_parts = text_clip_with_shadow(
        l_caption,
        (FONTSIZE if screen_idx > 0 else TITLE_FONTSIZE),
        l_color,
        1,
        align=align,
        x_position=(TEXT_X_POSITION if align != "center" else -1),
        y_position=TEXT_BUBLE_Y_L,
        fade_in=0,
        fade_out=0,
        target_height=TEXT_BUBLE_HEIGHT,
        font=(DEFAULT_FONT if screen_idx > 0 else TITLE_FONT),
        paint_colors=paint_colors,
    )
    r_parts = text_clip_with_shadow(
        r_caption,
        (FONTSIZE if screen_idx > 0 else TITLE_FONTSIZE),
        r_color,
        1,
        align=align,
        x_position=(TEXT_X_POSITION if align != "center" else -1),
        y_position=TEXT_BUBLE_Y_R,
        fade_in=0,
        fade_out=0,
        target_height=TEXT_BUBLE_HEIGHT,
        font=(DEFAULT_FONT if screen_idx > 0 else TITLE_FONT),
        paint_colors=paint_colors,
    )

    if opacities is not None:
        for i, opacity in enumerate(opacities):
            for j in range(len(l_parts[i])):
                l_parts[i][j].clip = l_parts[i][j].clip.set_opacity(opacity)
        for i, opacity in enumerate(opacities):
            for j in range(len(r_parts[i])):
                r_parts[i][j].clip = r_parts[i][j].clip.set_opacity(opacity)

    combined_text_clip = make_composite_video_clip(
        extract_clips(l_parts) + extract_clips(r_parts)
    )
    combined_text_clip = combined_text_clip.to_ImageClip(
        t=0.5, duration=duration
    )
    if fade_in > 0:
        combined_text_clip = combined_text_clip.crossfadein(
            fade_in
        )  # pylint: disable=no-member
    if fade_out > 0:
        combined_text_clip = combined_text_clip.crossfadeout(fade_out)

    text_bubles_clip = resized(
        ImageClip(str(data_path("text_bubles.png")), duration=duration), W, H
    )

    if PREVIEW_TEXT:
        if image_ids:
            image_path, _, _ = get_screen_image_path(
                image_ids, screen_idx, animated=False
            )
            image_clip = ImageClip(image_path, duration=duration).resize((W, H))
            clips = [image_clip, text_bubles_clip, combined_text_clip]
        else:
            clips = [text_bubles_clip, combined_text_clip]
        video_clip = make_composite_video_clip(clips)
        preview_dir_name = f"{l}_{r}/text_preview"
        make_dir_in_last_dir(preview_dir_name)
        filepath = path_in_last_dir(
            f"{preview_dir_name}/{screen_idx}_{segment_idx}.png"
        )
        video_clip.save_frame(str(filepath), t=0.5)
        final_audio_clips.append(video_clip)
    else:
        animated = not render_subtitles
        image_path, is_first_image, is_last_image = get_screen_image_path(
            image_ids, screen_idx, animated
        )
        if image_path != last_image_path:
            last_image_display_t = 0
        last_image_path = image_path
        is_first_segment_of_screen = segment_idx == 0
        is_first_image_of_screen = is_first_image and is_first_segment_of_screen
        is_last_image_of_screen = (
            is_last_image or is_last_screen
        ) and is_last_segment_of_screen
        if animated:
            image_clip = (
                VideoFileClip(image_path)
                .subclip(last_image_display_t, last_image_display_t + duration)
                .resize((W, H))
            )
        else:
            image_clip = resized(ImageClip(image_path, duration=duration), W, H)
        last_image_display_t += duration

        if (
            override_image_fadein is None and is_first_image_of_screen
        ) or override_image_fadein is True:
            image_clip = image_clip.crossfadein(CROSS_CHAPTER_FADE_DURATION)
            max_fade_in = max(max_fade_in, CROSS_CHAPTER_FADE_DURATION)

        if (
            override_image_fadeout is None and is_last_image_of_screen
        ) or override_image_fadeout is True:
            image_clip = image_clip.crossfadeout(CROSS_CHAPTER_FADE_DURATION)
            max_fade_out = max(max_fade_out, CROSS_CHAPTER_FADE_DURATION)

        if (
            screen_idx == 0
            and is_first_segment_of_screen
            and override_image_fadein is not False
        ):
            text_bubles_clip = text_bubles_clip.crossfadein(
                CROSS_CHAPTER_FADE_DURATION
            )
            max_fade_in = max(max_fade_in, CROSS_CHAPTER_FADE_DURATION)

        if (
            is_last_screen
            and is_last_segment_of_screen
            and override_image_fadeout is not False
        ):
            text_bubles_clip = text_bubles_clip.crossfadeout(
                CROSS_CHAPTER_FADE_DURATION
            )
            max_fade_out = max(max_fade_out, CROSS_CHAPTER_FADE_DURATION)

        clips = [image_clip]
        if render_subtitles:
            clips += [text_bubles_clip, combined_text_clip]
        video_clip = make_composite_video_clip(clips)
        if not animated:
            assert duration > max_fade_in + max_fade_out
            static_duration = duration - max_fade_in - max_fade_out
            static_image_clip = video_clip.to_ImageClip(
                t=max_fade_in + 0.1, duration=static_duration
            )
            if fade_in > 0 and fade_out > 0:
                video_clip = make_composite_video_clip(
                    [
                        video_clip.subclip(0, max_fade_in),
                        static_image_clip.set_start(max_fade_in),
                        video_clip.subclip(
                            max_fade_in + static_duration, duration
                        ).set_start(max_fade_in + static_duration),
                    ]
                )
            elif fade_in > 0:
                video_clip = make_composite_video_clip(
                    [
                        video_clip.subclip(0, max_fade_in),
                        static_image_clip.set_start(max_fade_in),
                    ]
                )
            elif fade_out > 0:
                video_clip = make_composite_video_clip(
                    [
                        static_image_clip,
                        video_clip.subclip(static_duration, duration).set_start(
                            static_duration
                        ),
                    ]
                )
            else:
                video_clip = static_image_clip
        video_clip = video_clip.set_audio(audio_clip)
        video_clip.set_duration(duration)
        final_audio_clips.append(video_clip)


AUDIO_PATTERNS = {
    "A1": {
        "main": "s",
        # r
        "1_r": "8 s 8",
        "m_r_silence_after": "8",
        "m_r_silence_before": "8",
        # lr
        "1_lr": "7 s 11 l 10 w 8 r 21",
        "m_lr": "7 l 10 w 10 r 19 ",
        "m_lr_silence_before": "7",
        "m_lr_silence_after": "21 d",
    },
    "A2": {
        "main": "s",
        "1_r": "8 s 8",
        "m_r_silence_before": "8",
        "m_r_silence_after": "8",
        "1_lr": "7 s 11 l 10 s 21 d",
        "m_lr": "7 l 10 s 19",
        "m_lr_silence_before": "7",
        "m_lr_silence_after": "21 d",
    },
    "B1": {
        "main": "r",
        "1_r": "6 r 6",
        "m_r_silence_before": "8",
        "m_r_silence_after": "8",
        "1_lr": "7 r 11 l 10 r 21",
        "m_lr": "7 l 10 r 17",
        "m_lr_silence_before": "7",
        "m_lr_silence_after": "21",
    },
    "B2": {
        "main": "r",
        "1_r": "6 r 6",
        "m_r_silence_before": "8",
        "m_r_silence_after": "8",
        "1_lr": "7 r 11 l 10 r 21",
        "m_lr": "7 l 10 r 17",
        "m_lr_silence_before": "7",
        "m_lr_silence_after": "21",
    },
    "C1": {
        "main": "r",
        "1_r": "6 r 6",
        "m_r_silence_before": "8",
        "m_r_silence_after": "8",
        "1_lr": "7 r 11 l 10 r 21",
        "m_lr": "7 l 10 r 17",
        "m_lr_silence_before": "7",
        "m_lr_silence_after": "21",
    },
}


def get_audio_pattern(key):
    return AUDIO_PATTERNS[LATEST_LEVEL][key]


def compile_test_screen(
    idx,
    audio_idx,
    l_caption: list[str],
    l_color,
    r_caption: list[str],
    r_color,
    final_audio_clips,
    audio_files: AudioFiles,
    image_ids: list[str],
):
    assert len(l_caption) == len(
        r_caption
    ), f"len {str(l_caption)} != {str(r_caption)}"
    compile_segment(
        idx,
        [audio_idx + i for i in range(len(l_caption))],
        ["???"],
        l_color,
        ["???"],
        r_color,
        final_audio_clips,
        "io 5 r 20 r 30",
        segment_idx=0,
        opacities=[1],
        is_last_screen=False,
        override_image_fadein=True,
        override_image_fadeout=False,
        paint_colors=False,
        audio_files=audio_files,
        image_ids=image_ids,
    )
    compile_segment(
        idx,
        [audio_idx + i for i in range(len(l_caption))],
        ["".join(l_caption)],
        l_color,
        ["".join(r_caption)],
        r_color,
        final_audio_clips,
        "io 5 l 10",
        segment_idx=0,
        opacities=[1],
        is_last_screen=False,
        override_image_fadein=False,
        override_image_fadeout=True,
        paint_colors=False,
        audio_files=audio_files,
        image_ids=image_ids,
    )


def compile_screen(
    idx,
    audio_idx,
    l_caption: list[str],
    l_color,
    r_caption: list[str],
    r_color,
    final_audio_clips,
    play_left: bool,
    is_last_screen: bool,
    l,
    r,
    render_subtitles: bool,
    audio_files: AudioFiles,
    image_ids: list[str],
):
    global last_image_path, last_image_display_t
    if len(l_caption) != len(r_caption):
        raise ValueError("caption sizes dont match")
    main_r = get_audio_pattern("main")
    if idx == 0:
        last_image_path = ""
        last_image_display_t = 0
    # 1-len caption
    if len(l_caption) == 1:
        if play_left:
            if idx == 0:
                pattern = "io 5 r 20 l 20"
            else:
                pattern = "io " + get_audio_pattern("1_lr")
        else:
            if idx == 0:
                pattern = "io 5 r 25"
            else:
                pattern = "io " + get_audio_pattern("1_r")
        compile_segment(
            idx,
            [audio_idx],
            l_caption,
            l_color,
            r_caption,
            r_color,
            final_audio_clips,
            pattern,
            segment_idx=0,
            opacities=[1],
            is_last_screen=is_last_screen,
            l=l,
            r=r,
            render_subtitles=render_subtitles,
            audio_files=audio_files,
            image_ids=image_ids,
        )
        return

    # m-len caption
    if play_left:
        # First, play the full r side
        for i in range(len(l_caption)):
            opacities: list[float] = [1] * len(l_caption)
            if i == 0:
                pattern = (
                    f'i {get_audio_pattern("m_lr_silence_before")} {main_r} 4'
                )
            elif i < len(l_caption) - 1:
                pattern = f"4 {main_r} 4"
            else:
                pattern = f"4 {main_r} 15"
            compile_segment(
                idx,
                [audio_idx + i],
                l_caption,
                l_color,
                r_caption,
                r_color,
                final_audio_clips,
                pattern,
                segment_idx=i,
                opacities=opacities,
                override_image_fadeout=False,
                is_last_screen=False,  # 'l' will follow
                l=l,
                r=r,
                render_subtitles=render_subtitles,
                audio_files=audio_files,
                image_ids=image_ids,
            )

        should_repeat_r_again = LATEST_LEVEL.startswith("A")

        # Then repeat l-r part by part
        for i in range(len(l_caption)):
            opacities = [0.4] * len(l_caption)
            opacities[i] = 1
            pattern = get_audio_pattern("m_lr")
            compile_segment(
                idx,
                [audio_idx + i],
                l_caption,
                l_color,
                r_caption,
                r_color,
                final_audio_clips,
                pattern,
                segment_idx=i,
                opacities=opacities,
                override_image_fadein=False,
                override_image_fadeout=False,  # The full sentence will follow
                is_last_screen=(is_last_screen and not should_repeat_r_again),
                l=l,
                r=r,
                render_subtitles=render_subtitles,
                audio_files=audio_files,
                image_ids=image_ids,
            )

        # Play full r side again, but only for A levels
        if should_repeat_r_again:
            for i in range(len(l_caption)):
                opacities = [1] * len(l_caption)
                if i == 0:
                    pattern = f'{get_audio_pattern("m_lr_silence_before")} r 4'
                elif i < len(l_caption) - 1:
                    pattern = "4 r 4"
                else:
                    pattern = f'o 4 r {get_audio_pattern("m_lr_silence_after")}'
                compile_segment(
                    idx,
                    [audio_idx + i],
                    l_caption,
                    l_color,
                    r_caption,
                    r_color,
                    final_audio_clips,
                    pattern,
                    segment_idx=i,
                    opacities=opacities,
                    override_image_fadein=False,
                    is_last_screen=is_last_screen,
                    l=l,
                    r=r,
                    render_subtitles=render_subtitles,
                    audio_files=audio_files,
                    image_ids=image_ids,
                )

    else:  # not play_left
        # Play full r side
        for i in range(len(l_caption)):
            opacities = [1] * len(l_caption)
            if i == 0:
                pattern = (
                    f'i {get_audio_pattern("m_r_silence_before")} {main_r} 4'
                )
            elif i < len(l_caption) - 1:
                pattern = f"4 {main_r} 4"
            else:
                pattern = (
                    f'o 4 {main_r} {get_audio_pattern("m_r_silence_after")}'
                )
            compile_segment(
                idx,
                [audio_idx + i],
                l_caption,
                l_color,
                r_caption,
                r_color,
                final_audio_clips,
                pattern,
                segment_idx=i,
                opacities=opacities,
                is_last_screen=is_last_screen,
                l=l,
                r=r,
                render_subtitles=render_subtitles,
                audio_files=audio_files,
                image_ids=image_ids,
            )


def compile_intro(
    l: str,
    r: str,
    final_audio_clips: list,
    rendering_state: VideoRenderingState,
) -> float:
    intro_chapter_end = 0

    print("Compiling intro")
    audio_video_structure = {
        "lr": f"{l}/intros/video_structure_l_r.mp3",
        "rl": f"{l}/intros/video_structure_r_l.mp3",
        "rlf": f"{l}/intros/video_structure_r_l_f.mp3",
    }[SCHEMA]
    audio_clips = [
        f"{l}/intros/hello_{l}_{r}.mp3",
        audio_video_structure,
        f"{l}/intros/levels.mp3",
        f"{l}/intros/like_subscribe.mp3",
    ]
    texts = {
        "lr": languages.intro_texts_l_r[l],
        "rl": languages.intro_texts_r_l[l],
        "rlf": languages.intro_texts_r_l_f[l],
    }[SCHEMA]
    t = 0
    for i, intro in enumerate(texts):
        intro_audio = AudioFileClip(str(data_path("intro.wav")))
        audio_clip = concatenate_with_silence(
            [[str(data_path(audio_clips[i]))]], [0, 1]
        )
        assert i < 4
        if i == 0:
            intro_clip = (
                VideoFileClip(
                    str(path_in_last_dir("../intro.mp4")), audio=False
                )
                .set_duration(audio_clip.duration)
                .resize((W, H))
            )
            level_overlay = ImageClip(
                str(data_path(f"levels/{LATEST_LEVEL_RANGE}.png")),
                duration=audio_clip.duration,
            )
            level_overlay = resized(level_overlay, W, H)
            # Intro audio value is adjusted
            intro_audio = intro_audio.set_duration(audio_clip.duration)
            audio_clip = CompositeAudioClip([audio_clip, intro_audio])
            video_clip = make_composite_video_clip([intro_clip, level_overlay])
            t += audio_clip.duration
        elif i == 1:
            intro_clip = VideoFileClip(
                str(path_in_last_dir("../intro.mp4")), audio=False
            )
            intro_clip = resized(intro_clip, W, H)
            intro_clip = intro_clip.subclip(t, t + audio_clip.duration)
            level_overlay = ImageClip(
                str(data_path(f"levels/{LATEST_LEVEL_RANGE}.png")),
                duration=audio_clip.duration,
            )
            level_overlay = resized(level_overlay, W, H)
            lines = clean_strings(intro.splitlines())
            txt_clips = []
            text_start_offset = 2
            for line_idx, line in enumerate(lines):
                line_clips = extract_clips(
                    text_clip_with_shadow(
                        [line],
                        fontsize=TRANSITION_FONTSIZE,
                        color=(0, 0, 0),
                        y_position=h_adjusted(
                            194 + (line_idx + (3 - len(lines)) / 2) * 108
                        ),
                        x_position=h_adjusted(128),
                        duration=audio_clip.duration
                        - [text_start_offset, 4, 8][line_idx],
                        align="west",
                        fade_in=1.5,
                    )
                )
                for clip_idx, c in enumerate(line_clips):
                    line_clips[clip_idx] = c.set_start(
                        [text_start_offset, 4, 8][line_idx]
                    )
                txt_clips += line_clips
            image_clip = ImageClip(
                str(data_path("image_blurred.png")),
                duration=audio_clip.duration - text_start_offset,
            )
            image_clip = resized(image_clip, W, H)
            image_clip = image_clip.crossfadein(CROSS_CHAPTER_FADE_DURATION)
            image_clip = image_clip.set_start(text_start_offset)
            darkening_layer = create_darkening_layer(
                audio_clip.duration - text_start_offset
            )
            darkening_layer = darkening_layer.set_start(text_start_offset)
            darkening_layer = darkening_layer.crossfadein(
                CROSS_CHAPTER_FADE_DURATION
            )
            video_clip = make_composite_video_clip(
                [intro_clip, level_overlay, image_clip, darkening_layer]
                + txt_clips
            )
            intro_audio = intro_audio.subclip(t, t + audio_clip.duration)
            t += audio_clip.duration
            audio_clip = CompositeAudioClip([audio_clip, intro_audio])
        elif i == 2:
            image_clip = ImageClip(
                str(data_path("image_blurred.png")),
                duration=audio_clip.duration,
            )
            image_clip = resized(image_clip, W, H)
            hand_clip = (
                VideoFileClip(
                    str(data_path("intro_hand.avi")), audio=False, has_mask=True
                )
                .set_duration(audio_clip.duration)
                .resize((W, H))
            )
            txt_clips = extract_clips(
                text_clip_with_shadow(
                    [intro],
                    fontsize=TRANSITION_FONTSIZE,
                    color=(0, 0, 0),
                    duration=audio_clip.duration,
                    y_position=h_adjusted(566),
                    align="center",
                )
            )
            darkening_layer = ColorClip(
                (W, H), color=DARKENING_COLOR, duration=audio_clip.duration
            ).set_opacity(DARKENING)
            video_clip = make_composite_video_clip(
                [image_clip, darkening_layer, hand_clip]
            )
            intro_audio = intro_audio.subclip(
                t, t + audio_clip.duration
            ).audio_fadeout(3)
            t += audio_clip.duration
            audio_clip = CompositeAudioClip([audio_clip, intro_audio])
            intro_chapter_end = (
                rendering_state.video_parts_rendered_t
                + get_total_duration(final_audio_clips)
                + audio_clip.duration
            )
        elif i == 3:
            image_clip = ImageClip(
                str(data_path("image_blurred.png")),
                duration=audio_clip.duration,
            )
            image_clip = resized(image_clip, W, H)
            txt_clips = extract_clips(
                text_clip_with_shadow(
                    [intro],
                    fontsize=TRANSITION_FONTSIZE,
                    color=(0, 0, 0),
                    duration=audio_clip.duration,
                    align="center",
                )
            )
            darkening_layer = ColorClip(
                image_clip.size,
                color=DARKENING_COLOR,
                duration=audio_clip.duration,
            ).set_opacity(DARKENING)
            video_clip = make_composite_video_clip(
                [image_clip, darkening_layer] + txt_clips
            )
        video_clip = video_clip.set_audio(
            audio_clip
        )  # .set_duration(audio_clip.duration)
        final_audio_clips.append(video_clip)
    render_part_if_required(final_audio_clips, l, r, rendering_state)
    return intro_chapter_end


def compile_without_translation(
    l_captions: list[list[str]],
    r_captions: list[list[str]],
    final_audio_clips: list,
    l: str,
    r: str,
    render_subtitles: bool,
    rendering_state: VideoRenderingState,
    audio_files: AudioFiles,
    image_ids: list[str],
):
    print("Compiling text without Translation")
    audio_idx = 0
    for i, l_caption in enumerate(l_captions):
        if not SENTENCES or i in SENTENCES:
            compile_screen(
                i,
                audio_idx,
                l_caption,
                L_COLOR,
                r_captions[i],
                R_COLOR,
                final_audio_clips,
                play_left=False,
                is_last_screen=(i == len(l_captions) - 1),
                l=l,
                r=r,
                render_subtitles=render_subtitles,
                audio_files=audio_files,
                image_ids=image_ids,
            )
            render_part_if_required(final_audio_clips, l, r, rendering_state)
        audio_idx += len(l_caption)


def compile_with_translation(
    l_captions: list[list[str]],
    r_captions: list[list[str]],
    final_audio_clips: list,
    l: str,
    r: str,
    rendering_state: VideoRenderingState,
    audio_files: AudioFiles,
    image_ids: list[str],
):
    print("Compiling text with Translation")
    audio_idx = 0
    for i, l_caption in enumerate(l_captions):
        if not SENTENCES or i in SENTENCES:
            compile_screen(
                i,
                audio_idx,
                l_caption,
                L_COLOR,
                r_captions[i],
                R_COLOR,
                final_audio_clips=final_audio_clips,
                play_left=True,
                is_last_screen=(i == len(l_captions) - 1),
                l=l,
                r=r,
                render_subtitles=True,
                audio_files=audio_files,
                image_ids=image_ids,
            )
            render_part_if_required(final_audio_clips, l, r, rendering_state)
        audio_idx += len(l_caption)


def compile_test(
    l_captions: list[list[str]],
    r_captions: list[list[str]],
    final_audio_clips: list,
    audio_files: AudioFiles,
    image_ids: list[str],
):
    print("Compiling test")
    audio_idx = 0
    test_indices = read_test_indices()
    test_to_audio_index_map = {}
    for i, l_caption in enumerate(l_captions):
        if i in test_indices:
            test_to_audio_index_map[i] = audio_idx
        audio_idx += len(l_caption)
    for i in test_indices:
        compile_test_screen(
            i,
            test_to_audio_index_map[i],
            l_captions[i],
            L_COLOR,
            r_captions[i],
            R_COLOR,
            final_audio_clips,
            audio_files=audio_files,
            image_ids=image_ids,
        )


def get_total_duration(clips) -> float:
    return sum([c.duration for c in clips])


def render(final_audio_clips, output_filename):
    print(f"Rendering {path_in_last_dir(output_filename)}")
    final_clip = concatenate_videoclips(final_audio_clips, method="compose")
    final_duration = sum([clip.duration for clip in final_audio_clips])
    final_clip = final_clip.set_duration(final_duration)
    final_clip.write_videofile(
        str(path_in_last_dir(output_filename)),
        fps=FPS,
        threads=(6 if RENDER_IN_PARTS else 24),
        codec="libx264",
    )


def concat(l, r, output_filename):
    print(f"Concating video clips {path_in_last_dir(output_filename)}")
    subprocess.run(
        [
            FFMPEG_BINARY,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(path_in_last_dir(f"{l}_{r}/parts/rendered.txt")),
            "-c",
            "copy",
            str(path_in_last_dir(output_filename)),
        ],
        check=True,
    )


def render_part_if_required(
    final_audio_clips: list, l: str, r: str, state: VideoRenderingState
):
    if not RENDER_IN_PARTS or PREVIEW_TEXT:
        return
    make_dir_in_last_dir(f"{l}_{r}/parts")
    filename = f"{l}_{r}/parts/{state.video_part_number}.mp4"
    render(final_audio_clips, filename)
    state.video_parts_rendered.append(str(path_in_last_dir(filename)))
    rendered_file_content = "\n".join(
        [f"file '{v}'" for v in state.video_parts_rendered]
    )
    write_in_last_dir(f"{l}_{r}/parts/rendered.txt", rendered_file_content)
    state.video_parts_rendered_t += get_total_duration(final_audio_clips)
    state.video_part_number += 1
    final_audio_clips.clear()
    print(f"{elapsed_str()}")


def max_text_to_audio_ratio(captions: list[list[str]], audio_paths: list[str]):
    max_ratio = 0
    max_idx = -1
    segments = [t for caption in captions for t in caption]
    for i in range(min(len(segments), len(audio_paths))):
        clip = AudioFileClip(audio_paths[i])
        assert len(segments[i]) > 0
        ratio = len(segments[i]) / clip.duration
        if ratio > max_ratio:
            max_ratio = ratio
            max_idx = i
    return max_idx


def count_segments(story: Story) -> int:
    cnt = 0
    for chapter in story.chapters:
        for paragraph in chapter.paragraphs:
            for scene in paragraph.scenes:
                for sentence in scene.sentences:
                    cnt += len(sentence.segments)
    return cnt


def story_to_captions(story: Story) -> list[list[str]]:
    captions = []
    captions.append([story.title])
    for chapter in story.chapters:
        for paragraph in chapter.paragraphs:
            for scene in paragraph.scenes:
                scene_captions = []
                for sentence in scene.sentences:
                    for i, segment in enumerate(sentence.segments):
                        segment_str = (" " if i > 0 else "") + segment.to_str()
                        scene_captions.append(segment_str)
                if scene_captions:
                    captions.append(scene_captions)
    return captions


def story_to_image_ids(story: Story) -> list[str]:
    if PREVIEW_TEXT and story.image_id is None:
        return []
    assert story.image_id is not None
    images = []
    images.append(story.image_id)
    for chapter in story.chapters:
        for paragraph in chapter.paragraphs:
            for scene in paragraph.scenes:
                if scene.image_id is None:
                    images.append(images[-1])
                else:
                    images.append(scene.image_id)
    return images


def create_video(story: StoryMultilingual, l: str, r: str):
    rendering_state = VideoRenderingState()
    t_text1, t_text2, t_text3 = 0.0, 0.0, 0.0

    l_story = story.localizations[l]
    r_story = story.localizations[r]
    l_captions = story_to_captions(l_story)
    r_captions = story_to_captions(r_story)
    image_ids = story_to_image_ids(l_story)

    audio_files = AudioFiles(l, r)

    if not PREVIEW_TEXT:
        audio_files.normal[l] = list_mp3_files(path_in_last_dir(f"{l}/audio"))
        audio_files.normal[r] = list_mp3_files(path_in_last_dir(f"{r}/audio"))

    if not PREVIEW_TEXT and path_in_last_dir_exists(f"{r}/audio_slow"):
        audio_files.slow[r] = list_mp3_files(
            path_in_last_dir(f"{r}/audio_slow")
        )

    if not PREVIEW_TEXT and path_in_last_dir_exists(f"{r}/audio_words"):
        audio_files.words[r] = list_mp3_files(
            path_in_last_dir(f"{r}/audio_words")
        )

    total_segment_count_with_title = count_segments(l_story) + 1
    assert (
        PREVIEW_TEXT
        or len(audio_files.normal[l]) == total_segment_count_with_title
        and len(audio_files.normal[r]) == total_segment_count_with_title
    ), (
        f"Max text to audio ratio l: {max_text_to_audio_ratio(l_captions, audio_files.normal[l])}\n"
        + f"Max text to audio ratio r: {max_text_to_audio_ratio(r_captions, audio_files.normal[r])}"
    )
    assert len(audio_files.slow[r]) == 0 or len(audio_files.slow[r]) == len(
        audio_files.normal[r]
    )
    assert len(audio_files.words[r]) == 0 or len(audio_files.words[r]) == len(
        audio_files.normal[r]
    )

    final_audio_clips: list[VideoClip] = []

    print(elapsed_str())

    if "intro" in PATTERN:
        t_text1 = compile_intro(l, r, final_audio_clips, rendering_state)
        print(elapsed_str())

    if "text1" in PATTERN:
        if SCHEMA[0] == "r":
            compile_without_translation(
                l_captions,
                r_captions,
                final_audio_clips,
                l=l,
                r=r,
                render_subtitles=True,
                rendering_state=rendering_state,
                audio_files=audio_files,
                image_ids=image_ids,
            )
        elif SCHEMA[0] == "l":
            compile_with_translation(
                l_captions,
                r_captions,
                final_audio_clips,
                l=l,
                r=r,
                rendering_state=rendering_state,
                audio_files=audio_files,
                image_ids=image_ids,
            )
        elif SCHEMA[0] == "f":
            compile_without_translation(
                l_captions,
                r_captions,
                final_audio_clips,
                l=l,
                r=r,
                render_subtitles=False,
                rendering_state=rendering_state,
                audio_files=audio_files,
                image_ids=image_ids,
            )
        else:
            assert False
        print(elapsed_str())

    # >>>> Transition 1
    print("Compiling Transition 1")
    if "trans1" in PATTERN:
        text = {
            "r": languages.transitions_r[l],
            "l": languages.transitions_l[l],
        }[SCHEMA[1]]
        audio_filename = {
            "r": f"{l}/transitions/right.mp3",
            "l": f"{l}/transitions/left.mp3",
        }[SCHEMA[1]]
        audio_clip = concatenate_with_silence(
            [[str(data_path(audio_filename))]], [0, 1]
        )
        txt_clips = extract_clips(
            text_clip_with_shadow(
                [text],
                fontsize=TRANSITION_FONTSIZE,
                color=(0, 0, 0),
                duration=audio_clip.duration,
            )
        )
        image_clip = ImageClip(
            str(data_path("image_blurred.png")), duration=audio_clip.duration
        )
        image_clip = resized(image_clip, W, H)
        darkening_layer = ColorClip(
            image_clip.size, color=DARKENING_COLOR, duration=audio_clip.duration
        ).set_opacity(DARKENING)
        video_clip = make_composite_video_clip(
            [image_clip, darkening_layer] + txt_clips
        )
        video_clip = video_clip.set_audio(audio_clip)
        final_audio_clips.append(video_clip)
        print(elapsed_str())

    # >>>> Text2
    t_text2 = rendering_state.video_parts_rendered_t + get_total_duration(
        final_audio_clips
    )
    if "text2" in PATTERN:
        if SCHEMA[1] == "l":
            compile_with_translation(
                l_captions,
                r_captions,
                final_audio_clips,
                l=l,
                r=r,
                rendering_state=rendering_state,
                audio_files=audio_files,
                image_ids=image_ids,
            )
        elif SCHEMA[1] == "r":
            compile_without_translation(
                l_captions,
                r_captions,
                final_audio_clips,
                l=l,
                r=r,
                render_subtitles=True,
                rendering_state=rendering_state,
                audio_files=audio_files,
                image_ids=image_ids,
            )
        elif SCHEMA[1] == "f":
            compile_without_translation(
                l_captions,
                r_captions,
                final_audio_clips,
                l=l,
                r=r,
                render_subtitles=False,
                rendering_state=rendering_state,
                audio_files=audio_files,
                image_ids=image_ids,
            )
        else:
            assert False
        print(elapsed_str())

    if len(SCHEMA) >= 3 and "trans2" in PATTERN:
        # >>>> Transition 2
        print("Compiling Transition 2")
        text = {
            "r": languages.transitions_r[l],
            "f": languages.transitions_r[l],
            "l": languages.transitions_l[l],
        }[SCHEMA[2]]
        audio_filename = {
            "r": f"{l}/transitions/right.mp3",
            "f": f"{l}/transitions/right.mp3",
            "l": f"{l}/transitions/left.mp3",
        }[SCHEMA[2]]
        audio_clip = concatenate_with_silence(
            [[str(data_path(audio_filename))]], [0, 1]
        )
        txt_clips = extract_clips(
            text_clip_with_shadow(
                [text],
                fontsize=TRANSITION_FONTSIZE,
                color=(0, 0, 0),
                duration=audio_clip.duration,
            )
        )
        image_clip = ImageClip(
            str(data_path("image_blurred.png")), duration=audio_clip.duration
        )
        image_clip = resized(image_clip, W, H)
        darkening_layer = ColorClip(
            image_clip.size, color=DARKENING_COLOR, duration=audio_clip.duration
        ).set_opacity(DARKENING)
        video_clip = make_composite_video_clip(
            [image_clip, darkening_layer] + txt_clips
        )
        video_clip = video_clip.set_audio(audio_clip)
        final_audio_clips.append(video_clip)

    t_text3 = rendering_state.video_parts_rendered_t + get_total_duration(
        final_audio_clips
    )

    # >>>> Test
    if len(SCHEMA) >= 3 and "text3" in PATTERN:
        if SCHEMA[2] == "f":
            compile_without_translation(
                l_captions,
                r_captions,
                final_audio_clips,
                l=l,
                r=r,
                render_subtitles=False,
                rendering_state=rendering_state,
                audio_files=audio_files,
                image_ids=image_ids,
            )
        else:
            assert False
        # compile_test(l_captions, r_captions, final_audio_clips)

    # >>>> Thank you for watching
    if "outro" in PATTERN:
        print("Compiling outro")
        outro_duration = 10
        thanks_txt_clips = extract_clips(
            text_clip_with_shadow(
                [languages.thanks[l]],
                TRANSITION_FONTSIZE,
                (0, 0, 0),
                outro_duration,
                y_position=h_adjusted(500),
            )
        )
        thanks_image_clip = ImageClip(
            str(data_path("image_blurred.png")), duration=outro_duration
        )
        image_clip = resized(image_clip, W, H)
        darkening_layer = ColorClip(
            thanks_image_clip.size,
            color=DARKENING_COLOR,
            duration=outro_duration,
        ).set_opacity(DARKENING)
        thanks_video_clip = make_composite_video_clip(
            [thanks_image_clip, darkening_layer] + thanks_txt_clips
        )
        outro_audio = AudioFileClip(str(data_path("outro.wav")))
        outro_audio = outro_audio.set_start(1)
        outro_audio = (
            outro_audio.set_duration(outro_duration - 1)
            .audio_fadein(3)
            .audio_fadeout(3)
            .volumex(0.5)
        )
        thanks_video_clip = thanks_video_clip.set_audio(outro_audio)
        final_audio_clips.append(thanks_video_clip)
        print(elapsed_str())
        render_part_if_required(final_audio_clips, l, r, rendering_state)

    # Concatenate all the video clips
    print(
        f"text cache hit rate (h/f/t): {_text_clip_cache_hit}/{_text_clip_file_cache_hit}/{_text_clip_cache_hit + _text_clip_cache_miss + _text_clip_file_cache_hit}"
    )

    if not PREVIEW_TEXT:
        out_filename_suffix = "final" if FORCE_FINAL else "preview"
        if RENDER_IN_PARTS:
            concat(l, r, f"{l}_{r}/{out_filename_suffix}.mp4")
        else:
            render(final_audio_clips, f"{l}_{r}/{out_filename_suffix}.mp4")
        print(f"{elapsed_str()}")

        write_in_last_dir(
            f"{l}_{r}/video_description_{out_filename_suffix}.txt",
            video_description.create_description(
                l, r, SCHEMA, t_text1, t_text2, t_text3
            ),
        )

        create_thumbnail.create_thumbnail(l, r)


def create_video_for_all_pairs():
    lines = read_lines("mapping_grouped_new_format.txt")
    story = parse_story(lines)
    for l, r in languages.pairs:
        print(f"Creating video {l}->{r}")
        create_video(story, l, r)


if __name__ == "__main__":
    create_video_for_all_pairs()
