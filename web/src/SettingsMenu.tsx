import { Modal } from "./Modal";
import { Settings, Theme } from "./settings";
import { LanguageDropdown } from "./LanguageDropdown";
import { lstr } from "./localization";
import { auth, useLoggedIn } from "./firebase";
import { useNavigate } from "react-router-dom";
import { HiMoon, HiSun } from "react-icons/hi2";

function SettingsMenu({
  settings,
  setSettings,
  onLogout,
}: {
  settings: Settings;
  setSettings: (value: Settings) => void;
  onLogout: () => void;
}) {
  const loggedIn = useLoggedIn();
  const navigate = useNavigate();

  const logout = async () => {
    await auth.signOut();
    onLogout();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="min-w-[100px] text-sm text-secondary-text">
            {lstr(settings.lLocale).settings_i_speak}
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
            {lstr(settings.lLocale).settings_i_learn}
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
            Theme
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
            className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-surface text-main-text text-sm transition-colors hover:bg-cream-dark"
          >
            {settings.theme === Theme.Dark ? (
              <HiMoon className="text-base" />
            ) : (
              <HiSun className="text-base" />
            )}
            {settings.theme === Theme.Dark ? "Dark" : "Light"}
          </button>
        </div>
      </div>
      {loggedIn && (
        <div className="pt-4 border-t border-border">
          <button
            type="button"
            onClick={logout}
            className="text-sm font-medium text-secondary-text hover:text-main-text transition-colors"
          >
            {lstr(settings.lLocale).logout_button}
          </button>
        </div>
      )}
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
  const navigate = useNavigate();
  const onLogout = () => {
    closeModal();
    navigate("/");
  };

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
            onLogout={onLogout}
          />
        </div>
      </div>
    </Modal>
  );
}
