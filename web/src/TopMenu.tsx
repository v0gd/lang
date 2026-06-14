import { Settings, ShowTranslationMode } from "./settings";
import { useNavigate } from "react-router-dom";
import { RiSettings3Fill } from "react-icons/ri";
import { HiCheck } from "react-icons/hi2";
import { supportsGenderColoring } from "./gender";
import { auth, useUser } from "./firebase";
import { lstr } from "./localization";
import { User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";

export function TopMenu({
  showReaderOptions,
  translationAvailable,
  settings,
  setSettings,
  setShowSettingsMenu,
}: {
  // True on story pages: enables the "Aa" reader-options menu.
  showReaderOptions: boolean;
  // True when the story has a translation in the user's spoken language, so
  // the translation section of the reader options applies.
  translationAvailable: boolean;
  settings: Settings;
  setSettings: (value: Settings) => void;
  setShowSettingsMenu: () => void;
}) {
  const navigate = useNavigate();
  const user = useUser();

  // No point in an empty menu: on a story without translation in a language
  // without gender coloring there is nothing to configure (yet).
  const readerOptionsVisible =
    showReaderOptions &&
    (translationAvailable || supportsGenderColoring(settings.rLocale));

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
        {readerOptionsVisible && (
          <div className="flex flex-grow justify-center items-center">
            <ReaderOptionsMenu
              settings={settings}
              setSettings={setSettings}
              translationAvailable={translationAvailable}
            />
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
          aria-label={lstr(settings.lLocale).settings_title}
          className="flex items-center justify-center h-[48px] w-[44px] text-[22px] text-secondary-text transition-colors hover:text-main-text"
        >
          <RiSettings3Fill />
        </button>
      </div>
    </div>
  );
}

// TranslationMode flattens the (showTranslation, showTranslationMode) pair
// into the single three-way choice the user actually makes. "hidden" keeps
// the stored mode untouched so re-enabling restores the previous preference.
type TranslationMode = "hidden" | "paragraph" | "sentence";

// ReaderOptionsMenu is the "Aa" button in the header on story pages: a
// popover with everything that affects how the story text is rendered. It
// is sectioned so new reading options can be added without redesigning the
// header: today a translation section (when the story has one) and the
// noun-gender coloring toggle (when the learned language has genders).
// The "Aa" is rendered as serif text rather than an icon - it is the
// established reader-settings affordance and matches the app's typography.
function ReaderOptionsMenu({
  settings,
  setSettings,
  translationAvailable,
}: {
  settings: Settings;
  setSettings: (value: Settings) => void;
  translationAvailable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const strings = lstr(settings.lLocale);

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

  const currentMode: TranslationMode = !settings.showTranslation
    ? "hidden"
    : settings.showTranslationMode === ShowTranslationMode.BySentence
      ? "sentence"
      : "paragraph";

  const selectMode = (mode: TranslationMode) => {
    setSettings({
      ...settings,
      showTranslation: mode !== "hidden",
      showTranslationMode:
        mode === "sentence"
          ? ShowTranslationMode.BySentence
          : mode === "paragraph"
            ? ShowTranslationMode.ByParagraph
            : settings.showTranslationMode,
    });
    setOpen(false);
  };

  const modeOptions: { mode: TranslationMode; label: string }[] = [
    { mode: "hidden", label: strings.translation_mode_hidden },
    { mode: "paragraph", label: strings.translation_mode_by_paragraph },
    { mode: "sentence", label: strings.translation_mode_by_sentence },
  ];

  const sectionLabelClass =
    "px-4 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-text";
  const rowClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-3 text-left px-4 py-2 text-sm transition-colors hover:bg-cream-dark ${
      active
        ? "text-primary font-medium"
        : "text-secondary-text hover:text-main-text"
    }`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={strings.reader_menu_label}
        aria-expanded={open}
        className="flex items-center justify-center h-[48px] w-[44px] text-secondary-text transition-colors hover:text-main-text"
      >
        <span className="font-literata font-semibold text-[19px] leading-none select-none">
          Aa
        </span>
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg min-w-[210px] z-50 pb-1">
          {translationAvailable && (
            <>
              <div className={sectionLabelClass}>
                {strings.translation_menu_title}
              </div>
              {modeOptions.map((option) => {
                const selected = option.mode === currentMode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => selectMode(option.mode)}
                    className={rowClass(selected)}
                  >
                    {option.label}
                    {selected && <HiCheck className="text-base" />}
                  </button>
                );
              })}
            </>
          )}
          {supportsGenderColoring(settings.rLocale) && (
            <>
              {translationAvailable && (
                <div className="mt-1 border-t border-border" />
              )}
              <div className={sectionLabelClass}>
                {strings.reader_menu_words_section}
              </div>
              {/* A toggle, not a mode choice: clicking flips it and keeps
                  the menu open so the effect is visible in the text. */}
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    colorNounGenders: !settings.colorNounGenders,
                  })
                }
                className={rowClass(settings.colorNounGenders)}
              >
                {strings.color_noun_genders_checkbox}
                {settings.colorNounGenders && <HiCheck className="text-base" />}
              </button>
            </>
          )}
        </div>
      )}
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
        aria-label={lstr(locale).account_menu_label}
        aria-expanded={open}
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
              onClick={() => {
                setOpen(false);
                navigate("/dictionary");
              }}
              className="w-full text-left px-4 py-2 text-sm text-secondary-text hover:text-main-text hover:bg-cream-dark transition-colors"
            >
              {lstr(locale).my_dictionary_nav}
            </button>
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
