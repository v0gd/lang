import { Modal } from "./Modal";
import { Settings } from "./settings";
import { LanguageDropdown } from "./LanguageDropdown";
import { lstr } from "./localization";
import { auth, useLoggedIn } from "./firebase";
import { useNavigate } from "react-router-dom";

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
    <>
      <div className="flex flex-col gap-2 items-left">
        <div className="flex gap-2">
          <div className="min-w-[100px]">
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
        <div className="flex gap-2">
          <div className="min-w-[100px]">
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
        <div>
          {loggedIn && (
            <button
              type="button"
              onClick={logout}
              className="text-left text-blue-600 mt-6"
            >
              {lstr(settings.lLocale).logout_button}
            </button>
          )}
        </div>
      </div>
    </>
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
      <div className="p-4">
        <h1 className="text-2xl font-semibold">
          {lstr(settings.lLocale).settings_title}
        </h1>
        <div className="mt-4">
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
