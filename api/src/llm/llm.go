package llm

import (
	"context"
	"fmt"
	"lang/api/osutil"
	"lang/api/telemetry"

	"github.com/invopop/jsonschema"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/shared"
)

// Set up OpenAI client
var openaiClient = openai.NewClient(option.WithAPIKey(osutil.MustGetEnv("OPENAI_API_KEY")))

func roleTruncatedForTrace(role string) string {
	if len(role) > 40 {
		return role[:40] + "..."
	}
	return role
}

type Model string

const (
	Gpt5_4     Model = "Gpt5_4"
	Gpt5_4Mini Model = "Gpt5_4Mini"
)

func Invoke(role string, content string, model Model) (string, error) {
	switch model {
	case Gpt5_4:
		return invokeGpt(role, content, openai.ChatModelGPT5_4)
	case Gpt5_4Mini:
		return invokeGpt(role, content, openai.ChatModelGPT5_4Mini)
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
			Model:            model,
			Messages:         messages,
			FrequencyPenalty: openai.Float(0.0),
			PresencePenalty:  openai.Float(0.0),
			Temperature:      openai.Float(0.0),
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
	case Gpt5_4:
		return invokeGptStructured(role, content, schema, openai.ChatModelGPT5_4)
	case Gpt5_4Mini:
		return invokeGptStructured(role, content, schema, openai.ChatModelGPT5_4Mini)
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
			Model:            model,
			Messages:         messages,
			FrequencyPenalty: openai.Float(0.0),
			PresencePenalty:  openai.Float(0.0),
			Temperature:      openai.Float(0.0),
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
	resp, err := Invoke(role, content, Gpt5_4)
	if err != nil {
		panic(err)
	}
	fmt.Println(resp)
	println("ChatGPT test passed")
}
