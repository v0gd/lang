import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CancelledError,
  DisallowedContentError,
  OffTopicInstructionsError,
  useGenerateStoryMutation,
  useProgressLinesQuery,
} from "./queries";
import { useLoggedIn } from "./firebase";
import { lstr } from "./localization";
import { levelBadgeClasses } from "./levelColors";
import { ProgressOverlay } from "./ProgressOverlay";
import { FaWandMagicSparkles } from "react-icons/fa6";

export const levels = ["A1", "B1", "C1"] as const;
export const moods = [
  "romantic",
  "dark",
  "funny",
  "silly",
  "scary",
  "hopeful",
  "mysterious",
  "exciting",
  "charming",
  "thoughtful",
  "inspiring",
  "witty",
] as const;
export const topics = [
  "office",
  "family",
  "travel",
  "sports",
  "technology",
  "cooking",
  "fashion",
  "music",
  "science",
  "history",
  "nature",
  "movies",
] as const;

const levelCefr: Record<string, string> = {
  A1: "A1–A2",
  B1: "B1–B2",
  C1: "C1–C2",
};

const moodIcons: Record<string, string> = {
  romantic: "♡",
  dark: "◑",
  funny: "◡",
  silly: "✦",
  scary: "☾",
  hopeful: "☼",
  mysterious: "◌",
  exciting: "↗",
  charming: "✧",
  thoughtful: "⋯",
  inspiring: "✶",
  witty: "◆",
};

const MAX_SELECTIONS = 2;

// Mirrors generator.MaxInstructionsChars on the Go side; the backend
// re-validates the length and normalizes the text, so a client-side bypass
// is caught.
const MAX_INSTRUCTIONS_CHARS = 150;

export function GenerateStoryView({ l, r }: { l: string; r: string }) {
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [instructions, setInstructions] = useState<string>("");

  const handleLevelSelect = (level: string) => setSelectedLevel(level);

  const navigate = useNavigate();
  const generate = useGenerateStoryMutation();
  const loggedIn = useLoggedIn();
  // One AbortController per in-flight request so the cancel button on the
  // overlay can tear down the fetch cleanly. The ref is reset just before
  // each new request so a previous cancellation never poisons a fresh run.
  const abortRef = useRef<AbortController | null>(null);

  const cancelGenerate = () => {
    abortRef.current?.abort();
  };

  // When the user cancels we get a CancelledError from the mutation - reset
  // it to idle so the user can immediately retry without the button stuck on
  // an error state.
  useEffect(() => {
    if (generate.isError && generate.error instanceof CancelledError) {
      generate.reset();
    }
  }, [generate.isError, generate.error, generate]);

  const toggleFromList = (
    item: string,
    list: string[],
    setList: (next: string[]) => void,
  ) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else if (list.length < MAX_SELECTIONS) {
      setList([...list, item]);
    } else {
      setList([...list.slice(1), item]);
    }
  };

  const handleGenerate = async () => {
    if (!loggedIn) {
      navigate("/login");
      return;
    }
    if (!selectedLevel) return;
    if (!generate.isIdle) return;
    abortRef.current = new AbortController();
    generate.mutate({
      l: l,
      r: r,
      level: selectedLevel,
      moods: selectedMoods,
      topics: selectedTopics,
      instructions: instructions.trim(),
      signal: abortRef.current.signal,
    });
  };

  useEffect(() => {
    if (generate.isSuccess) {
      navigate(`/generated/${generate.data.id}`);
    }
  }, [generate.isSuccess, generate.data, navigate]);

  const strings = lstr(l);

  // The playful status lines for the overlay are only fetched while a story
  // is actually being generated; the overlay shows its static message until
  // they arrive (or if the request fails).
  const progressLines = useProgressLinesQuery(
    l,
    selectedMoods,
    generate.isPending,
  );

  // One-line echo of the order, e.g. "Your B1 story is on its way — Scary ·
  // Cooking". Moods and topics keep their display capitalization: lowering
  // the case would be wrong for German nouns.
  const overlaySelectionNames = [
    ...selectedMoods.map((mood) => strings.moods[mood]),
    ...selectedTopics.map((topic) => strings.topics[topic]),
  ];
  const overlayHeadline =
    strings.generate_overlay_headline.replace("{level}", selectedLevel) +
    (overlaySelectionNames.length > 0
      ? ` — ${overlaySelectionNames.join(" · ")}`
      : "");

  const sectionLabel =
    "text-xs font-semibold uppercase tracking-[0.2em] leading-none text-secondary-text";
  const counterActive =
    "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold leading-none bg-primary text-white tracking-normal";
  const counterIdle =
    "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold leading-none bg-cream-dark text-muted-text tracking-normal";
  const optionalLabel =
    "text-[10px] uppercase tracking-[0.18em] leading-none italic text-muted-text";

  const chipBase =
    "px-4 py-3 rounded-xl border text-xs md:text-sm transition-colors text-center";
  const chipSelected = "bg-primary text-white border-primary font-medium";
  const chipUnselected =
    "bg-surface text-secondary-text border-border font-normal hover:bg-cream-dark";
  const optionGrid =
    "grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-2.5";

  const renderCounter = (count: number) => (
    <span className={count > 0 ? counterActive : counterIdle}>
      {count}/{MAX_SELECTIONS}
    </span>
  );

  const canGenerate = !loggedIn || (selectedLevel !== "" && generate.isIdle);

  // Instruction rejections get a specific explanation above the button;
  // editing the instructions resets the mutation so the user can retry.
  // Other errors keep the existing generic button-label treatment.
  const instructionsErrorMessage = (() => {
    if (!generate.isError) return null;
    const err = generate.error;
    if (err instanceof DisallowedContentError)
      return strings.generate_error_disallowed;
    if (err instanceof OffTopicInstructionsError)
      return strings.generate_error_off_topic;
    return null;
  })();

  return (
    <div className="flex flex-col gap-10">
      {generate.isPending && (
        <ProgressOverlay
          l={l}
          message={strings.generate_overlay_message}
          icon={<FaWandMagicSparkles />}
          onCancel={cancelGenerate}
          headline={overlayHeadline}
          rotatingMessages={progressLines.data}
        />
      )}
      <header>
        <h1 className="font-literata text-3xl md:text-4xl font-bold tracking-tight text-main-text leading-tight">
          {strings.generate_title_pre}{" "}
          <span className="text-primary">
            {strings.generate_title_post}
          </span>
        </h1>
      </header>

      <section>
        <h2 className={`${sectionLabel} mb-3`}>
          {strings.generate_level_heading}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {levels.map((level) => {
            const selected = selectedLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => handleLevelSelect(level)}
                className={`px-4 py-7 rounded-xl border transition-colors text-center ${
                  selected
                    ? "border-primary bg-primary-light"
                    : "border-border bg-surface hover:bg-cream-dark"
                }`}
              >
                <div
                  className={`font-literata text-base md:text-lg font-bold ${
                    selected ? "text-main-text" : "text-secondary-text"
                  }`}
                >
                  {strings.levels[level]}
                </div>
                <div className="mt-2 flex justify-center">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${levelBadgeClasses(level)}`}
                  >
                    {levelCefr[level]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className={sectionLabel}>{strings.generate_mood_heading}</h2>
          {renderCounter(selectedMoods.length)}
          <span className={optionalLabel}>
            {strings.generate_topic_optional}
          </span>
        </div>
        <div className={optionGrid}>
          {moods.map((mood) => {
            const selected = selectedMoods.includes(mood);
            return (
              <button
                key={mood}
                type="button"
                onClick={() =>
                  toggleFromList(mood, selectedMoods, setSelectedMoods)
                }
                className={`${chipBase} ${selected ? chipSelected : chipUnselected} flex items-center justify-center gap-2`}
              >
                <span
                  aria-hidden
                  className="text-base leading-none text-current opacity-80"
                >
                  {moodIcons[mood]}
                </span>
                <span>{strings.moods[mood]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className={sectionLabel}>{strings.generate_topic_heading}</h2>
          {renderCounter(selectedTopics.length)}
          <span className={optionalLabel}>
            {strings.generate_topic_optional}
          </span>
        </div>
        <div className={optionGrid}>
          {topics.map((topic) => {
            const selected = selectedTopics.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                onClick={() =>
                  toggleFromList(topic, selectedTopics, setSelectedTopics)
                }
                className={`${chipBase} ${selected ? chipSelected : chipUnselected}`}
              >
                {strings.topics[topic]}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className={sectionLabel}>
              {strings.generate_instructions_heading}
            </h2>
            <span className={optionalLabel}>
              {strings.generate_topic_optional}
            </span>
          </div>
          <span className="text-xs text-muted-text">
            {instructions.length} / {MAX_INSTRUCTIONS_CHARS}
          </span>
        </div>
        <textarea
          value={instructions}
          onChange={(e) => {
            if (generate.isError) generate.reset();
            setInstructions(e.target.value);
          }}
          maxLength={MAX_INSTRUCTIONS_CHARS}
          rows={2}
          placeholder={strings.generate_instructions_placeholder}
          disabled={generate.isPending}
          className="w-full p-4 rounded-xl border border-border bg-surface text-main-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y disabled:opacity-60"
        />
        <p className="mt-2 text-sm text-muted-text">
          {strings.generate_instructions_help}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        {instructionsErrorMessage && (
          <div
            role="alert"
            className="text-sm font-semibold text-red-500 text-center"
          >
            {instructionsErrorMessage}
          </div>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          className="w-full py-4 rounded-xl bg-primary text-white text-lg font-bold transition-colors hover:bg-primary-hover disabled:opacity-50"
          disabled={!canGenerate}
        >
          {!loggedIn && strings.generate_login_prompt}
          {loggedIn && generate.isIdle && selectedLevel && strings.generate_button}
          {loggedIn &&
            generate.isIdle &&
            !selectedLevel &&
            strings.generate_level_required}
          {loggedIn && generate.isError && strings.generate_error}
          {loggedIn &&
            !generate.isIdle &&
            !generate.isError &&
            strings.generate_in_progress}
        </button>
      </section>
    </div>
  );
}
