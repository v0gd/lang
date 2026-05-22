// Package gender provides a small grammar-gender annotation helper used to
// decorate German and Russian story text with {m}, {f} or {n} markers
// placed immediately after every noun. The markers are stored verbatim in
// the story.content JSON blob and stripped at consumption points (TTS,
// explanation prompts, word-extraction) where they would otherwise leak
// into prompts or audio. The frontend strips them at render time and uses
// them to color nouns by grammatical gender.
package gender

import (
	"context"
	"encoding/json"
	"fmt"
	"lang/api/llm"
	"lang/api/telemetry"
	"regexp"
)

// Marker matches the gender annotation pattern: a single-letter gender code
// in curly braces, attached directly to a noun with no whitespace, e.g.
// "Haus{n}", "Frau{f}", "Tag{m}".
var Marker = regexp.MustCompile(`\{[mfn]\}`)

// Supports reports whether the given locale is one we annotate. We restrict
// the annotator to languages where grammatical gender is morphologically
// meaningful AND useful to learners (German and Russian). For other locales
// the caller should skip Annotate entirely.
func Supports(locale string) bool {
	return locale == "de" || locale == "ru"
}

// Strip removes every {m}/{f}/{n} marker from text. Idempotent.
func Strip(text string) string {
	return Marker.ReplaceAllString(text, "")
}

type annotationOutput struct {
	Annotated string `json:"annotated" jsonschema_description:"The input text reproduced verbatim except that every noun in the target language is immediately followed by a gender marker: {m} for masculine, {f} for feminine, {n} for neuter. No spaces between the noun and the marker."`
}

var annotationSchema = llm.StructuredOutputSchema{
	Schema:      llm.GenerateSchema[annotationOutput](),
	Name:        "gender_annotation",
	Description: "input text with grammatical gender markers appended after each target-language noun",
}

var languageNames = map[string]string{
	"de": "German",
	"ru": "Russian",
}

func annotationRole(languageName string) string {
	return fmt.Sprintf(
		"You are a precise linguistic annotator for a %s language-learning app. "+
			"Your only job is to tag nouns in %s text with their grammatical gender so learners can memorize articles by color. "+
			"You never paraphrase, translate, summarize, reorder, correct, or otherwise change the input text.",
		languageName, languageName)
}

func annotationPrompt(languageName, text string) string {
	return fmt.Sprintf(`Take the following %[1]s text and return it verbatim, except that every %[1]s noun must be immediately followed by a gender marker:

- {m} for masculine
- {f} for feminine
- {n} for neuter

Hard rules:
- Reproduce the input character-for-character. Preserve punctuation, capitalization, diacritics, paragraph breaks, blank lines, and any embedded non-%[1]s words exactly as written.
- The marker is attached directly to the noun with NO space: "Haus{n}", "Frau{f}", "Tag{m}". Any punctuation that follows the noun goes after the marker: "den Tag{m}.", "die Frau{f},".
- Annotate every %[1]s common noun, including compound nouns (annotate as one word using the gender of the head noun), nouns inside parenthetical phrases, and nouns after prepositions and articles.

Plural nouns:
- A plural noun is annotated with the gender of its SINGULAR (dictionary / lemma) form. Do NOT pick a gender based on the plural form's ending or the plural article.
- In German, the plural article is always "die", but the grammatical gender of the noun is still its singular gender. Examples: "die Augen" -> "die Augen{n}" (because the singular is "das Auge"), "die Tage" -> "die Tage{m}" (singular "der Tag"), "die Frauen" -> "die Frauen{f}" (singular "die Frau"), "die Häuser" -> "die Häuser{n}" (singular "das Haus").
- In Russian, the plural form likewise keeps the singular's gender. Examples: "столы" -> "столы{m}" (singular "стол"), "окна" -> "окна{n}" (singular "окно"), "книги" -> "книги{f}" (singular "книга").

Other:
- Do NOT annotate articles, pronouns, adjectives, verbs, adverbs, numbers, proper names of people or places, brand names, or acronyms.
- Do NOT annotate words inside fragments written in another language (quoted titles, foreign loanwords kept in their original script, etc.) - leave those untouched.
- Do NOT add explanations, comments, headers, or any text not present in the input.

Text to annotate:
%[2]s`, languageName, text)
}

// Annotate asks the LLM to append {m}/{f}/{n} markers directly after every
// noun in the given target-language text, without modifying anything else.
// Caller is responsible for skipping the call entirely for unsupported
// locales (use Supports). On failure returns ("", err); callers should log
// and fall back to the original text rather than aborting the whole
// generate/scan request. ctx is forwarded into the underlying LLM call so
// the annotation aborts when the caller's context is cancelled.
func Annotate(ctx context.Context, text, locale string) (string, error) {
	languageName, ok := languageNames[locale]
	if !ok {
		return "", fmt.Errorf("gender.Annotate: unsupported locale %q", locale)
	}

	trace := telemetry.NewTrace(fmt.Sprintf("Annotating gender markers for %s", locale))
	defer trace.Stop()

	// We use the full Gpt model (not GptMini) because gender annotation -
	// especially for plurals, where the article is invariant and the ending
	// is often misleading - benefits noticeably from the stronger model.
	// This is a one-shot per generated/scanned story so the cost overhead
	// is bounded.
	respJson, err := llm.InvokeStructured(
		ctx,
		annotationRole(languageName),
		annotationPrompt(languageName, text),
		annotationSchema,
		llm.Gpt,
	)
	if err != nil {
		return "", fmt.Errorf("gender.Annotate: llm error: %w", err)
	}

	var out annotationOutput
	if err := json.Unmarshal([]byte(respJson), &out); err != nil {
		return "", fmt.Errorf("gender.Annotate: failed to unmarshal response: %w", err)
	}

	if out.Annotated == "" {
		return "", fmt.Errorf("gender.Annotate: empty annotated text in response")
	}

	return out.Annotated, nil
}
