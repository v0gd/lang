import { lstr } from "./localization";

export function ShowTranslationCheckbox({
  isChecked,
  l,
  setIsChecked,
}: {
  isChecked: boolean;
  l: string;
  setIsChecked: (value: boolean) => void;
}) {
  const handleOnChange = () => {
    setIsChecked(!isChecked);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        id="show-translation-checkbox"
        type="checkbox"
        checked={isChecked}
        onChange={handleOnChange}
      />
      <label
        htmlFor="show-translation-checkbox"
        className="text-sm text-main-text select-none cursor-pointer"
      >
        {lstr(l).show_translation_checkbox}
      </label>
    </div>
  );
}

export function ShowTranslationBySentenceCheckbox({
  isChecked,
  isEnabled,
  l,
  setIsChecked,
}: {
  isChecked: boolean;
  isEnabled: boolean;
  l: string;
  setIsChecked: (value: boolean) => void;
}) {
  const handleOnChange = () => {
    setIsChecked(!isChecked);
  };

  return (
    <div className={`flex items-center gap-2 ${!isEnabled ? "opacity-40" : ""}`}>
      <input
        id="show-translation-by-sentence-checkbox"
        type="checkbox"
        checked={isChecked}
        disabled={!isEnabled}
        onChange={handleOnChange}
      />
      <label
        htmlFor="show-translation-by-sentence-checkbox"
        className={`text-sm text-main-text select-none ${isEnabled ? "cursor-pointer" : "cursor-not-allowed"}`}
      >
        {lstr(l).show_translation_by_sentence_checkbox}
      </label>
    </div>
  );
}
