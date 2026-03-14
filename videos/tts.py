from client import write_in_last_dir
from pathlib import Path
from elevenlabs import generate, play, voices, Voice, set_api_key, VoiceSettings


def relative_path(filename):
    return Path(__file__).parent / filename


def read_key():
    with open(relative_path("tts_key"), "r") as key:
        return key.read()


set_api_key(read_key())


CHUNK_SIZE = 1024


def tts(text, voice, output_filepath):
    audio = generate(
        text=text,
        voice=voice,
        model="eleven_multilingual_v2",
    )

    with open(output_filepath, "wb") as file:
        file.write(audio)


# print(str(voices()))
