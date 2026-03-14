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

  return (
    <div className="p-6 flex flex-col gap-6 bg-gray-50 rounded-lg shadow-md max-w-xl mx-auto">
      {/* Language Level */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Language Proficiency</h2>
        <div className="flex flex-wrap gap-3">
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => handleLevelSelect(level)}
              className={`px-4 py-2 rounded border 
                ${
                  selectedLevel === level
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
            >
              {strings.levels[level]}
            </button>
          ))}
        </div>
      </div>

      {/* Mood */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Mood (select up to 2)</h2>
        <div className="flex flex-wrap gap-3">
          {moods.map((mood) => (
            <button
              key={mood}
              onClick={() => handleMoodSelect(mood)}
              className={`px-4 py-2 rounded border 
                ${
                  selectedMoods.includes(mood)
                    ? "bg-purple-500 text-white border-purple-500"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
            >
              {strings.moods[mood]}
            </button>
          ))}
        </div>
      </div>

      {/* Topics */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Topics (select up to 2)</h2>
        <div className="flex flex-wrap gap-3">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => handleTopicSelect(topic)}
              className={`px-4 py-2 rounded border 
                ${
                  selectedTopics.includes(topic)
                    ? "bg-green-500 text-white border-green-500"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
            >
              {strings.topics[topic]}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleGenerate}
          className="px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          {!loggedIn && "Log in to Generate a new story"}
          {loggedIn && generate.isIdle && "Generate!"}
          {loggedIn && generate.isError && "Error"}
          {loggedIn && !generate.isIdle && !generate.isError && "Generating..."}
        </button>
      </div>
    </div>
  );
}
