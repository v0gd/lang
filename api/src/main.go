package main

import (
	"log/slog"
	"os"

	"lang/api/app"
	"lang/api/cache"
	"lang/api/db"
	"lang/api/dictionary"
	"lang/api/explanation"
	"lang/api/favorite"
	"lang/api/firebase"
	"lang/api/generator"
	"lang/api/review"
	"lang/api/safety"
	"lang/api/tts"
	"lang/api/user"
)

func main() {
	firebase.Setup()
	cache.Setup()
	db.Setup()
	user.Setup()
	generator.Setup()
	explanation.Setup()
	dictionary.Setup()
	review.Setup()
	favorite.Setup()
	safety.Setup()
	tts.Setup()
	if err := app.Serve(); err != nil {
		slog.Error(err.Error())
		os.Exit(1)
	}
}
