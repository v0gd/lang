package llm

import (
	"context"
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
			Temperature:         openai.Float(0.0),
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
		Temperature: anthropic.Float(0.0),
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
			Temperature:         openai.Float(0.0),
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
		Temperature: anthropic.Float(0.0),
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
