CREATE DATABASE lang;
USE lang;

CREATE TABLE story (
    id VARCHAR(256) NOT NULL,
    locales VARCHAR(100) NOT NULL,  -- comma separated values
    titles TEXT NOT NULL,  -- \n separated titles, the order matches locales
    language_level VARCHAR(10) NOT NULL,
    author_id VARCHAR(256) NOT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    input_params JSON NOT NULL,  -- parameters used to generate the story
    content JSON NOT NULL,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    -- Where the story originated from. 'generated': produced by the LLM
    -- generator. 'image': OCR'd from a user-uploaded photo via /scan.
    -- 'provided': manually added by the user.
    source ENUM('generated','image','provided') NOT NULL DEFAULT 'generated',
    PRIMARY KEY (id),
    INDEX (locales),
    INDEX (language_level),
    INDEX (author_id),
    INDEX (created)
);

CREATE TABLE tts (
    story_id VARCHAR(256) NOT NULL,
    l VARCHAR(10) NOT NULL,
    sentence_idx INT NOT NULL,
    data BLOB NOT NULL,
    PRIMARY KEY (story_id, l, sentence_idx)
);

CREATE TABLE explanation (
    story_id VARCHAR(256) NOT NULL,
    l VARCHAR(10) NOT NULL,
    r VARCHAR(10) NOT NULL,
    l_sentence_idx INT NOT NULL,
    r_sentence_idx INT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (story_id, l, r, l_sentence_idx, r_sentence_idx)
);

CREATE TABLE word_explanation (
    story_id VARCHAR(256) NOT NULL,
    l VARCHAR(10) NOT NULL,
    r VARCHAR(10) NOT NULL,
    l_sentence_idx INT NOT NULL,
    r_sentence_idx INT NOT NULL,
    word_idx INT NOT NULL,
    content TEXT NOT NULL,                          -- human-readable explanation shown in the popup
    -- The global dictionary sense this word was resolved to when the
    -- explanation was generated (analyze + dedupe + save). Nullable because not
    -- every clicked word ends up in the dictionary. The Save button is only
    -- shown when this is set.
    dictionary_entry_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (story_id, l, r, l_sentence_idx, r_sentence_idx, word_idx),
    FOREIGN KEY (dictionary_entry_id) REFERENCES dictionary_entry(id)
);

CREATE TABLE user (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    firebase_uid VARCHAR(256) NOT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY user_firebase_uid_unique (firebase_uid)
);

-- A user's favorite stories, shown at the top of the story lists. story_id
-- references either a generated story row in `story` or a curated story
-- shipped as files on disk, so there is deliberately no foreign key on it.
CREATE TABLE user_favorite_story (
    user_id BIGINT UNSIGNED NOT NULL,
    story_id VARCHAR(256) NOT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, story_id),
    FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Global, user-agnostic dictionary. Each row is one sense of a word in the
-- learned language (r). The same spelling can have multiple rows (e.g.
-- "die Bank" as bench vs financial institution, or a noun/verb pair), so
-- there is no uniqueness constraint on the word text; sense deduplication is
-- handled in code via the LLM using the existing senses + meaning_fingerprint.
CREATE TABLE dictionary_entry (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    r VARCHAR(10) NOT NULL,                 -- learned language (de, ru, ...)

    canonical_form VARCHAR(256) NOT NULL,   -- "bank"  (normalized, for matching/grouping)
    display_form   VARCHAR(256) NOT NULL,   -- "die Bank" (shown to the user)

    part_of_speech ENUM('noun','verb','adjective','adverb','pronoun',
                        'preposition','conjunction','interjection','other') NOT NULL,

    -- Short English meaning, used only for sense identity/deduplication (code-side),
    -- never displayed to the user.
    meaning_fingerprint VARCHAR(512) NOT NULL,

    gender ENUM('masculine','feminine','neuter','none') NOT NULL DEFAULT 'none',

    examples JSON NOT NULL,                  -- array of example sentences in the learned language

    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX dictionary_entry_lookup_idx (r, canonical_form, part_of_speech)
);

-- Per-spoken-language (l) descriptions for a dictionary entry. Keeps the global
-- entry language-agnostic while supporting explanations in en/ru/de.
CREATE TABLE dictionary_entry_localization (
    dictionary_entry_id BIGINT UNSIGNED NOT NULL,
    l VARCHAR(10) NOT NULL,                  -- spoken language (en, ru, de)
    brief_meaning TEXT NOT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (dictionary_entry_id, l),
    FOREIGN KEY (dictionary_entry_id) REFERENCES dictionary_entry(id)
);

-- A user's personal saved words: simple references into the global dictionary.
CREATE TABLE user_dictionary_word (
    user_id BIGINT UNSIGNED NOT NULL,
    dictionary_entry_id BIGINT UNSIGNED NOT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, dictionary_entry_id),
    INDEX user_dictionary_word_user_idx (user_id),
    FOREIGN KEY (user_id) REFERENCES user(id),
    FOREIGN KEY (dictionary_entry_id) REFERENCES dictionary_entry(id)
);

COMMIT;
