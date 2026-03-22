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
        type="checkbox"
        checked={isChecked}
        onChange={handleOnChange}
      />
      <label className="text-sm text-main-text select-none cursor-pointer" onClick={handleOnChange}>
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
        type="checkbox"
        checked={isChecked}
        disabled={!isEnabled}
        onChange={handleOnChange}
      />
      <label
        className={`text-sm text-main-text select-none ${isEnabled ? "cursor-pointer" : "cursor-not-allowed"}`}
        onClick={isEnabled ? handleOnChange : undefined}
      >
        {lstr(l).show_translation_by_sentence_checkbox}
      </label>
    </div>
  );
}
