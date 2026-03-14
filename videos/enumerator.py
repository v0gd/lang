from client import *
import languages

role = """
You are provided with a list of text lines in a certain language.
1. For each line, you must assign a number to each word, starting with 1 for each new line.
2. Nouns and their corresponding articles or possessive pronouns must receive the same number.
3. Prepositions must be assigned the same number as their corresponding noun or pronoun, except when part of a prepositional verb.
   - In the case of prepositional verbs, the verb and preposition must share a number.
4. Idioms or common phrases should have all their words assigned the same number.
5. If a word appears more than once, each occurrence must have a unique number.
6. Modal verbs such as "need to", "must to", "want to", and others must have the same number assigned to both the verb and the "to" particle.
7. Auxiliary verbs "be", "have", "haben" (German), when used to indicate tense, must share the same number as the main verb.
8. The particle "not", "nicht" (German), "не" (Russian) must be assigned the same number as its corresponding word.
9. Words like "very", "really", "a little", "quite", "очень" (Russian), "sehr" (German) and others used to express the extent of adjectives and adverbs, must have the same number as the adjective or adverb they modify.



# Example input

Throw the garbage away, now!

Some Title

I don't like apples, but I like bananas. I do.

Hey, what's the fudge? Don't judge a book by its cover.

The red house is nice.

My hair are all over the place.

The duck swims, it is cool.

I need to wake up.

I jump out of the bed.

I jump out at you.

I am trying to make you laugh.

I have been killed.

I did not fucking do this.

Why didn't my alarm ring?

Today is a very important day because I have an exam at the university.

I wake up and look at my clock.

I am making coffee with one hand.

In my hurry

I need to hurry!

This is a little bit difficult.



# Example output

Throw(1) the(2) garbage(2) away(1), now(3)!

Some(1) Title(2)

I(1) don't(2) like(3) apples(4), but(5) I(6) like(7) bananas(8). I(9) do(10).

Hey(1), what's(2) the(3) fudge(3)? Don't(4) judge(4) a(4) book(4) by(4) its(4) cover(4).

The(1) red(2) house(1) is(3) nice(4).

My(1) hair(1) are(2) all(3) over(3) the(3) place(3).

The(1) duck(2) swims(3), it(4) is(5) cool(6).

I(1) need(2) to(2) wake(3) up(3).

I(1) jump(2) out(2) of(3) the(3) bed(3).

I(1) jump(2) out(2) at(3) you(3).

I(1) am(2) trying(2) to(2) make(3) you(4) laugh(5).

I(1) have(2) been(2) killed(2).

I(1) did(2) n0t(2) fucking(3) do(2) this(4).

Why(1) didn't(2) my(3) alarm(3) ring(2)?

Today(1) is(2) a(3) very(4) important(4) day(3) because(5) I(6) have(7) an(8) exam(8) at(9) the(9) university(9).

I(1) wake(2) up(2) and(3) look(4) at(5) my(5) clock(5).

I(1) am(2) making(2) coffee(3) with(4) one(4) hand(4).

In(1) my(1) hurry(1)

I(1) need(2) to(2) hurry(3)!

This(1) is(2) a(3) little(3) bit(3) difficult(3).



# Explanation of the example

First word of each line has number 1 assigned. Even if the previous line is not a complete sentence.

In the example "I don't like apples, but I like bananas. I do." all encounters of "I" and "like" have different numbers assigned.

"Throw away" is a prepositional verb, so both "throw" and "away" have the same number assigned.

"The garbage" and "the fudge" have the same number assigned both to the article and to the noun.

"Don't judge a book by its cover" and "all over the place" have the same numbers assigned to all words, because it's an idiom or common phrase.

In "The red house is nice." words "the" and "house" have the same number assigned (article and the corresponding noun), but adjective "red" has a different number assigned.

In the example "The duck swims, it is cool." the word "it" and "duck" have different numbers assigned, even if "it" refers to the "duck", because "it" is not an article.

In the cases "I jump out of the bed." and "I jump out at you." the words "jump" and "out" have the same number assigned, because the preposition is part of the prepositional verb. The words "of" and "the" have the same number assigned as the corresponding noun "bed". "At" and "you" have the same number assigned following the same logic.

"Am trying to" have the same number assigned, because "am" used to specify tense, and "to" belongs the the modal verb "try".

In "I have been killed" all the verbs "have", "been" and "killed" have the same number assigned, because "have" and "been" used to specify time.

In "I did not fucking do this." the verb "did" has the same number as the main verb "do" because is specifies time. The particle "not" has the same number assined as "did", because it inverses it. In the example "Why(1) didn't(2) my(3) alarm(3) ring(2)?" the words "didn't" and "ring" have the same number assigned for the same reasons.

In "Today(1) is(2) a(3) very(4) important(4) day(3) because(5) I(6) have(7) an(8) exam(8) at(9) the(9) university(9)." the words "very" and "important" have the same number, because "very" specifies strength of "important". "a" and "day" have the same number assigned, because they are an article and the corresponding noun.

In "I(1) wake(2) up(2) and(3) look(4) at(5) my(5) clock(5)." preposition and posessive pronoun "at" and "my" have the same number as the corresponding noun.

In "I(1) need(2) to(2) hurry(3)!" the words "need" and "hurry" have different numbers, because "need" is a modal verb, and it is not used to specify tense.
"""

# for locale in ["en"]:
#     filename = f"{locale}/story_ml.txt"
#     if path_in_last_dir_exists(filename):
#         continue

#     print(f"Running markup for {locale}...")
#     story = read_in_last_dir(f"{locale}/story.txt")
#     story_ml = gpt(role, story, True)
#     write_in_last_dir(filename, story_ml)


for l in languages.ALL.keys():
    print(f"Enumerating {l}")
    output_filename = f"{l}/mapping.txt"
    if not path_in_last_dir_exists(output_filename):
        print("enumerating")
        lines = read_lines(f"{l}/story.txt")
        enumerated = []
        for l in lines:
            tokens = l.split()
            enumerated.append(" ".join([f"{t}(0)" for t in tokens]))
        write_in_last_dir(output_filename, "\n\n".join(enumerated))
    else:
        print("enumeration exists, skipping")
