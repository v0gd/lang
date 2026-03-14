package firebase

import (
	"context"
	"fmt"
	"log/slog"

	fb "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
)

var (
	App  *fb.App
	Auth *auth.Client
)

func Setup() {
	slog.Info("Initializing firebase")
	var err error
	App, err = fb.NewApp(context.Background(), nil)
	if err != nil {
		panic(fmt.Sprintf("error initializing app: %v", err))
	} else {
		slog.Info("Firebase app initialized")
	}
	Auth, err = App.Auth(context.Background())
	if err != nil {
		panic(fmt.Sprintf("error initializing auth: %v", err))
	} else {
		slog.Info("Firebase auth initialized")
	}
}
