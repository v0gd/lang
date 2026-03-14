from client import *
from difflib import SequenceMatcher
from mapper_lib import *
import languages
import re


ENABLE_DIFFICULTIES = False


def extract_number_in_brackets(s):
    match = re.search(r"\[(\d+)\]", s)
    if match:
        new_s = re.sub(r"\[\d+\]", "", s)
        number = int(match.group(1))
        return new_s, number
    else:
        return s, 0


def extract_number_in_paranthesis(s: str) -> tuple[str, list[int]]:
    match = re.search(r"\((\d+(,\d+)*)\)", s)
    if match:
        new_s = re.sub(r"\(\d+(,\d+)*\)", "", s)
        numbers = [int(n) for n in match.group(1).split(",")]
        return new_s, numbers
    else:
        return s, [0]


def get_tokens_with_numbers(lines_n: list[str]) -> list[list[(str, list[int])]]:
    result = []
    for line in lines_n:
        tokens = line.split()
        line_numbers = []
        for token in tokens:
            line_numbers.append(extract_number_in_paranthesis(token))
        result.append(line_numbers)
    return result


def get_tokens(lines: list[str]) -> list[list[str]]:
    return [line.split() for line in lines]


def get_mapping_request_text(lines_n, lines) -> str:
    return "\n".join([l + "\n" + r + "\n" for (l, r) in zip(lines_n, lines)])


def find_ref_idxs(ref, tokens_n: list[tuple[str, list[int]]]) -> list[int]:
    result = []
    for i, t in enumerate(tokens_n):
        if ref in t[1]:
            result.append(i)
    return result


class Union:
    def __init__(self, id, elements=set()):
        self.id = id
        self.elements = elements

    def update_id_if_smaller(self, new_id):
        if new_id < self.id:
            self.id = new_id


def add_graph_edge(
    unions: list[Union],
    k1: tuple[str, int],
    k2: tuple[str, int],
    element_id: int,
):
    # 'element_id' - assuming the key would create a union, which id would it have?
    idx1, idx2 = -1, -1
    for i, u in enumerate(unions):
        if k1 in u.elements:
            idx1 = i
            u.elements.add(k2)
            u.update_id_if_smaller(element_id)
            continue
        if k2 in u.elements:
            idx2 = i
            u.elements.add(k1)
            u.update_id_if_smaller(element_id)
            continue
    if idx1 >= 0 and idx2 >= 0 and idx1 != idx2:
        # Merge 2 unions
        unions[idx1].elements.update(unions[idx2].elements)
        unions[idx1].update_id_if_smaller(new_id=unions[idx2].id)
        unions.pop(idx2)
    if idx1 == -1 and idx2 == -1:
        # No unions containing the keys found, add new union
        unions.append(Union(id=element_id, elements=set([k1, k2])))


def add_single_vertex(unions: list[Union], k: tuple[str, int], element_id: int):
    for u in unions:
        if k in u.elements:
            return
    unions.append(Union(id=element_id, elements=set([k])))


def update_unions_single(
    unions: list[Union], tokens_n: list[tuple[str, list[int]]], locale: str
):
    for i in range(len(tokens_n)):
        left_key = (locale, i)
        refs = tokens_n[i][1]
        if refs == [0]:
            # No refs, just add the word alone,
            # but check first, that it is not already added
            found = False
            for u in unions:
                if left_key in u.elements:
                    found = True
                    break
            if not found:
                unions.append(Union(id=0, elements=set([left_key])))
            continue
        for r in refs:
            if r == 0:
                continue
            for s_idx in find_ref_idxs(r, tokens_n):
                right_key = (locale, s_idx)
                add_graph_edge(unions, left_key, right_key, r)


def update_unions_mapped(
    unions: list[Union],
    mapped_tokens_n: list[tuple[str, list[int]]],
    mapped_locale: str,
    source_tokens_n: list[tuple[str, list[int]]],
    source_locale: str,
):
    for i in range(len(mapped_tokens_n)):
        key = (mapped_locale, i)
        refs = mapped_tokens_n[i][1]
        if refs == [0]:
            unions.append(Union(id=0, elements=set([key])))
            continue
        for r in refs:
            if r == 0:
                continue
            for s_idx in find_ref_idxs(r, source_tokens_n):
                source_key = (source_locale, s_idx)
                add_graph_edge(unions, key, source_key, r)
    for i in range(len(source_tokens_n)):
        key = (source_locale, i)
        add_single_vertex(unions, key, min(source_tokens_n[i][1]))


def count_locales_in_union(union: Union, l: str, r: str):
    return len([k for k in union.elements if k[0] in [l, r]])


def stitch_line_n_together(
    unions, union_difficulties, tokens, locale, second_locale
):
    tokens_n = list(tokens)
    visited_unions = set()
    for i in range(len(tokens)):
        if i == 0 and tokens[0][0] == "+":
            continue
        key = (locale, i)
        found = False
        for j, union in enumerate(unions):
            if key not in union.elements:
                continue
            found = True
            token_id = union.id
            union_size = count_locales_in_union(union, locale, second_locale)
            if len(unions) == 1 or union_size == 1:
                token_id = 0
            difficulty = union_difficulties[j] if ENABLE_DIFFICULTIES else 0
            if token_id > 0:
                tokens_n[i] = tokens_n[i] + f"({token_id})"
                if ENABLE_DIFFICULTIES and union.id not in visited_unions:
                    tokens_n[i] = tokens_n[i] + f"[{difficulty}]"
                    visited_unions.add(union.id)
            break
        assert found, f"tokens are: {str(tokens)}"
    return " ".join(tokens_n)


def get_en_word_difficulties_per_line(en_tokens_n):
    word_difficulties_per_line = []
    difficulty_filename = "en/word_level.txt"
    if not path_in_last_dir_exists(difficulty_filename):
        story = read_and_remove_union_numbers("en/mapping.txt")
        print("Assigning word difficulty...")
        difficulty_text = gpt(difficulty_role, story)
        write_in_last_dir(
            difficulty_filename + ".log.txt",
            f"Request:\n{story}\n\n\nResponse:\n{difficulty_text}",
        )
        write_in_last_dir(difficulty_filename, difficulty_text)
    difficulties = get_tokens(read_lines(difficulty_filename))
    assert len(difficulties) == len(en_tokens_n)
    for i in range(len(en_tokens_n)):
        assert len(difficulties[i]) == len(
            en_tokens_n[i]
        ), f"{str(difficulties[i])} != {str(en_tokens_n[i])}"
        line_difficulties = []
        for j in range(len(en_tokens_n[i])):
            word, difficulty = extract_number_in_brackets(difficulties[i][j])
            token_word, _ = en_tokens_n[i][j]
            assert SequenceMatcher(None, word, token_word).ratio() >= 0.65
            line_difficulties.append(difficulty)
        word_difficulties_per_line.append(line_difficulties)
    return word_difficulties_per_line


def get_translated_line_unions(
    en_tokens_n, l_to_en_map, l_locale, r_to_en_map, r_locale
):
    unions = []
    update_unions_single(unions, en_tokens_n, "en")
    update_unions_mapped(unions, l_to_en_map, l_locale, en_tokens_n, "en")
    update_unions_mapped(unions, r_to_en_map, r_locale, en_tokens_n, "en")
    return unions


def get_union_difficulties(unions, en_word_difficulties):
    "Unions must contain en keys. For each union takes max en key difficulty."
    result = []
    for union in unions:
        max_difficulty = 0
        for key in union.elements:
            if key[0] != "en":
                continue
            max_difficulty = max(max_difficulty, en_word_difficulties[key[1]])
        result.append(max_difficulty)
    return result


en_lines = read_lines_and_remove_union_numbers("en/mapping.txt")
en_tokens_n = get_tokens_with_numbers(read_lines("en/mapping.txt"))
if ENABLE_DIFFICULTIES:
    en_word_difficulties_per_line = get_en_word_difficulties_per_line(
        en_tokens_n
    )
else:
    en_word_difficulties_per_line = []
for l, r in languages.pairs:
    print(f"Mapping {l} to {r}...")
    if l == "en":
        l_tokens = get_tokens(
            read_lines_and_remove_union_numbers(f"en/mapping.txt")
        )
    else:
        map_and_cache(
            read_lines("en/mapping.txt"), "en", read_lines(f"{l}/story.txt"), l
        )
        l_tokens = get_tokens(
            read_lines_and_remove_union_numbers(f"{l}/mapping.txt")
        )
    l_to_en_map = get_tokens_with_numbers(read_lines(f"{l}/mapping.txt"))
    l_result_lines = []

    if r == "en":
        r_tokens = get_tokens(
            read_lines_and_remove_union_numbers(f"en/mapping.txt")
        )
    else:
        map_and_cache(
            read_lines("en/mapping.txt"), "en", read_lines(f"{r}/story.txt"), r
        )
        r_tokens = get_tokens(
            read_lines_and_remove_union_numbers(f"{r}/mapping.txt")
        )
    r_to_en_map = get_tokens_with_numbers(read_lines(f"{r}/mapping.txt"))
    r_result_lines = []

    for i in range(len(en_lines)):
        unions = get_translated_line_unions(
            en_tokens_n[i], l_to_en_map[i], l, r_to_en_map[i], r
        )
        if ENABLE_DIFFICULTIES:
            union_difficulties = get_union_difficulties(
                unions, en_word_difficulties_per_line[i]
            )
        else:
            union_difficulties = []
        l_result_lines.append(
            stitch_line_n_together(
                unions, union_difficulties, l_tokens[i], l, r
            )
        )
        r_result_lines.append(
            stitch_line_n_together(
                unions, union_difficulties, r_tokens[i], r, l
            )
        )

    make_dir_in_last_dir(f"{l}_{r}")
    write_in_last_dir(f"{l}_{r}/{l}.txt", "\n\n".join(l_result_lines))
    write_in_last_dir(f"{l}_{r}/{r}.txt", "\n\n".join(r_result_lines))
    debug = "\n\n".join(
        [f"{ll}\n{rl}" for ll, rl in zip(l_result_lines, r_result_lines)]
    )
    write_in_last_dir(f"{l}_{r}/{l}_{r}.txt", debug)
