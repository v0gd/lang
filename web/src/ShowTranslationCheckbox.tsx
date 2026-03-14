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
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleOnChange}
        className="w-4 h-4 text-blue-600 bg-gray-100 rounded border-gray-300 focus:ring-blue-500 focus:ring-2 accent-teal-600"
      />
      <label className="text-sm text-[#F8F3E6]">
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
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={isChecked}
        disabled={!isEnabled}
        onChange={handleOnChange}
        className="w-4 h-4 text-blue-600 bg-gray-100 rounded border-gray-300 focus:ring-blue-500 focus:ring-2 accent-teal-600"
      />
      <label className="text-sm text-[#F8F3E6]">
        {lstr(l).show_translation_by_sentence_checkbox}
      </label>
    </div>
  );
}
