import { Modal } from "./Modal";
import { Settings, Theme } from "./settings";
import { LanguageDropdown } from "./LanguageDropdown";
import { lstr } from "./localization";
import { HiMoon, HiSun } from "react-icons/hi2";

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
