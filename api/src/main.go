package main

import (
	"lang/api/app"
	"lang/api/cache"
	"lang/api/db"
	"lang/api/explanation"
	"lang/api/firebase"
	"lang/api/generator"
	"lang/api/tts"
	"lang/api/user"
	"log"
)

func main() {
	firebase.Setup()
	cache.Setup()
	db.Setup()
	user.Setup()
	generator.Setup()
	explanation.Setup()
	tts.Setup()
	log.Fatal(app.Serve())
	// llm.Test()
	// story.Test()
	// generator.Test()
	// explanation.Test()
}
