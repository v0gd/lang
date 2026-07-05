// Package upload implements the user-pasted-text ingest flow used by the
// /upload endpoint. The user pastes a piece of writing in the language they
// are studying. We run a small pipeline of LLM calls to (a) gate against
// prompt injection and disallowed content (the shared safety package, also
// used by the scan flow), (b) normalize whitespace / control characters and
// extract title + level, (c) annotate noun genders, and (d) segment into
// paragraphs + sentences before persisting as a story with source='provided'.
//
// The pipeline runs up to 4 LLM calls. The safety gate (prompt injection +
// content policy in one combined call) and the normalize call run in
// parallel; the gender annotation and structuring steps run sequentially
// after both have completed.
package upload

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"unicode/utf8"

	"lang/api/gender"
	"lang/api/generator"
	"lang/api/llm"
	"lang/api/safety"
	"lang/api/story"
	"lang/api/stringutil"
	"lang/api/telemetry"
)

// MaxInputChars caps the user-pasted text length. Counted in runes so the
// limit means "characters" the way users expect (a Russian or German
// paragraph won't trip a byte-based limit early).
const MaxInputChars = 10_000

// ErrNoTargetLanguage is returned when the normalization step reports that
// the input does not contain a meaningful amount of target-language text.
var ErrNoTargetLanguage = errors.New("upload: no target-language text")

// ErrInputTooLong / ErrInputEmpty are local validation errors. The handler
// maps them to 4xx HTTP responses.
var (
	ErrInputTooLong = fmt.Errorf("upload: input exceeds %d characters", MaxInputChars)
	ErrInputEmpty   = errors.New("upload: input is empty")
)

// languageNames mirrors scan.languageNames - kept local to avoid importing
// the scan package (the upload flow does not OCR images, the duplication is
// trivial, and the values change only when we add a supported locale).
var languageNames = map[string]string{
	"en": "English",
	"de": "German",
	"ru": "Russian",
}

// --- Normalize + classify ---

type normalizeOutput struct {
	CleanedText           string `json:"cleaned_text" jsonschema_description:"The input text reproduced verbatim except for whitespace/control-character cleanup: strip control chars below U+0020 (except ordinary newlines), collapse runs of spaces/tabs to a single space, trim trailing whitespace on each line, normalize line endings to '\\n', collapse 3+ blank lines to a single blank line, remove leading/trailing blank lines. Preserve paragraph breaks (one blank line between paragraphs) and intra-paragraph line breaks. Do NOT translate, paraphrase, summarize, or 'correct' the text. Preserve diacritics and punctuation exactly. Empty string if has_target_language_text is false."`
	HasTargetLanguageText bool   `json:"has_target_language_text" jsonschema_description:"True if the text contains a meaningful amount of target-language reading material (at least a sentence). Non-target-language fragments embedded naturally in target-language prose (quoted titles, proper nouns, loanwords) do NOT disqualify the text."`
	Title                 string `json:"title" jsonschema_description:"A title for the text, in the target language. Prefer a title that visibly appears in the text (heading, chapter title, article headline); otherwise pick a short descriptive title in the target language. Empty string if has_target_language_text is false."`
	Level                 string `json:"level" jsonschema_description:"Estimated CEFR level of the cleaned text. Must be one of: A1, A1-A2, A2, A2-B1, B1, B1-B2, B2, B2-C1, C1. Use B1 if has_target_language_text is false."`
}

var normalizeSchema = llm.StructuredOutputSchema{
	Schema:      llm.GenerateSchema[normalizeOutput](),
	Name:        "normalize_result",
	Description: "Cleaned text, target-language classification, title, and CEFR level for a pasted passage",
}

func normalizeRole(targetLanguage string) string {
	return fmt.Sprintf("You are a text-cleaning assistant for a %s language-learning service. The user pastes text in %s. Your job is to clean whitespace and control characters, confirm the text is meaningfully in %s, pick a title in %s, and estimate the CEFR difficulty level. You never translate, paraphrase, summarize, or 'fix' the text. You always respond via the requested JSON schema.", targetLanguage, targetLanguage, targetLanguage, targetLanguage)
}

func normalizePrompt(targetLanguage, text string) string {
	return fmt.Sprintf(`The target language is %[1]s.

The goal: the output must read as plain, author-written prose with no leftover machine-readable markup, no navigation/UI noise, no citation pointers, no editorial annotations, and no invisible junk - exactly what would have been on the page if the author had typed it into a plain text file.

Produce "cleaned_text" by applying these principles:

- Whitespace: strip control characters below U+0020 except ordinary newlines; collapse runs of spaces or tabs within a line to a single space; trim trailing whitespace on each line; normalize line endings to "\n"; collapse 3+ consecutive blank lines to one blank line; remove leading and trailing blank lines; preserve paragraph breaks (one blank line between paragraphs) and intra-paragraph line breaks for poetry / dialogue.

- Markup: remove every kind of markup that survived a copy-paste while keeping its visible textual content. This covers HTML / XML tags, Markdown formatting markers (heading hashes, bold/italic asterisks or underscores, inline-code ticks, strikethrough tildes, list-item bullets like "- " / "* " / "1. "), BBCode-style tags, and wiki-style link syntax. Decode common HTML entities to the corresponding character (e.g. "&amp;" becomes "&", numeric entities become their character, "&nbsp;" becomes a regular space).

- Citation, footnote, and editorial markers: remove anything that is not part of the author's voice but was added by an editor, a publishing platform, or a reference system - including but not limited to numeric or alphabetic footnote markers in brackets (e.g. "[1]", "[12]", "[a]"), labelled-note markers ("[note 3]"), editorial annotations ("[citation needed]", "[clarification needed]", "[edit]", "[when?]"), superscript footnote pointers, and similar bracketed reference noise. Remove the brackets and their content entirely, then collapse the whitespace that would otherwise be left behind. Do NOT remove brackets that carry meaningful content from the author - for example "[sic]", stage directions like "[laughs]" / "[crying]", or any bracketed clause that belongs to the prose itself.

- Other non-plain-text noise: remove invisible characters (zero-width characters such as U+200B, U+200C, U+200D, U+FEFF, soft hyphens U+00AD), tracking-style URL fragments that are clearly not part of the prose, and any other artifact that obviously came from the source platform rather than the author.

- Do NOT translate, paraphrase, summarize, correct, or "fix" anything else. Preserve diacritics, normal punctuation, and quotation marks exactly. When you remove a tag or marker, keep its visible content - never drop sentences of reading material.

Set "has_target_language_text" to true only if there is at least a full sentence of %[1]s. Non-%[1]s fragments naturally embedded in %[1]s prose (quoted titles, proper nouns, loanwords) do not disqualify the text. Set it to false for blank input, gibberish, or text entirely in another language.

Pick "title" in %[1]s. Prefer a title visible in the text (a leading heading, chapter title, article headline). Otherwise produce a short descriptive title in %[1]s.

Set "level" to your CEFR estimate of the cleaned text's difficulty.

If "has_target_language_text" is false, return empty strings for "cleaned_text" and "title" and "B1" for "level".

Text to clean:
%[2]s`, targetLanguage, text)
}

func normalizeAndClassify(ctx context.Context, text, targetLanguage string) (normalizeOutput, error) {
	respJson, err := llm.InvokeStructured(
		ctx,
		normalizeRole(targetLanguage),
		normalizePrompt(targetLanguage, text),
		normalizeSchema,
		llm.Gpt,
	)
	if err != nil {
		return normalizeOutput{}, fmt.Errorf("normalize: llm error: %w", err)
	}
	var out normalizeOutput
	if err := json.Unmarshal([]byte(respJson), &out); err != nil {
		return normalizeOutput{}, fmt.Errorf("normalize: failed to unmarshal: %w", err)
	}
	return out, nil
}

// --- Public entry point ---

// Upload runs the full upload pipeline on a single piece of user-pasted text
// and persists the resulting story. Returns one of the sentinel errors above
// on a known failure mode; everything else is wrapped as an unexpected
// internal error. ctx is forwarded into every LLM call in this pipeline so
// cancelling it aborts all in-flight requests.
func Upload(ctx context.Context, text string, r story.Locale, authorId string) (story.StoryMultilingual, error) {
	if strings.TrimSpace(text) == "" {
		return story.StoryMultilingual{}, ErrInputEmpty
	}
	if utf8.RuneCountInString(text) > MaxInputChars {
		return story.StoryMultilingual{}, ErrInputTooLong
	}
	targetLanguage, ok := languageNames[r]
	if !ok {
		return story.StoryMultilingual{}, fmt.Errorf("upload: unsupported target language %q", r)
	}

	trace := telemetry.NewTrace(fmt.Sprintf("Uploading text for %s (%s, %d chars)", r, authorId, utf8.RuneCountInString(text)))
	defer trace.Stop()

	// --- Stage 1: combined safety check + normalize, in parallel.
	// The merged safety call returns both verdicts (prompt injection and
	// content policy) in a single structured response, so we only fire two
	// goroutines here. Normalize runs concurrently; if safety rejects the
	// input we discard the normalize output. We pay for the wasted normalize
	// call on rejected inputs (rare, by design) in exchange for a meaningful
	// latency win on the common case where everything passes.
	var (
		wg        sync.WaitGroup
		verdict   safety.Verdict
		safetyErr error
		norm      normalizeOutput
		normErr   error
	)
	wg.Add(2)
	go func() {
		defer wg.Done()
		verdict, safetyErr = safety.Check(ctx, text)
	}()
	go func() {
		defer wg.Done()
		norm, normErr = normalizeAndClassify(ctx, text, targetLanguage)
	}()
	wg.Wait()
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}

	// Check safety first so that on a rejection we surface the right sentinel
	// error and silently drop whatever normalize produced. Prompt-injection
	// takes precedence over content-policy when both fire, because the
	// content-policy verdict on injection-shaped input is meaningless.
	if safetyErr != nil {
		return story.StoryMultilingual{}, fmt.Errorf("upload: %w", safetyErr)
	}
	if verdict.ContainsPromptInjection {
		slog.Warn(fmt.Sprintf("upload: prompt-injection gate rejected input for user %s", authorId))
		return story.StoryMultilingual{}, safety.ErrPromptInjection
	}
	if verdict.IsDisallowed {
		slog.Warn(fmt.Sprintf("upload: content-policy gate rejected input for user %s (reason=%q)", authorId, verdict.DisallowedReason))
		return story.StoryMultilingual{}, safety.ErrDisallowedContent
	}
	if normErr != nil {
		return story.StoryMultilingual{}, fmt.Errorf("upload: %w", normErr)
	}
	if !norm.HasTargetLanguageText || strings.TrimSpace(norm.CleanedText) == "" {
		return story.StoryMultilingual{}, ErrNoTargetLanguage
	}
	level := normalizeLevel(norm.Level)
	cleaned := norm.CleanedText

	// --- Stage 2: gender annotation (de/ru only) ---
	// Soft fallback: on annotation failure we proceed with the unannotated
	// text - the story is still usable, just without gender coloring. Same
	// pattern as the scan path.
	annotated := cleaned
	if gender.Supports(r) {
		out, aErr := gender.Annotate(ctx, cleaned, r)
		if aErr != nil {
			if errors.Is(aErr, context.Canceled) || errors.Is(aErr, context.DeadlineExceeded) || ctx.Err() != nil {
				return story.StoryMultilingual{}, aErr
			}
			slog.Error(fmt.Sprintf("upload: gender.Annotate failed for %s: %v", r, aErr))
		} else {
			annotated = out
		}
	}
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}

	// --- Stage 3: structuring ---
	structured, err := generator.ConvertMonolingualStoryToStructured(ctx, annotated)
	if err != nil {
		return story.StoryMultilingual{}, fmt.Errorf("upload: failed to structure text: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}
	// Normalization already gave us a target-language title outside the
	// annotated text, so we prefer it. Strip any stray gender markers from
	// the structurer's fallback title just in case.
	if title := strings.TrimSpace(norm.Title); title != "" {
		structured.Title = title
	} else {
		structured.Title = gender.Strip(structured.Title)
	}

	storyId := "g_" + stringutil.RandomBase32(20)
	sMult := story.StoryMultilingual{
		Id:    storyId,
		Level: level,
		Localizations: map[story.Locale]story.Story{
			r: {
				Title: structured.Title,
				Chapters: []story.Chapter{
					{Paragraphs: generator.ToStoryParagraphsFromMonolingual(structured)},
				},
			},
		},
	}
	story.CalculateSentenceAndSegmentIndices(&sMult)

	// Topics, moods and L don't apply to user-pasted text - we only carry
	// over what we actually inferred (level + the target language).
	params := generator.InputParameters{
		Level: level,
		R:     r,
	}
	if err := ctx.Err(); err != nil {
		return story.StoryMultilingual{}, err
	}
	if err := generator.Store(ctx, sMult, params, authorId, generator.SourceProvided); err != nil {
		return story.StoryMultilingual{}, fmt.Errorf("upload: failed to persist story: %w", err)
	}
	return sMult, nil
}

// normalizeLevel constrains the LLM-reported level to story.LEVELS, falling
// back to B1 on anything unexpected. Same defensive fallback as the scan
// path.
func normalizeLevel(raw string) story.Level {
	for _, l := range story.LEVELS {
		if l == raw {
			return l
		}
	}
	return "B1"
}
