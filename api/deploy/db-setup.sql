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

COMMIT;
