// Package dictionary implements the global, user-agnostic word dictionary and
// the per-user saved-word list.
//
// There are two entry points, reflecting the two moments a word touches the
// dictionary:
//
//   - Ingest: called while a word explanation is being generated (see the
//     explanation package). It analyzes the clicked word into a normalized,
//     language-agnostic dictionary entry, deduplicates it against existing
//     senses of the same canonical form, and inserts a new entry if needed.
//     The dedupe+insert is serialized per canonical form by an in-process lock
//     so two concurrent explanations of the same word cannot create duplicate
//     entries.
//
//   - SaveForUser: called when the user presses "Save". It records a reference
//     into the user's saved-word list and kicks off a best-effort background
//     job that produces the entry's description in the user's spoken language
//     (dictionary_entry_localization), deduplicated by a global (entry, l) job
//     registry so it runs at most once per language.
package dictionary

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"lang/api/db"
	"lang/api/llm"
	"lang/api/telemetry"
)

// languageNames maps locale codes to their English names for LLM prompts. It is
// duplicated here (as scan/generator already do for their own prompts) to keep
// this package free of an import dependency on the explanation package, which
// depends on us.
var languageNames = map[string]string{
	"en": "English",
	"ru": "Russian",
	"de": "German",
}

// These mirror the ENUM definitions in db-setup.sql. LLM output is untrusted, so
// we validate against them before touching the database (a bad value would fail
// the insert anyway, but we want a clear error, not a driver-level one).
var allowedPartsOfSpeech = map[string]bool{
	"noun": true, "verb": true, "adjective": true, "adverb": true,
	"pronoun": true, "preposition": true, "conjunction": true,
	"interjection": true, "other": true,
}

var allowedGenders = map[string]bool{
	"masculine": true, "feminine": true, "neuter": true, "none": true,
}

// WordAnalysis is the structured LLM analysis of one sense of a word: the
// language-agnostic global dictionary entry. It deliberately carries no
// per-spoken-language meanings - those (brief/detailed) are produced lazily on
// save, per spoken language, by the localization job.
type WordAnalysis struct {
	CanonicalForm      string   `json:"canonical_form" jsonschema_description:"The lemma, fully normalized for lookup: lowercase, no article, verbs as infinitive, nouns as nominative singular, adjectives in their base (positive) form. Examples: 'bank', 'gehen', 'schoen'. Compound words can be canonical as well, e.g. 'hausaufgabe', 'anfangen', 'take over', 'Постольку поскольку'. For multi-part units (e.g. correlative conjunctions) put a single space between the parts and NO placeholder, e.g. 'weder noch' (not 'weder ... noch')."`
	DisplayForm        string   `json:"display_form" jsonschema_description:"How the entry is shown to a learner: nouns with their definite article when applicable (e.g. 'die Bank'), verbs as the infinitive (e.g. 'gehen'), everything else in its normal dictionary form. For multi-part units, use '...' as a placeholder where the other words go, e.g. 'weder ... noch'."`
	PartOfSpeech       string   `json:"part_of_speech" jsonschema_description:"One of: noun, verb, adjective, adverb, pronoun, preposition, conjunction, interjection, other."`
	Gender             string   `json:"gender" jsonschema_description:"For nouns one of: masculine, feminine, neuter, none. For anything that is not a noun, exactly 'none'."`
	Examples           []string `json:"examples" jsonschema_description:"Exactly two natural example sentences using this word in the learned language."`
	MeaningFingerprint string   `json:"meaning_fingerprint" jsonschema_description:"A short English gloss (2-6 words) identifying this specific sense, used only to tell senses apart (e.g. for 'die Bank' it can be one of 'financial institution' vs 'bench for sitting', depending on the context). Always in English regardless of the other languages."`
}

// senseMatch is the structured LLM output for the deduplication step.
type senseMatch struct {
	MatchedIndex int `json:"matched_index" jsonschema_description:"0-based index into the provided existing senses that has the SAME part of speech AND the same meaning as the new word. Use -1 if none of them match and this is a new sense."`
}

// existingSense is a row loaded from dictionary_entry, used both for dedup and
// to present current senses to the LLM.
type existingSense struct {
	id                 int64
	displayForm        string
	partOfSpeech       string
	meaningFingerprint string
}

// localizationOutput is the structured LLM output for a per-spoken-language
// description of a dictionary entry.
type localizationOutput struct {
	BriefMeaning string `json:"brief_meaning" jsonschema_description:"A short translation/meaning written in the user's spoken language (a few words, like a dictionary gloss)."`
}

var (
	loadSensesStmt         *sql.Stmt
	insertEntryStmt        *sql.Stmt
	loadEntryStmt          *sql.Stmt
	localizationExistsStmt *sql.Stmt
	upsertLocalizationStmt *sql.Stmt
	insertUserWordStmt     *sql.Stmt
	userWordExistsStmt     *sql.Stmt
	deleteUserWordStmt     *sql.Stmt
	listUserWordsStmt      *sql.Stmt
)

// MyDictionaryPageSize is the number of saved words returned per page by
// ListForUser.
const MyDictionaryPageSize = 100

func Setup() {
	var err error
	loadSensesStmt, err = db.Db.Prepare(
		"SELECT id, display_form, part_of_speech, meaning_fingerprint FROM dictionary_entry " +
			"WHERE r = ? AND canonical_form = ?;")
	if err != nil {
		panic(err)
	}
	insertEntryStmt, err = db.Db.Prepare(
		"INSERT INTO dictionary_entry " +
			"(r, canonical_form, display_form, part_of_speech, meaning_fingerprint, gender, examples) " +
			"VALUES (?, ?, ?, ?, ?, ?, ?);")
	if err != nil {
		panic(err)
	}
	loadEntryStmt, err = db.Db.Prepare(
		"SELECT r, display_form, part_of_speech, meaning_fingerprint FROM dictionary_entry WHERE id = ?;")
	if err != nil {
		panic(err)
	}
	localizationExistsStmt, err = db.Db.Prepare(
		"SELECT 1 FROM dictionary_entry_localization WHERE dictionary_entry_id = ? AND l = ?;")
	if err != nil {
		panic(err)
	}
	// First writer wins for a given (entry, l): the no-op UPDATE makes the
	// statement idempotent without overwriting another job's description.
	upsertLocalizationStmt, err = db.Db.Prepare(
		"INSERT INTO dictionary_entry_localization (dictionary_entry_id, l, brief_meaning) " +
			"VALUES (?, ?, ?) " +
			"ON DUPLICATE KEY UPDATE dictionary_entry_id = dictionary_entry_id;")
	if err != nil {
		panic(err)
	}
	insertUserWordStmt, err = db.Db.Prepare(
		"INSERT INTO user_dictionary_word (user_id, dictionary_entry_id) " +
			"VALUES (?, ?) " +
			"ON DUPLICATE KEY UPDATE user_id = user_id;")
	if err != nil {
		panic(err)
	}
	userWordExistsStmt, err = db.Db.Prepare(
		"SELECT 1 FROM user_dictionary_word WHERE user_id = ? AND dictionary_entry_id = ?;")
	if err != nil {
		panic(err)
	}
	deleteUserWordStmt, err = db.Db.Prepare(
		"DELETE FROM user_dictionary_word WHERE user_id = ? AND dictionary_entry_id = ?;")
	if err != nil {
		panic(err)
	}
	// Saved words for one user in one learned language (r), with the meaning in
	// the user's spoken language (l) when it has already been localized (LEFT
	// JOIN: the localization is produced in the background and may not exist
	// yet). Most-recently-saved first; e.id as a stable tiebreaker for paging.
	listUserWordsStmt, err = db.Db.Prepare(
		"SELECT e.id, e.display_form, e.part_of_speech, e.gender, e.examples, " +
			"COALESCE(loc.brief_meaning, '') " +
			"FROM user_dictionary_word uw " +
			"JOIN dictionary_entry e ON e.id = uw.dictionary_entry_id " +
			"LEFT JOIN dictionary_entry_localization loc " +
			"ON loc.dictionary_entry_id = e.id AND loc.l = ? " +
			"WHERE uw.user_id = ? AND e.r = ? " +
			"ORDER BY uw.created DESC, e.id DESC " +
			"LIMIT ? OFFSET ?;")
	if err != nil {
		panic(err)
	}
}

// --- Ingest: analyze + dedupe + save the global entry ---

// canonicalLocks serializes the dedupe+insert critical section per
// (r, canonical_form). Without it, two explanations of the same word racing in
// parallel could both miss the dedupe check and insert duplicate entries (there
// is intentionally no unique constraint, since one spelling has many senses).
//
// NOTE: this is an in-process lock. With multiple API instances the race
// returns; a durable fix would need a DB advisory lock or a unique key. The map
// grows by one mutex per distinct canonical form ever ingested, which is
// bounded by the learned vocabulary and small in practice.
var (
	canonicalLocksMutex sync.Mutex
	canonicalLocks      = map[string]*sync.Mutex{}
)

func lockCanonical(r, canonicalForm string) func() {
	key := r + "\x00" + canonicalForm
	canonicalLocksMutex.Lock()
	lock, ok := canonicalLocks[key]
	if !ok {
		lock = &sync.Mutex{}
		canonicalLocks[key] = lock
	}
	canonicalLocksMutex.Unlock()

	lock.Lock()
	return lock.Unlock
}

// Ingest analyzes word (as it appears in rSentence) into a normalized
// dictionary entry, deduplicates it against existing senses of the same
// canonical form, inserts a new entry when there is no match, and returns the
// resulting entry id. r is the learned language. No per-user or localized data
// is written here.
func Ingest(ctx context.Context, r, word, rSentence string) (int64, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Ingesting word %q (%s)", word, r))
	defer trace.Stop()

	analysis, err := analyzeWord(ctx, r, word, rSentence)
	if err != nil {
		return 0, fmt.Errorf("failed to analyze word %q: %w", word, err)
	}

	// Everything from here (dedupe read through insert) must be atomic per
	// canonical form to avoid duplicate inserts under concurrency.
	unlock := lockCanonical(r, analysis.CanonicalForm)
	defer unlock()

	senses, err := loadSenses(ctx, r, analysis.CanonicalForm)
	if err != nil {
		return 0, err
	}

	if len(senses) > 0 {
		idx, err := matchSense(ctx, r, analysis, senses)
		if err != nil {
			return 0, fmt.Errorf("failed to match sense for %q: %w", word, err)
		}
		if idx >= 0 && idx < len(senses) {
			return senses[idx].id, nil
		}
	}

	entryId, err := insertEntry(ctx, r, analysis)
	if err != nil {
		return 0, err
	}
	return entryId, nil
}

func analyzeWord(ctx context.Context, r, word, rSentence string) (WordAnalysis, error) {
	schema := llm.StructuredOutputSchema{
		Schema:      llm.GenerateSchema[WordAnalysis](),
		Name:        "word_analysis",
		Description: "Normalized, language-agnostic dictionary entry for a word in its sentence context.",
	}
	response, err := llm.InvokeStructured(ctx, analyzeRole(r), analyzeContent(r, word, rSentence), schema, llm.Gpt)
	if err != nil {
		return WordAnalysis{}, err
	}

	var analysis WordAnalysis
	if err := json.Unmarshal([]byte(response), &analysis); err != nil {
		return WordAnalysis{}, fmt.Errorf("failed to unmarshal word analysis: %w", err)
	}

	// Deterministic post-processing so grouping by canonical_form is robust to
	// the LLM's capitalization/whitespace inconsistencies.
	analysis.CanonicalForm = strings.ToLower(strings.TrimSpace(analysis.CanonicalForm))
	analysis.DisplayForm = strings.TrimSpace(analysis.DisplayForm)
	if analysis.CanonicalForm == "" || analysis.DisplayForm == "" {
		return WordAnalysis{}, fmt.Errorf("LLM returned empty canonical or display form")
	}
	if !allowedPartsOfSpeech[analysis.PartOfSpeech] {
		return WordAnalysis{}, fmt.Errorf("LLM returned invalid part_of_speech %q", analysis.PartOfSpeech)
	}
	if !allowedGenders[analysis.Gender] {
		return WordAnalysis{}, fmt.Errorf("LLM returned invalid gender %q", analysis.Gender)
	}
	return analysis, nil
}

func matchSense(ctx context.Context, r string, analysis WordAnalysis, senses []existingSense) (int, error) {
	var content strings.Builder
	fmt.Fprintf(&content, "New word: %q (%s) - meaning: %q\n\n", analysis.DisplayForm, analysis.PartOfSpeech, analysis.MeaningFingerprint)
	content.WriteString("Existing senses:\n")
	for i, sense := range senses {
		fmt.Fprintf(&content, "%d. %q (%s) - meaning: %q\n", i, sense.displayForm, sense.partOfSpeech, sense.meaningFingerprint)
	}
	content.WriteString("\nWhich existing sense is the SAME word sense as the new word? Return its index, or -1 if none match.")

	schema := llm.StructuredOutputSchema{
		Schema:      llm.GenerateSchema[senseMatch](),
		Name:        "sense_match",
		Description: "Decide whether a new word sense matches one of the existing senses.",
	}
	response, err := llm.InvokeStructured(ctx, matchRole(r), content.String(), schema, llm.Gpt)
	if err != nil {
		return -1, err
	}

	var match senseMatch
	if err := json.Unmarshal([]byte(response), &match); err != nil {
		return -1, fmt.Errorf("failed to unmarshal sense match: %w", err)
	}
	return match.MatchedIndex, nil
}

func insertEntry(ctx context.Context, r string, analysis WordAnalysis) (int64, error) {
	examplesJson, err := json.Marshal(analysis.Examples)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal examples: %w", err)
	}
	result, err := insertEntryStmt.ExecContext(ctx,
		r, analysis.CanonicalForm, analysis.DisplayForm, analysis.PartOfSpeech,
		analysis.MeaningFingerprint, analysis.Gender, examplesJson)
	if err != nil {
		return 0, fmt.Errorf("failed to insert dictionary entry: %w", err)
	}
	entryId, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to read new entry id: %w", err)
	}
	return entryId, nil
}

func loadSenses(ctx context.Context, r, canonicalForm string) ([]existingSense, error) {
	rows, err := loadSensesStmt.QueryContext(ctx, r, canonicalForm)
	if err != nil {
		return nil, fmt.Errorf("failed to load senses for %q: %w", canonicalForm, err)
	}
	defer rows.Close()

	var senses []existingSense
	for rows.Next() {
		var sense existingSense
		if err := rows.Scan(&sense.id, &sense.displayForm, &sense.partOfSpeech, &sense.meaningFingerprint); err != nil {
			return nil, fmt.Errorf("failed to scan sense row: %w", err)
		}
		senses = append(senses, sense)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating sense rows: %w", err)
	}
	return senses, nil
}

// --- SaveForUser: per-user reference + background localization ---

// SaveForUser records entryId in the user's saved-word list and kicks off a
// background job to produce the entry's description in the user's spoken
// language l. It returns as soon as the user reference is written; the
// localization is best-effort and deduplicated by a global (entry, l) registry.
func SaveForUser(ctx context.Context, userId, entryId int64, l string) error {
	if _, err := insertUserWordStmt.ExecContext(ctx, userId, entryId); err != nil {
		return fmt.Errorf("failed to save word %d for user %d: %w", entryId, userId, err)
	}
	triggerLocalization(entryId, l)
	return nil
}

// RemoveForUser removes entryId from userId's saved-word list. It is a no-op if
// the word was not saved. The global dictionary entry and any localization are
// left intact - only the user's reference is dropped.
func RemoveForUser(ctx context.Context, userId, entryId int64) error {
	if _, err := deleteUserWordStmt.ExecContext(ctx, userId, entryId); err != nil {
		return fmt.Errorf("failed to remove word %d for user %d: %w", entryId, userId, err)
	}
	return nil
}

// SavedWord is one entry of a user's "My Dictionary" page: the global
// dictionary entry plus its meaning in the user's spoken language. BriefMeaning
// is empty when the background localization has not been produced yet.
type SavedWord struct {
	EntryId      int64    `json:"dictionary_entry_id"`
	DisplayForm  string   `json:"display_form"`
	PartOfSpeech string   `json:"part_of_speech"`
	Gender       string   `json:"gender"`
	Examples     []string `json:"examples"`
	BriefMeaning string   `json:"brief_meaning"`
}

// ListForUser returns one page (MyDictionaryPageSize entries) of userId's saved
// words in learned language r, with meanings localized to spoken language l.
// page is 0-based. The returned bool reports whether a further page exists (we
// over-fetch by one row to avoid a separate COUNT query).
func ListForUser(ctx context.Context, userId int64, l, r string, page int) ([]SavedWord, bool, error) {
	if page < 0 {
		page = 0
	}
	offset := page * MyDictionaryPageSize

	rows, err := listUserWordsStmt.QueryContext(ctx, l, userId, r, MyDictionaryPageSize+1, offset)
	if err != nil {
		return nil, false, fmt.Errorf("failed to list saved words for user %d: %w", userId, err)
	}
	defer rows.Close()

	words := make([]SavedWord, 0, MyDictionaryPageSize+1)
	for rows.Next() {
		var word SavedWord
		var examplesJson []byte
		if err := rows.Scan(&word.EntryId, &word.DisplayForm, &word.PartOfSpeech, &word.Gender, &examplesJson, &word.BriefMeaning); err != nil {
			return nil, false, fmt.Errorf("failed to scan saved word row: %w", err)
		}
		if err := json.Unmarshal(examplesJson, &word.Examples); err != nil {
			return nil, false, fmt.Errorf("failed to unmarshal examples for entry %d: %w", word.EntryId, err)
		}
		words = append(words, word)
	}
	if err := rows.Err(); err != nil {
		return nil, false, fmt.Errorf("error iterating saved word rows: %w", err)
	}

	hasMore := len(words) > MyDictionaryPageSize
	if hasMore {
		words = words[:MyDictionaryPageSize]
	}
	return words, hasMore, nil
}

// IsSavedForUser reports whether entryId is already in userId's saved-word
// list. Used to render the Save button as already-saved when a word's
// explanation is reopened.
func IsSavedForUser(ctx context.Context, userId, entryId int64) (bool, error) {
	var exists int
	err := userWordExistsStmt.QueryRowContext(ctx, userId, entryId).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check saved word %d for user %d: %w", entryId, userId, err)
	}
	return true, nil
}

// localizationJobs tracks in-flight localization jobs so the same (entry, l) is
// not localized twice concurrently (and so a flurry of saves doesn't spawn a
// flurry of identical LLM calls).
var (
	localizationJobsMutex sync.Mutex
	localizationJobs      = map[string]bool{}
)

func triggerLocalization(entryId int64, l string) {
	key := fmt.Sprintf("%d\x00%s", entryId, l)

	localizationJobsMutex.Lock()
	if localizationJobs[key] {
		localizationJobsMutex.Unlock()
		return
	}
	localizationJobs[key] = true
	localizationJobsMutex.Unlock()

	go func() {
		defer func() {
			localizationJobsMutex.Lock()
			delete(localizationJobs, key)
			localizationJobsMutex.Unlock()
		}()

		// Detached from the request context: SaveForUser has already returned
		// to the client, so this must not be cancelled when the request ends.
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		if err := localizeEntry(ctx, entryId, l); err != nil {
			slog.Error(fmt.Sprintf("Failed to localize dictionary entry %d for %q: %v", entryId, l, err))
		}
	}()
}

func localizeEntry(ctx context.Context, entryId int64, l string) error {
	// Skip the LLM call if this localization already exists.
	var exists int
	err := localizationExistsStmt.QueryRowContext(ctx, entryId, l).Scan(&exists)
	if err == nil {
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("failed to check existing localization: %w", err)
	}

	var r, displayForm, partOfSpeech, meaningFingerprint string
	if err := loadEntryStmt.QueryRowContext(ctx, entryId).Scan(&r, &displayForm, &partOfSpeech, &meaningFingerprint); err != nil {
		return fmt.Errorf("failed to load dictionary entry %d: %w", entryId, err)
	}

	loc, err := generateLocalization(ctx, l, r, displayForm, partOfSpeech, meaningFingerprint)
	if err != nil {
		return err
	}

	if _, err := upsertLocalizationStmt.ExecContext(ctx, entryId, l, loc.BriefMeaning); err != nil {
		return fmt.Errorf("failed to upsert dictionary localization: %w", err)
	}
	return nil
}

func generateLocalization(ctx context.Context, l, r, displayForm, partOfSpeech, meaningFingerprint string) (localizationOutput, error) {
	schema := llm.StructuredOutputSchema{
		Schema:      llm.GenerateSchema[localizationOutput](),
		Name:        "dictionary_localization",
		Description: "A dictionary entry's meaning described in the user's spoken language.",
	}
	response, err := llm.InvokeStructured(ctx, localizeRole(l, r), localizeContent(displayForm, partOfSpeech, meaningFingerprint), schema, llm.Gpt)
	if err != nil {
		return localizationOutput{}, err
	}

	var loc localizationOutput
	if err := json.Unmarshal([]byte(response), &loc); err != nil {
		return localizationOutput{}, fmt.Errorf("failed to unmarshal localization: %w", err)
	}
	loc.BriefMeaning = strings.TrimSpace(loc.BriefMeaning)
	if loc.BriefMeaning == "" {
		return localizationOutput{}, fmt.Errorf("LLM returned empty localization")
	}
	return loc, nil
}

// --- Prompts ---

func analyzeRole(r string) string {
	return fmt.Sprintf(`You are a %s lexicographer building a dictionary. The user clicked one word in a sentence; given that word and its sentence, produce a normalized dictionary entry for the SPECIFIC sense used in that sentence.

Default to analyzing JUST the clicked word. Expand to a multi-word unit ONLY when the clicked word is grammatically bound to other words and does not work as its own dictionary entry in this sentence, specifically:
- a separable verb split across the sentence (clicking "an" in "Ruf mich an" -> "anrufen");
- a phrasal verb (clicking "take" in "The plane takes off" -> "take off");
- a reflexive verb whose pronoun belongs to it (-> "sich freuen");
- one part of a multi-part/correlative conjunction (-> "weder ... noch").

Do NOT expand just because the word commonly appears next to others. Greetings, collocations, and prepositional phrases are NOT single units here: analyze the clicked word on its own. For example, clicking "Morgen" in "Guten Morgen" yields "Morgen" (not "Guten Morgen").

If the word in the sentence is inflected (a conjugated verb, a declined noun, a plural, etc.), analyze its dictionary lemma, not the inflected surface form. Choose the sense that fits the sentence; a spelling can have several unrelated senses.

Write meaning_fingerprint in English. Follow the field descriptions exactly.`,
		languageNames[r])
}

func analyzeContent(r, word, rSentence string) string {
	return fmt.Sprintf("Word: %q\nSentence: %q\nThe word is in %s. Produce the dictionary entry for the sense used in this sentence.",
		word, rSentence, languageNames[r])
}

func matchRole(r string) string {
	return fmt.Sprintf(`You deduplicate senses in a %s dictionary. Two senses are the SAME only if they share the same part of speech AND the same meaning. Different meanings of the same spelling (e.g. "die Bank" as a bench vs a financial institution) are NOT the same sense, and a noun versus a verb with the same spelling are NOT the same sense. Be strict: only declare a match when you are confident it is the same sense.`,
		languageNames[r])
}

func localizeRole(l, r string) string {
	return fmt.Sprintf(`You are a %s teacher for %s speakers. You are given one sense of a %s dictionary word (its display form, part of speech, and a short English gloss that pins down WHICH sense it is). Describe that exact sense in %s. Write brief_meaning in %s only; do not include the original %s word.`,
		languageNames[r], languageNames[l], languageNames[r],
		languageNames[l], languageNames[l], languageNames[r])
}

func localizeContent(displayForm, partOfSpeech, meaningFingerprint string) string {
	return fmt.Sprintf("Word: %q (%s)\nSense (English gloss): %q", displayForm, partOfSpeech, meaningFingerprint)
}
