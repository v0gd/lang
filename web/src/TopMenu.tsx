import { Settings, ShowTranslationMode } from "./settings";
import {
  ShowTranslationCheckbox,
  ShowTranslationBySentenceCheckbox,
} from "./ShowTranslationCheckbox";
import { HiMiniHome } from "react-icons/hi2";
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
    <div className="top-0 left-0 h-[44px] w-full flex justify-center px-4 bg-[#333333] z-50">
      <div className={`w-full max-w-[650px] flex justify-between`}>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center justify-center h-[44px] w-[44px] text-[32px] text-[#F8F3E6] font-semibold"
        >
          <HiMiniHome className="inline" />
        </button>
        {displayingStory && (
          <div className="flex flex-grow justify-center items-center">
            <div className="flex flex-col items-left space-4">
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
          <div className="flex flex-grow justify-end items-center space-x-2">
            <button
              type="button"
              className="text-main-white border border-main-white px-4 py-1 rounded-lg"
              onClick={() => navigate("/login")}
            >
              {lstr(settings.lLocale).login_button}
            </button>
            <button
              type="button"
              className="text-black bg-main-white border border-main-white px-4 py-1 rounded-lg"
              onClick={() => navigate("/signup")}
            >
              {lstr(settings.lLocale).signup_button}
            </button>
            <div className="w-6" />
          </div>
        )}
        <button
          type="button"
          onClick={setShowSettingsMenu}
          className="flex items-center justify-center h-[44px] w-[44px] text-[32px] text-[#F8F3E6] font-semibold"
        >
          <RiSettings3Fill className="inline" />
        </button>
      </div>
    </div>
  );
}
