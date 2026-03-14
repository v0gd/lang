package llm

import (
	"context"
	"fmt"
	"lang/api/osutil"
	"lang/api/telemetry"

	"github.com/invopop/jsonschema"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	// Hypothetical Anthropics client (adjust as needed):
	// "github.com/yourorg/anthropic"
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
	Gpt4o     Model = "Gpt4o"
	Gpt4oMini Model = "Gpt4oMini"
	Claude3_7 Model = "Claude"
)

func Invoke(role string, content string, model Model) (string, error) {
	switch model {
	case Gpt4o:
		return invokeGpt(role, content, openai.ChatModelGPT4o2024_11_20)
	case Gpt4oMini:
		return invokeGpt(role, content, openai.ChatModelGPT4oMini2024_07_18)
	case Claude3_7:
		// return invokeAnthropic(role, content)
		return "", fmt.Errorf("Anthropic is not implemented")
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
			Model:            openai.F(model),
			Messages:         openai.F(messages),
			FrequencyPenalty: openai.F(0.0),
			PresencePenalty:  openai.F(0.0),
			Temperature:      openai.F(0.0),
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
	case Gpt4o:
		return invokeGptStructured(role, content, schema, openai.ChatModelGPT4o2024_11_20)
	case Gpt4oMini:
		return invokeGptStructured(role, content, schema, openai.ChatModelGPT4oMini2024_07_18)
	case Claude3_7:
		// return invokeAnthropic(role, content)
		return "", fmt.Errorf("Anthropic is not implemented")
	default:
		return "", fmt.Errorf("Unknown model")
	}
}

func invokeGptStructured(role string, content string, schema StructuredOutputSchema, model openai.ChatModel) (string, error) {
	trace := telemetry.NewTrace(fmt.Sprintf("Invoking Structured Gpt \"%s\" model=%v", roleTruncatedForTrace(role), model))
	defer trace.Stop()

	schemaParam := openai.ResponseFormatJSONSchemaJSONSchemaParam{
		Name:        openai.F(schema.Name),
		Description: openai.F(schema.Description),
		Schema:      openai.F(schema.Schema),
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
			Model:            openai.F(model),
			Messages:         openai.F(messages),
			FrequencyPenalty: openai.F(0.0),
			PresencePenalty:  openai.F(0.0),
			Temperature:      openai.F(0.0),
			ResponseFormat: openai.F[openai.ChatCompletionNewParamsResponseFormatUnion](
				openai.ResponseFormatJSONSchemaParam{
					Type:       openai.F(openai.ResponseFormatJSONSchemaTypeJSONSchema),
					JSONSchema: openai.F(schemaParam),
				},
			),
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
	resp, err := Invoke(role, content, Gpt4o)
	if err != nil {
		panic(err)
	}
	fmt.Println(resp)
	println("ChatGPT test passed")
}

// Set up Anthropics client (this is pseudocode; use a real Anthropics Go client if available)
/*
var anthropicClient = anthropic.NewClient(readKey("ANTHROPIC_API_KEY"))

func invokeAnthropic(role *string, content string) (string, error) {
	var prompt string
	if role != nil {
		prompt = fmt.Sprintf("%s\n\n%s", *role, content)
	} else {
		prompt = content
	}

	resp, err := anthropicClient.CreateCompletion(context.Background(), anthropic.Request{
		Model:     anthropicModel,
		MaxTokens: 1024,
		Messages: []anthropic.Message{
			{Role: anthropic.User, Content: prompt},
		},
	})
	if err != nil {
		return "", err
	}

	// Adjust parsing based on the actual Anthropics client response structure
	if len(resp.Messages) == 0 {
		return "", fmt.Errorf("empty response from Anthropics")
	}

	// Here we assume the first message contains the content
	return resp.Messages[0].Content, nil
}
*/

// For demonstration, we'll just wrap one of the calls. In actual code, choose one or implement both.
/*
func invoke(role *string, content string) (string, error) {
	// return invokeChatGPT(role, content)
	return invokeAnthropic(role, content)
}
*/
