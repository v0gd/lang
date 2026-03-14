import getFlagEmoji from "./LanguageFlag";

export function LanguageDropdown({
  language,
  excludeLanguage,
  setLanguage,
}: {
  language: string;
  excludeLanguage: string | undefined;
  setLanguage: (value: string) => void;
}) {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(event.target.value);
  };

  return (
    <select value={language} onChange={handleChange}>
      {excludeLanguage !== "en" && (
        <option value="en">{getFlagEmoji("en")}</option>
      )}
      {excludeLanguage !== "de" && (
        <option value="de">{getFlagEmoji("de")}</option>
      )}
      {excludeLanguage !== "ru" && (
        <option value="ru">{getFlagEmoji("ru")}</option>
      )}
    </select>
  );
}
