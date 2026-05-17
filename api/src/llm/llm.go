package llm

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"lang/api/osutil"
	"lang/api/telemetry"

	"github.com/anthropics/anthropic-sdk-go"
	anthropicopt "github.com/anthropics/anthropic-sdk-go/option"
	"github.com/invopop/jsonschema"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/shared"
)

var openaiClient = openai.NewClient(option.WithAPIKey(osutil.MustGetEnv("OPENAI_API_KEY")))
var anthropicClient = anthropic.NewClient(anthropicopt.WithAPIKey(osutil.MustGetEnv("ANTHROPIC_API_KEY")))

func roleTruncatedForTrace(role string) string {
	if len(role) > 40 {
		return role[:40] + "..."
	}
	return role
}

type Model string

const (
	Gpt          Model = "Gpt"
	GptMini      Model = "GptMini"
	ClaudeSonnet Model = "ClaudeSonnet"
	ClaudeOpus   Model = "ClaudeOpus"
)

const maxTokens = 8192

func Invoke(role string, content string, model Model) (string, error) {
	switch model {
	case Gpt:
		return invokeGpt(role, content, openai.ChatModel("gpt-5.5"))
	case GptMini:
		return invokeGpt(role, content, openai.ChatModelGPT5_4Mini)
	case ClaudeSonnet:
		return invokeClaude(role, content, anthropic.ModelClaudeSonnet4_6)
	case ClaudeOpus:
		return invokeClaude(role, content, anthropic.ModelClaudeOpus4_7)
	default:
		return "", fmt.Errorf("Unknown model")
	}
}

func invokeGpt(role string, content string, model openai.ChatModel) (string, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Invoking Gpt \"%s\"", roleTruncatedForTrace(role)))
	defer trace.Stop()

	messages := []openai.ChatCompletionMessageParamUnion{}
	if role != "" {
		messages = append(messages, openai.SystemMessage(role))
	}
	messages = append(messages, openai.UserMessage(content))

	resp, err := openaiClient.Chat.Completions.New(
		context.Background(),
		openai.ChatCompletionNewParams{
			Model:               model,
			Messages:            messages,
			MaxCompletionTokens: openai.Int(maxTokens),
			FrequencyPenalty:    openai.Float(0.0),
			PresencePenalty:     openai.Float(0.0),
		},
	)
	if err != nil {
		return "", err
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no choices returned")
	}

	choice := resp.Choices[0]
	if choice.FinishReason != "stop" {
		return "", fmt.Errorf("finished with non-stop reason: %s", choice.FinishReason)
	}
	if choice.Message.Content == "" {
		return "", fmt.Errorf("empty response")
	}

	return choice.Message.Content, nil
}

func invokeClaude(role string, content string, model anthropic.Model) (string, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Invoking Claude \"%s\"", roleTruncatedForTrace(role)))
	defer trace.Stop()

	params := anthropic.MessageNewParams{
		Model:       model,
		MaxTokens:   maxTokens,
		Messages:    []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(content))},
	}
	if role != "" {
		params.System = []anthropic.TextBlockParam{{Text: role}}
	}

	resp, err := anthropicClient.Messages.New(context.Background(), params)
	if err != nil {
		return "", err
	}

	if resp.StopReason != anthropic.StopReasonEndTurn {
		return "", fmt.Errorf("finished with non-end_turn reason: %s", resp.StopReason)
	}

	for _, block := range resp.Content {
		if block.Type == "text" {
			if block.Text == "" {
				return "", fmt.Errorf("empty response")
			}
			return block.Text, nil
		}
	}

	return "", fmt.Errorf("no text content in response")
}

func GenerateSchema[T any]() interface{} {
	// Structured Outputs uses a subset of JSON schema
	// These flags are necessary to comply with the subset
	reflector := jsonschema.Reflector{
		AllowAdditionalProperties: false,
		DoNotReference:            true,
	}
	var v T
	schema := reflector.Reflect(v)
	return schema
}

type StructuredOutputSchema struct {
	Schema      interface{}
	Name        string
	Description string
}

// It's up to the caller to unmarshal the response into the desired type:
// `
// response, err := InvokeStructured(...)
// myType := MyType{}
// err = json.Unmarshal(response, &myType)
//
//	if err != nil {
//	  ...
//	}
//
// `
func InvokeStructured(role string, content string, schema StructuredOutputSchema, model Model) (string, error) {
	switch model {
	case Gpt:
		return invokeGptStructured(role, content, schema, openai.ChatModel("gpt-5.5"))
	case GptMini:
		return invokeGptStructured(role, content, schema, openai.ChatModelGPT5_4Mini)
	case ClaudeSonnet:
		return invokeClaudeStructured(role, content, schema, anthropic.ModelClaudeSonnet4_6)
	case ClaudeOpus:
		return invokeClaudeStructured(role, content, schema, anthropic.ModelClaudeOpus4_7)
	default:
		return "", fmt.Errorf("Unknown model")
	}
}

func invokeGptStructured(role string, content string, schema StructuredOutputSchema, model openai.ChatModel) (string, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Invoking Structured Gpt \"%s\" model=%v", roleTruncatedForTrace(role), model))
	defer trace.Stop()

	schemaParam := shared.ResponseFormatJSONSchemaJSONSchemaParam{
		Name:        schema.Name,
		Description: openai.String(schema.Description),
		Schema:      schema.Schema,
		Strict:      openai.Bool(true),
	}

	messages := []openai.ChatCompletionMessageParamUnion{}
	if role != "" {
		messages = append(messages, openai.SystemMessage(role))
	}
	messages = append(messages, openai.UserMessage(content))

	resp, err := openaiClient.Chat.Completions.New(
		context.Background(),
		openai.ChatCompletionNewParams{
			Model:               model,
			Messages:            messages,
			MaxCompletionTokens: openai.Int(maxTokens),
			FrequencyPenalty:    openai.Float(0.0),
			PresencePenalty:     openai.Float(0.0),
			ResponseFormat: openai.ChatCompletionNewParamsResponseFormatUnion{
				OfJSONSchema: &shared.ResponseFormatJSONSchemaParam{
					JSONSchema: schemaParam,
				},
			},
		},
	)
	if err != nil {
		return "", err
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no choices returned")
	}

	choice := resp.Choices[0]
	if choice.FinishReason != "stop" {
		return "", fmt.Errorf("finished with non-stop reason: %s", choice.FinishReason)
	}
	if choice.Message.Content == "" {
		return "", fmt.Errorf("empty response")
	}

	return choice.Message.Content, nil
}

func invokeClaudeStructured(role string, content string, schema StructuredOutputSchema, model anthropic.Model) (string, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Invoking Structured Claude \"%s\" model=%v", roleTruncatedForTrace(role), model))
	defer trace.Stop()

	schemaBytes, err := json.Marshal(schema.Schema)
	if err != nil {
		return "", fmt.Errorf("failed to marshal schema: %w", err)
	}
	var schemaMap map[string]any
	if err := json.Unmarshal(schemaBytes, &schemaMap); err != nil {
		return "", fmt.Errorf("failed to unmarshal schema to map: %w", err)
	}

	params := anthropic.MessageNewParams{
		Model:       model,
		MaxTokens:   maxTokens,
		Messages:    []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(content))},
		OutputConfig: anthropic.OutputConfigParam{
			Format: anthropic.JSONOutputFormatParam{
				Schema: schemaMap,
			},
		},
	}
	if role != "" {
		params.System = []anthropic.TextBlockParam{{Text: role}}
	}

	resp, err := anthropicClient.Messages.New(context.Background(), params)
	if err != nil {
		return "", err
	}

	if resp.StopReason != anthropic.StopReasonEndTurn {
		return "", fmt.Errorf("finished with non-end_turn reason: %s", resp.StopReason)
	}

	for _, block := range resp.Content {
		if block.Type == "text" {
			if block.Text == "" {
				return "", fmt.Errorf("empty response")
			}
			return block.Text, nil
		}
	}

	return "", fmt.Errorf("no text content in response")
}

// ImageInput is a single image to attach to a multimodal LLM request. MimeType
// must be a real "image/*" content type; Bytes is the raw decoded image data
// (it is base64-encoded internally before being sent to the provider).
type ImageInput struct {
	Bytes    []byte
	MimeType string
}

// InvokeStructuredWithImages sends a multimodal request (text + N images) and
// asks the model to respond with JSON matching the given schema. Currently
// only the OpenAI vision-capable models (Gpt, GptMini) are supported; passing
// any other model returns an error.
func InvokeStructuredWithImages(
	role string,
	content string,
	images []ImageInput,
	schema StructuredOutputSchema,
	model Model,
) (string, error) {
	switch model {
	case Gpt:
		return invokeGptStructuredWithImages(role, content, images, schema, openai.ChatModel("gpt-5.5"))
	case GptMini:
		return invokeGptStructuredWithImages(role, content, images, schema, openai.ChatModelGPT5_4Mini)
	default:
		return "", fmt.Errorf("model %q does not support image inputs", model)
	}
}

func invokeGptStructuredWithImages(
	role string,
	content string,
	images []ImageInput,
	schema StructuredOutputSchema,
	model openai.ChatModel,
) (string, error) {
	trace := telemetry.NewTrace(fmt.Sprintf(
		"Invoking Structured Gpt (vision, %d image(s)) \"%s\" model=%v",
		len(images), roleTruncatedForTrace(role), model))
	defer trace.Stop()

	if len(images) == 0 {
		return "", fmt.Errorf("at least one image is required")
	}

	parts := make([]openai.ChatCompletionContentPartUnionParam, 0, len(images)+1)
	parts = append(parts, openai.TextContentPart(content))
	for i, img := range images {
		if len(img.Bytes) == 0 {
			return "", fmt.Errorf("image %d is empty", i)
		}
		if img.MimeType == "" {
			return "", fmt.Errorf("image %d has no mime type", i)
		}
		dataURL := fmt.Sprintf("data:%s;base64,%s", img.MimeType, base64.StdEncoding.EncodeToString(img.Bytes))
		parts = append(parts, openai.ImageContentPart(openai.ChatCompletionContentPartImageImageURLParam{
			URL:    dataURL,
			Detail: "high",
		}))
	}

	messages := []openai.ChatCompletionMessageParamUnion{}
	if role != "" {
		messages = append(messages, openai.SystemMessage(role))
	}
	messages = append(messages, openai.UserMessage(parts))

	schemaParam := shared.ResponseFormatJSONSchemaJSONSchemaParam{
		Name:        schema.Name,
		Description: openai.String(schema.Description),
		Schema:      schema.Schema,
		Strict:      openai.Bool(true),
	}

	resp, err := openaiClient.Chat.Completions.New(
		context.Background(),
		openai.ChatCompletionNewParams{
			Model:               model,
			Messages:            messages,
			MaxCompletionTokens: openai.Int(maxTokens),
			FrequencyPenalty:    openai.Float(0.0),
			PresencePenalty:     openai.Float(0.0),
			ResponseFormat: openai.ChatCompletionNewParamsResponseFormatUnion{
				OfJSONSchema: &shared.ResponseFormatJSONSchemaParam{
					JSONSchema: schemaParam,
				},
			},
		},
	)
	if err != nil {
		return "", err
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no choices returned")
	}

	choice := resp.Choices[0]
	if choice.FinishReason != "stop" {
		return "", fmt.Errorf("finished with non-stop reason: %s", choice.FinishReason)
	}
	if choice.Message.Content == "" {
		return "", fmt.Errorf("empty response")
	}

	return choice.Message.Content, nil
}

func Test() {
	println("Testing ChatGPT")
	role := "You are a pirate."
	content := "Greet me"
	resp, err := Invoke(role, content, Gpt)
	if err != nil {
		panic(err)
	}
	fmt.Println(resp)
	println("ChatGPT test passed")
}
