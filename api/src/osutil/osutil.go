package osutil

import (
	"fmt"
	"os"
)

func MustGetEnv(key string) string {
	p := os.Getenv(key)
	if p == "" {
		panic(fmt.Sprintf("Missing environment variable %s", key))
	}
	return p
}
