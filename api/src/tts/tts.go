package tts

import (
	"context"
	"fmt"
	"io"
	"lang/api/cache"
	"lang/api/osutil"
	"lang/api/telemetry"
	"log"
	"os"
	"path/filepath"
	"strings"

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
		log.Fatalf("Failed to get working directory: %v", err)
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

// TODO: this is not thread safe
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

	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, resp.AudioStream); err != nil {
		return fmt.Errorf("failed to write audio: %w", err)
	}

	return nil
}

func Get(text, locale, storyDir string, sentenceIdx int) (string, error) {
	dirPath := cache.Path(fmt.Sprintf("stories/%s/%s", storyDir, locale))
	if err := os.MkdirAll(dirPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	outputPath := filepath.Join(dirPath, fmt.Sprintf("%d.mp3", sentenceIdx))
	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		log.Printf("Generating audio at %s", outputPath)
		if err := generateAndCache(context.TODO(), client, text, locale, outputPath); err != nil {
			return "", err
		}
	}
	return outputPath, nil
}

func Setup() {
	log.Println("Setting up Polly client")

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
		log.Fatalf("Failed to load AWS configuration: %v", err)
	}

	client = polly.NewFromConfig(cfg)
	log.Println("Polly client setup complete")
}

func Test() {
	log.Println("Running TTS test")
	if err := generateAndCache(context.TODO(), client, "Hello, world!", "en", relativePath("hello.mp3")); err != nil {
		log.Fatalf("Error generating audio: %v", err)
	}
	log.Println("Done")
}
