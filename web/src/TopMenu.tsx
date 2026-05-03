import { Settings, ShowTranslationMode } from "./settings";
import {
  ShowTranslationCheckbox,
  ShowTranslationBySentenceCheckbox,
} from "./ShowTranslationCheckbox";
import { useNavigate } from "react-router-dom";
import { RiSettings3Fill } from "react-icons/ri";
import { auth, useUser } from "./firebase";
import { lstr } from "./localization";
import { User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";

export function TopMenu({
  showTranslationControls,
  settings,
  setSettings,
  setShowSettingsMenu,
}: {
  showTranslationControls: boolean;
  settings: Settings;
  setSettings: (value: Settings) => void;
  setShowSettingsMenu: () => void;
}) {
  const navigate = useNavigate();
  const user = useUser();

  return (
    <div className="top-0 left-0 h-[48px] w-full flex justify-center px-4 bg-cream border-b border-border z-50">
      <div className="w-full flex justify-between items-center">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 h-[48px] text-main-text font-semibold transition-opacity hover:opacity-70"
        >
          <span className="text-lg tracking-tight">Polypup</span>
        </button>
        {showTranslationControls && (
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
        {user ? (
          <div className="flex flex-grow justify-end items-center">
            <UserAvatar user={user} locale={settings.lLocale} />
          </div>
        ) : (
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

function UserAvatar({ user, locale }: { user: User; locale: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const photoURL = user.photoURL;
  const initial = (
    user.displayName?.[0] ||
    user.email?.[0] ||
    "?"
  ).toUpperCase();

  const logout = async () => {
    await auth.signOut();
    setOpen(false);
    navigate("/");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
      >
        {photoURL ? (
          <img
            src={photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold">
            {initial}
          </div>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg min-w-[160px] z-50">
          <div className="px-4 py-2.5 border-b border-border">
            <div className="text-sm text-main-text truncate max-w-[200px]">
              {user.email || user.displayName || user.uid}
            </div>
          </div>
          <div className="py-1">
            <button
              type="button"
              onClick={logout}
              className="w-full text-left px-4 py-2 text-sm text-secondary-text hover:text-main-text hover:bg-cream-dark transition-colors"
            >
              {lstr(locale).logout_button}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
