import os
import time
import re
import sys
from pathlib import Path
from openai import OpenAI
from story import VALID_LEVELS


def data_path(subpath=""):
    if subpath:
        return Path("/Users/bamboo/Desktop/data") / subpath
    else:
        return Path("/Users/bamboo/Desktop/data")


def relative_path(filename):
    return Path(__file__).parent / filename


def read_key():
    with open(relative_path("api_key"), "r", encoding="utf-8") as key:
        return key.read()


CLIENT = OpenAI(api_key=read_key())

# gpt_model = "gpt-4-1106-preview"  older one
# gpt_model = "gpt-4-0125-preview"
GPT_MODEL = "gpt-4"  # looks like the best model
FAST_GPT_MODEL = "gpt-3.5-turbo-0125"


def gpt(role, content, pedantic=False, fast=False):
    if pedantic:
        completion = CLIENT.chat.completions.create(
            model=(FAST_GPT_MODEL if fast else GPT_MODEL),
            messages=[
                {"role": "system", "content": role},
                {"role": "user", "content": content},
            ],
            frequency_penalty=0,
            presence_penalty=0,
            temperature=0,
        )
    else:
        completion = CLIENT.chat.completions.create(
            model=(FAST_GPT_MODEL if fast else GPT_MODEL),
            messages=[
                {"role": "system", "content": role},
                {"role": "user", "content": content},
            ],
        )
    print(elapsed_str())
    if completion.choices[0].finish_reason != "stop":
        raise RuntimeError(
            "Finished with non-stop reason "
            + completion.choices[0].finish_reason
        )
    return completion.choices[0].message.content


def gpt_multiturn(messages, pedantic=False, fast=False):
    if pedantic:
        completion = CLIENT.chat.completions.create(
            model=(FAST_GPT_MODEL if fast else GPT_MODEL),
            messages=messages,
            frequency_penalty=0,
            presence_penalty=0,
            temperature=0,
        )
    else:
        completion = CLIENT.chat.completions.create(
            model=(FAST_GPT_MODEL if fast else GPT_MODEL),
            messages=messages,
        )
    print(elapsed_str())
    if completion.choices[0].finish_reason != "stop":
        raise RuntimeError(
            "Finished with non-stop reason "
            + completion.choices[0].finish_reason
        )
    return completion.choices[0].message.content


def clean_strings(string_list):
    stripped_strings = [s.strip() for s in string_list]
    non_empty_strings = [s for s in stripped_strings if s]
    return non_empty_strings


def latest():
    print(f'Using sys arg for latest: "{sys.argv[1]}"')
    return sys.argv[1]


LATEST_DIR_NAME = latest()
print(f"Latest dir: '{LATEST_DIR_NAME}'")


def latest_dir():
    return data_path() / "stories" / LATEST_DIR_NAME


def path_in_last_dir(filename):
    return data_path() / "stories" / LATEST_DIR_NAME / filename


def path_in_last_dir_exists(filename):
    return os.path.exists(path_in_last_dir(filename))


def write_in_last_dir(filename, text):
    with open(path_in_last_dir(filename), "w", encoding="utf-8") as file:
        file.write(text)


def read_and_remove_union_numbers(path) -> str:
    text = read_in_last_dir(path)
    return re.sub(r"\(\d+(,\d+)*\)", "", text)


def read_lines(path) -> list[str]:
    return clean_strings(read_in_last_dir(path).splitlines())


def read_lines_and_remove_union_numbers(path) -> list[str]:
    return clean_strings(read_and_remove_union_numbers(path).splitlines())


def make_dir_in_last_dir(dirname):
    os.makedirs(path_in_last_dir(dirname), exist_ok=True)


def read_in_last_dir(filename):
    with open(path_in_last_dir(filename), "r", encoding="utf-8") as file:
        return file.read()


def read_latest_level_range() -> str:
    if path_in_last_dir_exists("level.txt"):
        levels = read_in_last_dir("level.txt").strip()
        assert levels in VALID_LEVELS, levels
        return levels
    elif LATEST_DIR_NAME.count("/") > 0:
        levels = LATEST_DIR_NAME.split("/")[-1]
        assert (
            levels in VALID_LEVELS
        ), f"Latest dir '{LATEST_DIR_NAME}' dir doesn't specify the level"
        return levels
    else:
        assert False, "Must specify a level range via levels.txt or dir name"


LATEST_LEVEL_RANGE = read_latest_level_range()
LATEST_LEVEL = LATEST_LEVEL_RANGE.split("_")[0]

print(f"Latest level range {LATEST_LEVEL_RANGE}, level {LATEST_LEVEL}")


start_time = time.time()


def elapsed_str():
    elapsed_time = time.time() - start_time
    return f"{elapsed_time:7.2f}s"
