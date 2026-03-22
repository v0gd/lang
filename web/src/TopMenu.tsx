import { Settings, ShowTranslationMode } from "./settings";
import {
  ShowTranslationCheckbox,
  ShowTranslationBySentenceCheckbox,
} from "./ShowTranslationCheckbox";
import { useNavigate } from "react-router-dom";
import { RiSettings3Fill } from "react-icons/ri";
import { isLoggedIn } from "./firebase";
import { lstr } from "./localization";

export function TopMenu({
  displayingStory,
  settings,
  setSettings,
  setShowSettingsMenu,
}: {
  displayingStory: boolean;
  settings: Settings;
  setSettings: (value: Settings) => void;
  setShowSettingsMenu: () => void;
}) {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  return (
    <div className="top-0 left-0 h-[48px] w-full flex justify-center px-4 bg-cream border-b border-border z-50">
      <div className="w-full max-w-[650px] flex justify-between items-center">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 h-[48px] text-main-text font-semibold transition-opacity hover:opacity-70"
        >
          <span className="text-lg tracking-tight">Polypup</span>
        </button>
        {displayingStory && (
          <div className="flex flex-grow justify-center items-center">
            <div className="flex flex-col gap-0.5">
              <ShowTranslationCheckbox
                isChecked={settings.showTranslation}
                l={settings.lLocale}
                setIsChecked={(value: boolean) =>
                  setSettings({ ...settings, showTranslation: value })
                }
              />
              <ShowTranslationBySentenceCheckbox
                isChecked={
                  settings.showTranslationMode ===
                  ShowTranslationMode.BySentence
                }
                isEnabled={settings.showTranslation}
                l={settings.lLocale}
                setIsChecked={(value: boolean) =>
                  setSettings({
                    ...settings,
                    showTranslationMode: value
                      ? ShowTranslationMode.BySentence
                      : ShowTranslationMode.ByParagraph,
                  })
                }
              />
            </div>
          </div>
        )}
        {!loggedIn && (
          <div className="flex flex-grow justify-end items-center gap-2">
            <button
              type="button"
              className="text-primary border border-primary px-4 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-primary-light"
              onClick={() => navigate("/login")}
            >
              {lstr(settings.lLocale).login_button}
            </button>
            <button
              type="button"
              className="text-white bg-primary border border-primary px-4 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-primary-hover"
              onClick={() => navigate("/signup")}
            >
              {lstr(settings.lLocale).signup_button}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={setShowSettingsMenu}
          className="flex items-center justify-center h-[48px] w-[44px] text-[22px] text-secondary-text transition-colors hover:text-main-text"
        >
          <RiSettings3Fill />
        </button>
      </div>
    </div>
  );
}
