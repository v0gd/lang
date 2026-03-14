from client import *
import shutil, re


role = """Given pairs of text translated in 2 languages, where some words of the first text of each pair have numbers assigned to it, find which words of the second text correspond to the words with numbers in the first text and add the corresponding numbers. Many-to-many relationship is possible, meaning that some words in the seconds texts can correspond to multiple words in the first text and wise versa. Output only the second line of each pair with numbers assigned and don't change the sentences.


# Example 1 input
Ich bin Gruut(1). Gruut(2).
I am Groot. Groot.

Willst(2) du etwas(3)?
Do you want something?

Do(1) you want(3) something(5)?
Willst du etwas?

# Example 1 output
I am Groot(1). Groot(2).

Do(2) you want(2) something(3)?

Willst(1,3) du etwas(5)?

# Example 1 explanation
Output contains only the second line of each pair from the input. Output has number assigned.

First "Groot" corresponds to the first "Gruut" and the second "Groot" corresponds to the second "Gruut".

The combination of "do" and "want" in Egnlish questions corresponds to one word "Willst" in German.



# Example 2 input
But, when(2) I get(4) to(5) the(5) bus(5) stop(5),
Aber als ich an der Bushaltestelle ankomme,

+ I see(7) that(8) there(9) are(10) no(11) buses(11).
+ sehe ich, dass keine Busse fahren.

I grab(1) my(3) bag(3), my(4) books(4), and I run(7) to(8) the(8) bus(8) stop(8).
Ich schnappe mir meine Tasche, meine Bücher und renne zur Bushaltestelle.

But(1) as(2) I(3) am(4) running(5), it(6) starts(7) to(8) rain(8).
Aber während ich laufe, fängt es an zu regnen.


# Example 2 output
Aber als(2) ich an(5) der(5) Bushaltestelle(5) ankomme(4,5),

+ sehe(6) ich, dass(8) keine(11) Busse(11) fahren.

Ich schnappe(1) mir(1) meine(3) Tasche(3), meine(4) Bücher(4) und renne(7) zur(8) Bushaltestelle(8).

Aber(1) während(2) ich(3) laufe(4,5), fängt(7) es(6) an(7) zu(8) regnen(8).


# Example 2 explanation
The word "ankomme" corresponds to "get to" in english, this is why it has 2 numbers assigned.

If a text line starts with "+", the "+" sign also appears in the output.

There is no corresponding word for "fahren" in the first sentence, this is why it has no number assigned to it.

There is many-to-one relationship between "Schnappe mir" and "grab".

There is many-to-many relationship between "Zur Bushaltestelle" and "to(8) the(8) bus(8) stop(8)".

Word "laufe" in german replaces multiple words ("am running") in English.
"""

difficulty_role = """
Given a list of text lines, for each word, add the word difficulty level in parentheses next to the word, where difficulty is measured from 0 to 10. Difficulty is assessed NOT by the length of the word or its typing complexity, but by how late it is taught in language education programs (A1 through C2). Here is the table of language levels and their corresponding scores:

A1: 0-3
A2: 4-6
B1: 7-8
B2: 9
C1: 10
C2: 10

For example, words like "I" and "and" should have a difficulty of 0, "your" or "very" a difficulty of 1, "probably" a difficulty of 4, "multiplication" a difficulty of 6, and "defenestration" a difficulty of 10.

The context of the word should be considered, with examples:
1. If a word is part of a phrasal verb, the complexity of the phrasal verb should be assigned to the verb. For instance, "take" is learned very early and should have a difficulty of 2, while "take over" is taught at the B1 level and should have a difficulty of 8.
2. The word "flat" in the phrase "a flat field" has a difficulty of 3, while "flat" in "a flat tire" has a difficulty of 7, because it is taught at the B1 level.

# Example input
I like your charisma, defenestration.

Or not.

Throw an apple.

Throw the garbage away.

The field is flat.

This note in the song is flat.

Grab the hay with
+ your pitchforks,
+ folks!


# Example output
I[0] like[1] your[1] charisma[7], defenestration[10].

Or[0] not[0].

Throw[3] an[0] apple[1].

Throw[5] the[0] garbage[4] away[5].

The[0] field[3] is[0] flat[3].

This[1] note[6] in[0] the[0] song[3] is[0] flat[8].

Grab[7] the[0] hay[7]
+ with[1] your[1] pitchforks[8],
+ folks[6]!

# Example explanation
"Throw" in "Throw an apple." has difficulty 3, while in "Throw the garbage away." it has difficulty 5, because it's part of a phrasal verb which is taught later.

"Flat" in "The field is flat" has difficulty 3, while in "This note in the song is flat." it has difficulty 8, because the phrase "a flat note" corresponds to the B1 level.

The formatting is preserved, in "Grab the hay with+ your pitchforks,+ folks!" each plus sign and the corresponding parts of the sentence go on the new line.
"""


def map_and_cache(
    lines_ref_n, locale_ref, lines, locale, override_mapping=False
) -> list[str]:
    mapping_filename = f"{locale}/mapping.txt"
    if override_mapping:
        assert path_in_last_dir_exists(mapping_filename)
        print(f"Re-mapping {locale}->{locale_ref}...")
        shutil.copy2(
            path_in_last_dir(mapping_filename),
            path_in_last_dir(mapping_filename + ".bac"),
        )
        lines = read_lines_and_remove_union_numbers(mapping_filename)
        assert len(lines) == len(lines_ref_n)
        request = "\n".join(
            [l + "\n" + r + "\n" for (l, r) in zip(lines_ref_n, lines)]
        )
        response = gpt(role, request, True)
        pattern = r"\n{2,}(?=\+\s)"
        response = re.sub(pattern, "\n", response)
        write_in_last_dir(
            mapping_filename + ".log.txt",
            f"Request\n{request}\n\n\n\nResponse:\n{response}",
        )
        lines_n = clean_strings(response.splitlines())
        write_in_last_dir(mapping_filename, "\n\n".join(lines_n))
    elif not path_in_last_dir_exists(mapping_filename):
        print(f"Mapping {locale}->{locale_ref}...")
        assert len(lines) == len(
            lines_ref_n
        ), f"{len(lines)} != {len(lines_ref_n)}"
        request = "\n".join(
            [l + "\n" + r + "\n" for (l, r) in zip(lines_ref_n, lines)]
        )
        response = gpt(role, request, True)
        write_in_last_dir(
            mapping_filename + ".log.txt",
            f"Request\n{request}\n\n\n\nResponse:\n{response}",
        )
        lines_n = clean_strings(response.splitlines())
        write_in_last_dir(mapping_filename, "\n\n".join(lines_n))
    lines_n = read_lines(mapping_filename)
    return lines_n
