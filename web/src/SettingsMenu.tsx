import { Modal } from "./Modal";
import { Settings, Theme } from "./settings";
import { LanguageDropdown } from "./LanguageDropdown";
import { lstr, LocalizationStrings } from "./localization";
import { HiMoon, HiSun } from "react-icons/hi2";
import {
  GENDER_CLASS,
  GENDER_EXAMPLES,
  Gender,
  supportsGenderColoring,
} from "./gender";

// GenderColoringSection renders the "Color nouns by gender" checkbox plus a
// short explanation and a three-chip legend that previews the exact colors
// the story renderer will use. It is mounted only for learned languages
// that actually carry gender markers (German, Russian) - showing it for
// e.g. English would be confusing because nothing would ever be coloured.
function GenderColoringSection({
  settings,
  setSettings,
  strings,
}: {
  settings: Settings;
  setSettings: (value: Settings) => void;
  strings: LocalizationStrings;
}) {
  const examples = GENDER_EXAMPLES[settings.rLocale];
  if (!examples) {
    // Defensive: supportsGenderColoring already filtered, but if we ever
    // add a new locale to the supported set without examples, fail closed
    // instead of crashing.
    return null;
  }

  const labelForGender: Record<Gender, string> = {
    m: strings.color_noun_genders_masculine,
    f: strings.color_noun_genders_feminine,
    n: strings.color_noun_genders_neuter,
  };
  const genders: Gender[] = ["m", "f", "n"];

  const toggle = () =>
    setSettings({ ...settings, colorNounGenders: !settings.colorNounGenders });

  return (
    <div className="flex flex-col gap-2 pt-1">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.colorNounGenders}
          onChange={toggle}
        />
        <span className="text-sm text-main-text select-none">
          {strings.color_noun_genders_checkbox}
        </span>
      </label>
      <p className="text-xs text-secondary-text">
        {strings.color_noun_genders_explanation}
      </p>
      <div className="flex gap-2 flex-wrap">
        {genders.map((g) => (
          <div
            key={g}
            className="flex items-baseline gap-1.5 border border-border rounded-lg px-2.5 py-1 bg-surface"
          >
            <span className={`text-sm font-semibold ${GENDER_CLASS[g]}`}>
              {examples[g]}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-text">
              {labelForGender[g]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsMenu({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: (value: Settings) => void;
}) {
  const strings = lstr(settings.lLocale);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="min-w-[100px] text-sm text-secondary-text">
            {strings.settings_i_speak}
          </div>
          <LanguageDropdown
            language={settings.lLocale}
            excludeLanguage={undefined}
            setLanguage={(value: string) =>
              setSettings({ ...settings, lLocale: value })
            }
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-[100px] text-sm text-secondary-text">
            {strings.settings_i_learn}
          </div>
          <LanguageDropdown
            language={settings.rLocale}
            excludeLanguage={settings.lLocale}
            setLanguage={(value: string) =>
              setSettings({ ...settings, rLocale: value })
            }
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-[100px] text-sm text-secondary-text">
            {strings.settings_theme}
          </div>
          <button
            type="button"
            onClick={() =>
              setSettings({
                ...settings,
                theme:
                  settings.theme === Theme.Dark ? Theme.Light : Theme.Dark,
              })
            }
            className="flex overflow-hidden border border-border rounded-lg bg-surface text-sm transition-colors hover:bg-cream-dark"
          >
            <span
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                settings.theme === Theme.Light
                  ? "bg-primary-light text-primary font-medium"
                  : "text-secondary-text"
              }`}
            >
              <HiSun className="text-base" />
              {strings.settings_theme_light}
            </span>
            <span className="w-px bg-border" aria-hidden />
            <span
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                settings.theme === Theme.Dark
                  ? "bg-primary-light text-primary font-medium"
                  : "text-secondary-text"
              }`}
            >
              <HiMoon className="text-base" />
              {strings.settings_theme_dark}
            </span>
          </button>
        </div>
        {supportsGenderColoring(settings.rLocale) && (
          <GenderColoringSection
            settings={settings}
            setSettings={setSettings}
            strings={strings}
          />
        )}
      </div>
    </div>
  );
}

export function SettingsModal({
  settings,
  setSettings,
  closeModal,
}: {
  settings: Settings;
  setSettings: (value: Settings) => void;
  closeModal: () => void;
}) {
  return (
    <Modal
      showCloseButton={true}
      locale={settings.lLocale}
      closeModal={closeModal}
    >
      <div className="p-2">
        <h1 className="text-xl font-semibold text-main-text">
          {lstr(settings.lLocale).settings_title}
        </h1>
        <div className="mt-5">
          <SettingsMenu
            settings={settings}
            setSettings={setSettings}
          />
        </div>
      </div>
    </Modal>
  );
}
