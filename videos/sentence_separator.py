from client import *
import languages
import difflib

request = """For a give text place each sentence of the text on a new line and print the result, for example:
# Input
Nice day story

Today is a nice day. She says "Wow!" What a journey.

And then the day end. Bye-bye.

# Output 
Nice day story

Today is a nice day.

She says "Wow!"

What a journey.

And then the day end.

Bye-bye.



Here is the text:
"""

for l in languages.ALL.keys():
    for prefix in ["tr", "story"]:
        input_filename = f"{l}/{prefix}_raw.txt"
        output_filename = f"{l}/{prefix}.txt"
        if path_in_last_dir_exists(
            input_filename
        ) and not path_in_last_dir_exists(output_filename):
            print(f"Processing {input_filename}")
            story = gpt_multiturn(
                [
                    {
                        "role": "user",
                        "content": request + read_in_last_dir(input_filename),
                    }
                ],
                pedantic=True,
                fast=True,
            )
            write_in_last_dir(output_filename, story)
            input_words = " ".join(read_lines(input_filename)).split()
            output_words = " ".join(read_lines(output_filename)).split()
            diff = list(difflib.unified_diff(input_words, output_words))
            print("Diff: " + "\n".join(diff))
