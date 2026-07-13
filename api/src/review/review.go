// Package review tracks per-user spaced-repetition state for dictionary
// words (the user_word_review table).
//
// A row exists for every (user, dictionary sense) the user has opened a word
// explanation for. Opening an explanation is treated as "the user does not
// know this word": it resets the word to the bottom of the repetition ladder
// and schedules when the word should next be woven into a generated story
// (due_at). The ladder itself is hardcoded here. PromoteWordsToNextStage
// advances words up the ladder; nothing calls it or consumes due_at yet —
// that comes with the story-generation integration that will actually plant
// due words into new stories.
//
// due_at is always precomputed at write time, so the future "pick the most
// due words for this user" query is a pure index range scan on
// (user_id, r, due_at); no scoring function runs at read time.
package review

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"lang/api/db"
)

// stageIntervals is the hardcoded repetition ladder: a word at stage N is due
// again stageIntervals[N] after its last impression. A word promoted past the
// last rung is considered learned.
var stageIntervals = [...]time.Duration{
	1 * time.Hour,
	1 * 24 * time.Hour,
	3 * 24 * time.Hour,
	7 * 24 * time.Hour,
	18 * 24 * time.Hour,
	30 * 24 * time.Hour,
	75 * 24 * time.Hour,
}

// stageLearned is the stage value meaning "the word is considered learned":
// one past the last rung of stageIntervals. Promotion caps the stage here.
const stageLearned = len(stageIntervals)

// learnedDueAtSentinel is the due_at parked on learned words. Far future, so
// learned words never surface in due-ordered scans even without an explicit
// stage filter (due_at is DATETIME, which reaches year 9999, precisely so this
// sentinel is possible).
const learnedDueAtSentinel = "9999-01-01 00:00:00"

// savedWordDueDivisor shortens the interval for words currently in the user's
// saved list ("My Dictionary"): saving a word signals the user wants to
// actively learn it, so it should reappear sooner. The divisor is applied at
// the moment due_at is computed; unsaving a word later does not retroactively
// stretch an already-stored due_at.
const savedWordDueDivisor = 2

// maxRecentImpressions caps the recent_impressions JSON audit trail per row.
const maxRecentImpressions = 5

// impressionKindExplained marks a recent_impressions element recorded because
// the user opened the word's explanation.
const impressionKindExplained = "explained"

// impressionKindPromoted marks a recent_impressions element recorded because
// the word was promoted one stage up (i.e. shown to the user again, e.g.
// woven into a freshly generated story).
const impressionKindPromoted = "promoted"

var (
	recordExplanationShownStmt *sql.Stmt
	promoteWordsStmt           *sql.Stmt
)

func Setup() {
	// Single-statement upsert so concurrent impressions of the same word
	// cannot lose updates: the stage reset, counter increment, and bounded
	// JSON push all happen atomically in the database. JSON_ARRAY_INSERT
	// pushes the new impression to the front and JSON_REMOVE trims the
	// element past the cap (removing a nonexistent path is a no-op, so this
	// is safe while the array is still short). due_at arithmetic runs on the
	// database clock, consistent with the CURRENT_TIMESTAMP defaults used
	// everywhere else in the schema.
	var err error
	recordExplanationShownStmt, err = db.Db.Prepare(fmt.Sprintf(
		"INSERT INTO user_word_review "+
			"(user_id, dictionary_entry_id, r, stage, due_at, recent_impressions) "+
			"VALUES (?, ?, ?, 0, TIMESTAMPADD(SECOND, ?, CURRENT_TIMESTAMP), "+
			"JSON_ARRAY(JSON_OBJECT('t', ?, 'kind', ?))) "+
			"ON DUPLICATE KEY UPDATE "+
			"stage = 0, "+
			"due_at = TIMESTAMPADD(SECOND, ?, CURRENT_TIMESTAMP), "+
			"last_impression_at = CURRENT_TIMESTAMP, "+
			"total_impressions = total_impressions + 1, "+
			"recent_impressions = JSON_REMOVE("+
			"JSON_ARRAY_INSERT(recent_impressions, '$[0]', JSON_OBJECT('t', ?, 'kind', ?)), "+
			"'$[%d]');",
		maxRecentImpressions))
	if err != nil {
		panic(err)
	}

	// Promotion interval lookup, generated from stageIntervals: a word at OLD
	// stage N moves to stage N+1 and becomes due stageIntervals[N+1] from now.
	// The last rung and anything beyond it fall through to the learned
	// sentinel via the IF around the CASE, so the CASE only needs rungs that
	// have a next interval.
	var promotionIntervalCase strings.Builder
	for oldStage := 0; oldStage+1 < len(stageIntervals); oldStage++ {
		fmt.Fprintf(&promotionIntervalCase, "WHEN %d THEN %d ",
			oldStage, int64(stageIntervals[oldStage+1]/time.Second))
	}

	// One statement for a whole batch: the entry ids arrive as a JSON array
	// parameter (MEMBER OF), so the statement text is independent of the
	// batch size and can be prepared once. The saved-list EXISTS keeps this a
	// single-table UPDATE (a multi-table UPDATE has no defined assignment
	// order). due_at MUST stay assigned before stage: single-table UPDATE
	// assignments evaluate left to right, and due_at needs the pre-promotion
	// stage.
	promoteWordsStmt, err = db.Db.Prepare(fmt.Sprintf(
		"UPDATE user_word_review SET "+
			"due_at = IF(stage + 1 >= %d, TIMESTAMP '%s', "+
			"TIMESTAMPADD(SECOND, "+
			"CASE stage %sEND DIV IF(EXISTS("+
			"SELECT 1 FROM user_dictionary_word saved "+
			"WHERE saved.user_id = user_word_review.user_id "+
			"AND saved.dictionary_entry_id = user_word_review.dictionary_entry_id), %d, 1), "+
			"CURRENT_TIMESTAMP)), "+
			"stage = LEAST(stage + 1, %d), "+
			"last_impression_at = CURRENT_TIMESTAMP, "+
			"total_impressions = total_impressions + 1, "+
			"recent_impressions = JSON_REMOVE("+
			"JSON_ARRAY_INSERT(recent_impressions, '$[0]', JSON_OBJECT('t', ?, 'kind', ?)), "+
			"'$[%d]') "+
			"WHERE user_id = ? AND dictionary_entry_id MEMBER OF (CAST(? AS JSON));",
		stageLearned, learnedDueAtSentinel, promotionIntervalCase.String(),
		savedWordDueDivisor, stageLearned, maxRecentImpressions))
	if err != nil {
		panic(err)
	}
}

// RecordWordExplanationShown resets entryId to the bottom of userId's
// repetition ladder: the user just opened the word's explanation, meaning
// they did not know it. The next due time is stageIntervals[0] from now,
// divided by savedWordDueDivisor when the word is currently in the user's
// saved list (wordCurrentlySaved) — the saved state is folded into due_at
// right here, so removing the word from the saved list later never needs to
// touch this row. r is the learned language, denormalized into the row for
// the future due-words index scan.
func RecordWordExplanationShown(ctx context.Context, userId, entryId int64, r string, wordCurrentlySaved bool) error {
	interval := stageIntervals[0]
	if wordCurrentlySaved {
		interval /= savedWordDueDivisor
	}
	dueInSeconds := int64(interval / time.Second)
	impressionTime := time.Now().UTC().Format(time.RFC3339)

	_, err := recordExplanationShownStmt.ExecContext(ctx,
		userId, entryId, r, dueInSeconds, impressionTime, impressionKindExplained,
		dueInSeconds, impressionTime, impressionKindExplained)
	if err != nil {
		return fmt.Errorf("failed to record explanation impression for user %d, entry %d: %w", userId, entryId, err)
	}
	return nil
}

// PromoteWordsToNextStage advances each of userId's given dictionary senses
// one rung up the repetition ladder and reschedules due_at to the new rung's
// interval, divided by savedWordDueDivisor for words currently in the user's
// saved list (folded into due_at at write time, like everywhere else). Words
// promoted past the last rung become learned: stage caps at stageLearned and
// due_at parks at the far-future sentinel. It is intended to be called when
// the words are shown to the user again (e.g. woven into a freshly generated
// story), so the impression bookkeeping (count, timestamps, trail) is updated
// too. Entry ids without a review row for this user are silently skipped.
// The whole batch is one UPDATE round trip.
func PromoteWordsToNextStage(ctx context.Context, userId int64, entryIds []int64) error {
	if len(entryIds) == 0 {
		return nil
	}
	entryIdsJson, err := json.Marshal(entryIds)
	if err != nil {
		return fmt.Errorf("failed to marshal entry ids: %w", err)
	}
	impressionTime := time.Now().UTC().Format(time.RFC3339)

	_, err = promoteWordsStmt.ExecContext(ctx,
		impressionTime, impressionKindPromoted, userId, string(entryIdsJson))
	if err != nil {
		return fmt.Errorf("failed to promote %d words for user %d: %w", len(entryIds), userId, err)
	}
	return nil
}
