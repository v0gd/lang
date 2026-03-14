import hashlib


def tuple_to_hash(tup):
    # Convert the tuple to a string representation.
    # This uses repr() to ensure a consistent and unambiguous string representation.
    tup_str = repr(tup)

    # Encode the string representation to a bytes object, as required by hashlib
    tup_bytes = tup_str.encode("utf-8")

    # Create a SHA-256 hash object and update it with the bytes object
    hash_obj = hashlib.sha256(tup_bytes)

    # Generate the hexadecimal representation of the digest
    hash_hex = hash_obj.hexdigest()

    return hash_hex


# print(tuple_to_hash(('Клара ела мыло', 12, 'red', 'some font')))
