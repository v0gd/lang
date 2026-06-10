// Package favorite owns the `user_favorite_story` table: per-user favorite
// marks on stories. A favorite is a plain (user_id, story_id) reference; it
// works uniformly for generated stories (rows in `story`) and curated stories
// (files on disk), which is why there is no foreign key on story_id. Story
// access control is enforced by the HTTP handler before a favorite is added.
package favorite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"lang/api/db"
	"lang/api/story"
)

var (
	addStmt    *sql.Stmt
	removeStmt *sql.Stmt
	listStmt   *sql.Stmt
	existsStmt *sql.Stmt
)

func Setup() {
	var err error
	// Re-favoriting an already-favorite story is an idempotent no-op.
	addStmt, err = db.Db.Prepare(
		"INSERT INTO user_favorite_story (user_id, story_id) VALUES (?, ?) " +
			"ON DUPLICATE KEY UPDATE story_id = story_id;")
	if err != nil {
		panic(err)
	}
	removeStmt, err = db.Db.Prepare(
		"DELETE FROM user_favorite_story WHERE user_id = ? AND story_id = ?;")
	if err != nil {
		panic(err)
	}
	listStmt, err = db.Db.Prepare(
		"SELECT story_id FROM user_favorite_story WHERE user_id = ?;")
	if err != nil {
		panic(err)
	}
	existsStmt, err = db.Db.Prepare(
		"SELECT 1 FROM user_favorite_story WHERE user_id = ? AND story_id = ?;")
	if err != nil {
		panic(err)
	}
}

// IsFavorite reports whether the user has marked the story as a favorite.
func IsFavorite(ctx context.Context, userId int64, storyId story.Id) (bool, error) {
	var exists int
	err := existsStmt.QueryRowContext(ctx, userId, storyId).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check favorite story %s for user %d: %w", storyId, userId, err)
	}
	return true, nil
}

// Add marks a story as a favorite of the user. Adding an existing favorite is
// a successful no-op.
func Add(ctx context.Context, userId int64, storyId story.Id) error {
	if _, err := addStmt.ExecContext(ctx, userId, storyId); err != nil {
		return fmt.Errorf("failed to add favorite story %s for user %d: %w", storyId, userId, err)
	}
	return nil
}

// Remove unmarks a favorite. Removing a story that isn't a favorite is a
// successful no-op.
func Remove(ctx context.Context, userId int64, storyId story.Id) error {
	if _, err := removeStmt.ExecContext(ctx, userId, storyId); err != nil {
		return fmt.Errorf("failed to remove favorite story %s for user %d: %w", storyId, userId, err)
	}
	return nil
}

// StoryIdsForUser returns the set of story ids the user has marked as favorite.
// The set is bounded by the number of stories the user can access (own
// stories + curated), so loading it whole is fine.
func StoryIdsForUser(ctx context.Context, userId int64) (map[story.Id]bool, error) {
	rows, err := listStmt.QueryContext(ctx, userId)
	if err != nil {
		return nil, fmt.Errorf("failed to list favorite stories for user %d: %w", userId, err)
	}
	defer rows.Close()

	ids := map[story.Id]bool{}
	for rows.Next() {
		var id story.Id
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan favorite story id for user %d: %w", userId, err)
		}
		ids[id] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate favorite stories for user %d: %w", userId, err)
	}
	return ids, nil
}
