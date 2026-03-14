package db

import (
	"database/sql"
	"fmt"
	"lang/api/osutil"
	"log/slog"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

var Db *sql.DB

func Setup() {
	pass := osutil.MustGetEnv("LANG_API_DB_PASSWORD")
	var err error = nil
	Db, err = sql.Open("mysql", fmt.Sprintf("root:%s@/lang", pass))
	if err != nil {
		panic(err)
	}
	Db.SetConnMaxLifetime(time.Minute * 3)
	Db.SetMaxOpenConns(10)
	Db.SetMaxIdleConns(10)

	err = Db.Ping()
	if err == nil {
		slog.Info("Connected to database")
	} else {
		panic(err)
	}
}
