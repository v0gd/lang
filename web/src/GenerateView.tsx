import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGenerateStoryMutation } from "./queries";
import { useLoggedIn } from "./firebase";
import { lstr } from "./localization";

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

export function GenerateStoryView({ l, r }: { l: string; r: string }) {
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const handleLevelSelect = (level: string) => setSelectedLevel(level);

  const navigate = useNavigate();
  const generate = useGenerateStoryMutation();
  const loggedIn = useLoggedIn();

  const handleMoodSelect = (mood: string) => {
    setSelectedMoods((prev) =>
      prev.includes(mood)
        ? prev.filter((m) => m !== mood)
        : prev.length < 2
          ? [...prev, mood]
          : prev,
    );
  };

  const handleTopicSelect = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : prev.length < 2
          ? [...prev, topic]
          : prev,
    );
  };

  const handleGenerate = async () => {
    if (!loggedIn) {
      navigate("/login");
      return;
    }
    if (!generate.isIdle) return;
    generate.mutate({
      l: l,
      r: r,
      level: selectedLevel,
      moods: selectedMoods,
      topics: selectedTopics,
    });
  };

  useEffect(() => {
    if (generate.isSuccess) {
      navigate(`/generated/${generate.data.id}`);
    }
  }, [generate.isSuccess, generate.data, navigate]);

  const strings = lstr(l);

  const chipBase = "px-4 py-2 rounded-xl border text-sm font-medium transition-colors";
  const chipSelected = "bg-primary text-white border-primary";
  const chipUnselected = "bg-surface text-main-text border-border hover:bg-cream-dark";

  return (
    <div className="flex flex-col gap-8 max-w-xl mx-auto">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary-text mb-3">
          Language Proficiency
        </h2>
        <div className="flex flex-wrap gap-2">
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => handleLevelSelect(level)}
              className={`${chipBase} ${selectedLevel === level ? chipSelected : chipUnselected}`}
            >
              {strings.levels[level]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary-text mb-3">
          Mood (select up to 2)
        </h2>
        <div className="flex flex-wrap gap-2">
          {moods.map((mood) => (
            <button
              key={mood}
              onClick={() => handleMoodSelect(mood)}
              className={`${chipBase} ${selectedMoods.includes(mood) ? chipSelected : chipUnselected}`}
            >
              {strings.moods[mood]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary-text mb-3">
          Topics (select up to 2)
        </h2>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => handleTopicSelect(topic)}
              className={`${chipBase} ${selectedTopics.includes(topic) ? chipSelected : chipUnselected}`}
            >
              {strings.topics[topic]}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        className="w-full py-3 rounded-xl bg-primary text-white font-semibold transition-colors hover:bg-primary-hover disabled:opacity-50"
        disabled={loggedIn && !generate.isIdle}
      >
        {!loggedIn && "Log in to Generate a new story"}
        {loggedIn && generate.isIdle && "Generate!"}
        {loggedIn && generate.isError && "Error — try again"}
        {loggedIn && !generate.isIdle && !generate.isError && "Generating..."}
      </button>
    </div>
  );
}
