package tts

import (
	"context"
	"fmt"
	"io"
	"lang/api/cache"
	"lang/api/osutil"
	"lang/api/telemetry"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/polly"
	"github.com/aws/aws-sdk-go-v2/service/polly/types"
)

var client *polly.Client

func relativePath(filename string) string {
	dir, err := os.Getwd()
	if err != nil {
		panic(fmt.Sprintf("Failed to get working directory: %v", err))
	}
	return filepath.Join(dir, filename)
}

var (
	VOICE_BY_LOCALE = map[string]types.VoiceId{
		"en": types.VoiceIdSalli,
		"de": types.VoiceIdVicki,
		"ru": types.VoiceIdTatyana,
	}

	ENGINE_BY_LOCALE = map[string]types.Engine{
		"en": types.EngineNeural,
		"de": types.EngineNeural,
		"ru": types.EngineStandard,
	}
)

// outputPathLocks serializes concurrent synthesis of the same audio file so
// two cache misses for the same sentence don't both call Polly and clobber
// each other's writes. Entries are never removed; the map is bounded by the
// number of distinct sentences served since the process started.
var outputPathLocks sync.Map

func lockOutputPath(outputPath string) *sync.Mutex {
	lock, _ := outputPathLocks.LoadOrStore(outputPath, &sync.Mutex{})
	mutex := lock.(*sync.Mutex)
	mutex.Lock()
	return mutex
}

func generateAndCache(ctx context.Context, client *polly.Client, text, locale, outputPath string) error {
	trace := telemetry.NewTrace("tts.generateAndCache")
	defer trace.Stop()

	engine, ok := ENGINE_BY_LOCALE[locale]
	if !ok {
		return fmt.Errorf("unknown locale for engine: %s", locale)
	}

	voice, ok := VOICE_BY_LOCALE[locale]
	if !ok {
		return fmt.Errorf("unknown locale for voice: %s", locale)
	}

	text = strings.ReplaceAll(text, "<", "")
	text = strings.ReplaceAll(text, ">", "")
	text = fmt.Sprintf("<speak><prosody rate=\"slow\">%s</prosody></speak>", text)

	resp, err := client.SynthesizeSpeech(ctx, &polly.SynthesizeSpeechInput{
		Text:         aws.String(text),
		OutputFormat: "mp3",
		Engine:       engine,
		VoiceId:      voice,
		TextType:     types.TextTypeSsml,
	})
	if err != nil {
		return fmt.Errorf("failed to synthesize speech: %w", err)
	}
	if resp.AudioStream == nil {
		return fmt.Errorf("AudioStream is not in response")
	}
	defer resp.AudioStream.Close()

	// Write to a temp file in the same directory and rename into place, so a
	// failed or interrupted write never leaves a truncated mp3 behind that
	// would then be served forever as a "cached" file.
	tempFile, err := os.CreateTemp(filepath.Dir(outputPath), filepath.Base(outputPath)+".tmp-*")
	if err != nil {
		return fmt.Errorf("failed to create temp output file: %w", err)
	}
	tempPath := tempFile.Name()
	removeTemp := func() {
		if removeErr := os.Remove(tempPath); removeErr != nil && !os.IsNotExist(removeErr) {
			slog.Error(fmt.Sprintf("Failed to remove temp TTS file %s: %v", tempPath, removeErr))
		}
	}

	if _, err := io.Copy(tempFile, resp.AudioStream); err != nil {
		_ = tempFile.Close()
		removeTemp()
		return fmt.Errorf("failed to write audio: %w", err)
	}
	if err := tempFile.Close(); err != nil {
		removeTemp()
		return fmt.Errorf("failed to close audio file: %w", err)
	}
	if err := os.Rename(tempPath, outputPath); err != nil {
		removeTemp()
		return fmt.Errorf("failed to move audio file into place: %w", err)
	}

	return nil
}

// Get returns the path to the cached mp3 for the given sentence, synthesizing
// it via Polly on first use. Concurrent requests for the same sentence are
// serialized so only one of them pays for synthesis.
func Get(ctx context.Context, text, locale, storyDir string, sentenceIdx int) (string, error) {
	dirPath := cache.Path(fmt.Sprintf("stories/%s/%s", storyDir, locale))
	if err := os.MkdirAll(dirPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	outputPath := filepath.Join(dirPath, fmt.Sprintf("%d.mp3", sentenceIdx))

	mutex := lockOutputPath(outputPath)
	defer mutex.Unlock()

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		slog.Info(fmt.Sprintf("Generating audio at %s", outputPath))
		if err := generateAndCache(ctx, client, text, locale, outputPath); err != nil {
			return "", err
		}
	}
	return outputPath, nil
}

func Setup() {
	slog.Info("Setting up Polly client")

	awsAccessKeyID := osutil.MustGetEnv("AWS_POLLY_ACCESS_KEY_ID")
	awsSecretAccessKey := osutil.MustGetEnv("AWS_POLLY_SECRET_ACCESS_KEY")

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion("eu-west-1"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			awsAccessKeyID,
			awsSecretAccessKey,
			"",
		)),
	)
	if err != nil {
		panic(fmt.Sprintf("Failed to load AWS configuration: %v", err))
	}

	client = polly.NewFromConfig(cfg)
	slog.Info("Polly client setup complete")
}

func Test() {
	slog.Info("Running TTS test")
	if err := generateAndCache(context.Background(), client, "Hello, world!", "en", relativePath("hello.mp3")); err != nil {
		panic(fmt.Sprintf("Error generating audio: %v", err))
	}
	slog.Info("Done")
}
