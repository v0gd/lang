// Package user owns the `user` table: the mapping from a Firebase UID (the
// external identity used by Firebase Auth) to a small internal numeric id used
// by the dictionary tables.
//
// Resolution happens once, at the authentication boundary (see wrapAuth in the
// app package), so every authenticated request carries a fully-resolved User.
// This is the single place where account-wide concerns (last-seen, ban checks,
// ...) can later be added without each handler duplicating the logic.
package user

import (
	"context"
	"database/sql"
	"fmt"
	"sync"

	"lang/api/db"
)

// User is the resolved identity of an authenticated request. FirebaseUid is the
// external id used by Firebase Auth (and stored as story.author_id); Id is the
// internal numeric id referenced by the dictionary tables.
type User struct {
	Id          int64
	FirebaseUid string
}

var resolveStmt *sql.Stmt

// The firebase_uid -> id mapping never changes once a row exists, so we cache
// it in memory unconditionally and never invalidate. The map is unbounded, but
// it is bounded in practice by the number of distinct users that have made an
// authenticated request since the process started, which is small.
var (
	cacheMutex sync.RWMutex
	idCache    = make(map[string]int64)
)

func Setup() {
	var err error
	// Get-or-create in a single race-safe statement. On a fresh insert,
	// LAST_INSERT_ID() is the new auto-increment id. On a conflicting
	// firebase_uid (unique key), the no-op UPDATE feeds the existing id back
	// through LAST_INSERT_ID(id) so result.LastInsertId() returns it too. This
	// relies on the UNIQUE KEY on firebase_uid and avoids a check-then-insert
	// race between concurrent first requests for the same user.
	resolveStmt, err = db.Db.Prepare(
		"INSERT INTO user (firebase_uid) VALUES (?) " +
			"ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);")
	if err != nil {
		panic(err)
	}
}

// Resolve returns the internal User for a Firebase UID, creating the row on
// first sight. Results are cached in memory, so only the first request per user
// touches the database.
func Resolve(ctx context.Context, firebaseUid string) (User, error) {
	cacheMutex.RLock()
	id, cached := idCache[firebaseUid]
	cacheMutex.RUnlock()
	if cached {
		return User{Id: id, FirebaseUid: firebaseUid}, nil
	}

	result, err := resolveStmt.ExecContext(ctx, firebaseUid)
	if err != nil {
		return User{}, fmt.Errorf("failed to resolve user %s: %w", firebaseUid, err)
	}
	id, err = result.LastInsertId()
	if err != nil {
		return User{}, fmt.Errorf("failed to read id for user %s: %w", firebaseUid, err)
	}

	cacheMutex.Lock()
	idCache[firebaseUid] = id
	cacheMutex.Unlock()

	return User{Id: id, FirebaseUid: firebaseUid}, nil
}
