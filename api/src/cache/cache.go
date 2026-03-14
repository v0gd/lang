package cache

import (
	"encoding/json"
	"fmt"
	"lang/api/osutil"
	"os"
	"path/filepath"
)

var cacheDir = osutil.MustGetEnv("LANG_API_CACHE_DIR")

func Setup() {
	err := os.MkdirAll(cacheDir, 0755)
	if err != nil {
		panic(fmt.Sprintf("Failed to create cache directory: %v", err))
	}
	fmt.Println("Cache directory:", cacheDir)
}

func Path(subpath string) string {
	if subpath == "" {
		return cacheDir
	}
	return filepath.Join(cacheDir, subpath)
}

func MakeDir(subpath string) (string, error) {
	dir := Path(subpath)
	err := os.MkdirAll(dir, 0755)
	if err != nil {
		return "", err
	}
	return dir, nil
}

func ReadFile(subpath string) ([]byte, error) {
	b, err := os.ReadFile(Path(subpath))
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	return b, nil
}

func ReadFileString(subpath string) (string, error) {
	b, err := os.ReadFile(Path(subpath))
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}
	return string(b), nil
}

func WriteFileString(subpath string, s string) error {
	path := Path(subpath)
	return os.WriteFile(path, []byte(s), 0644)
}

func WriteJsonFile(subpath string, v any) error {
	path := Path(subpath)
	vJson, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}
	return os.WriteFile(path, vJson, 0644)
}
