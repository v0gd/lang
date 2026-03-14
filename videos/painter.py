import re


def word_numbers(input_string):
    tokens = input_string.split(" ")

    result = []
    for token in tokens:
        token = re.sub(r"\[\d+\]", "", token)
        match = re.search(r"\((\d+)\)", token)
        if match:
            number = int(match.group(1))
            word = re.sub(r"\(\d+\)", "", token)
            to_add = (word, number)
        else:
            to_add = (token, 0)
        if result and result[-1][1] == to_add[1]:
            result[-1] = (result[-1][0] + " " + to_add[0], to_add[1])
        else:
            result.append(to_add)

    return result


def union_difficulties(input_string):
    tokens = input_string.split(" ")
    result = {}
    for token in tokens:
        match = re.search(r"\((\d+)\)\[(\d+)\]", token)
        if match:
            number = int(match.group(1))
            difficulty = int(match.group(2))
            result[number] = difficulty
    return result
