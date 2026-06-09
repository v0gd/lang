import { useState } from "react";
import { BrowserRouter, Routes, Route, useParams, useNavigate } from "react-router-dom";
import { StoryMenu, StoryMenuUnauthorized } from "./StoryMenu";
import { SettingsModal } from "./SettingsMenu";
import StoryView from "./StoryView";
import { Settings, Theme, ShowTranslationMode } from "./settings";
import { TopMenu } from "./TopMenu";
import { GenerateStoryView } from "./GenerateView";
import { UploadView } from "./UploadView";
import { MyDictionaryView } from "./MyDictionaryView";
import { useLoggedIn } from "./firebase";
import { SignInPage, SignUpPage } from "./LoginPage";
import { useStoryQuery } from "./queries";
import { lstr } from "./localization";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === Theme.Dark);
}

const SUPPORTED_LOCALES = ["en", "de", "ru"];

const DEFAULT_SETTINGS: Settings = {
  lLocale: "en",
  rLocale: "de",
  showTranslation: true,
  showTranslationMode: ShowTranslationMode.ByParagraph,
  theme: Theme.Light,
  colorNounGenders: true,
};

// loadSettingsOrDefault tolerates corrupt or partial localStorage content:
// anything unparseable or invalid falls back per-field to the defaults, so a
// bad stored blob can never crash the app on startup.
function loadSettingsOrDefault(): Settings {
  let parsed: Partial<Settings> = {};
  const settingsString = localStorage.getItem("settings");
  if (settingsString) {
    try {
      const raw: unknown = JSON.parse(settingsString);
      if (raw && typeof raw === "object") {
        parsed = raw as Partial<Settings>;
      }
    } catch (err) {
      console.error("Failed to parse stored settings, using defaults", err);
    }
  }

  const settings: Settings = {
    lLocale: SUPPORTED_LOCALES.includes(parsed.lLocale as string)
      ? (parsed.lLocale as string)
      : DEFAULT_SETTINGS.lLocale,
    rLocale: SUPPORTED_LOCALES.includes(parsed.rLocale as string)
      ? (parsed.rLocale as string)
      : DEFAULT_SETTINGS.rLocale,
    showTranslation:
      typeof parsed.showTranslation === "boolean"
        ? parsed.showTranslation
        : DEFAULT_SETTINGS.showTranslation,
    showTranslationMode: Object.values(ShowTranslationMode).includes(
      parsed.showTranslationMode as ShowTranslationMode,
    )
      ? (parsed.showTranslationMode as ShowTranslationMode)
      : DEFAULT_SETTINGS.showTranslationMode,
    theme: Object.values(Theme).includes(parsed.theme as Theme)
      ? (parsed.theme as Theme)
      : DEFAULT_SETTINGS.theme,
    // colorNounGenders was added later than the rest of Settings; default
    // it on for users whose localStorage predates the field.
    colorNounGenders:
      typeof parsed.colorNounGenders === "boolean"
        ? parsed.colorNounGenders
        : DEFAULT_SETTINGS.colorNounGenders,
  };
  if (settings.lLocale === settings.rLocale) {
    settings.rLocale = settings.lLocale === "en" ? "de" : "en";
  }
  applyTheme(settings.theme);
  return settings;
}

// AppShell is the single layout wrapper for every route: settings modal,
// top menu, and the centered content column. Settings state itself lives in
// App so that a change made on one page is immediately visible on all others.
function AppShell({
  settings,
  setSettings,
  showTranslationControls = false,
  contentClassName = "w-[100%] max-w-[650px] pt-4 px-4",
  children,
}: {
  settings: Settings;
  setSettings: (value: Settings) => void;
  showTranslationControls?: boolean;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const [showSettings, setShowSettings] = useState<boolean>(false);

  return (
    <div className="flex flex-col h-screen font-literata">
      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={setSettings}
          closeModal={() => setShowSettings(false)}
        />
      )}
      <div className="flex flex-col items-center w-full h-full bg-cream overflow-auto">
        <TopMenu
          showTranslationControls={showTranslationControls}
          settings={settings}
          setSettings={setSettings}
          setShowSettingsMenu={() => setShowSettings(true)}
        />
        <div className={contentClassName}>{children}</div>
      </div>
    </div>
  );
}

interface RouteProps {
  settings: Settings;
  setSettings: (value: Settings) => void;
}

function StoryMenuComponent({ settings, setSettings }: RouteProps) {
  const navigate = useNavigate();
  const loggedIn = useLoggedIn();

  const selectStory = (storyId: string) => {
    navigate(`/${storyId}`);
  };

  return (
    <AppShell settings={settings} setSettings={setSettings}>
      {loggedIn ? (
        <StoryMenu
          l={settings.lLocale}
          r={settings.rLocale}
          onStorySelected={selectStory}
        />
      ) : (
        <StoryMenuUnauthorized
          l={settings.lLocale}
          r={settings.rLocale}
          onStorySelected={selectStory}
        />
      )}
    </AppShell>
  );
}

function StoryComponent({ settings, setSettings }: RouteProps) {
  const { storyId } = useParams();

  // Same query key as inside StoryView; TanStack Query dedupes the request so
  // we get the response here for free and can hide the translation toggles
  // when the story has no L localization.
  const storyQuery = useStoryQuery(storyId!, settings.lLocale, settings.rLocale);
  const showTranslationControls =
    storyQuery.data?.localizations.has(settings.lLocale) ?? false;

  return (
    <AppShell
      settings={settings}
      setSettings={setSettings}
      showTranslationControls={showTranslationControls}
      contentClassName="max-w-[650px] pt-4 px-4"
    >
      <StoryView
        storyId={storyId!}
        l={settings.lLocale}
        r={settings.rLocale}
        shouldShowTranslation={settings.showTranslation}
        showTranslationBySentence={
          settings.showTranslationMode === ShowTranslationMode.BySentence
        }
        colorNounGenders={settings.colorNounGenders}
      />
    </AppShell>
  );
}

function StoryGenerateComponent({ settings, setSettings }: RouteProps) {
  return (
    <AppShell
      settings={settings}
      setSettings={setSettings}
      contentClassName="w-full max-w-[900px] pt-4 px-4 pb-10"
    >
      <GenerateStoryView l={settings.lLocale} r={settings.rLocale} />
    </AppShell>
  );
}

function UploadComponent({ settings, setSettings }: RouteProps) {
  return (
    <AppShell
      settings={settings}
      setSettings={setSettings}
      contentClassName="w-full max-w-[900px] pt-4 px-4 pb-10"
    >
      <UploadView l={settings.lLocale} r={settings.rLocale} />
    </AppShell>
  );
}

function MyDictionaryComponent({ settings, setSettings }: RouteProps) {
  const navigate = useNavigate();
  const loggedIn = useLoggedIn();

  return (
    <AppShell settings={settings} setSettings={setSettings}>
      {loggedIn ? (
        <MyDictionaryView l={settings.lLocale} r={settings.rLocale} />
      ) : (
        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-secondary-text text-center">
            {lstr(settings.lLocale).my_dictionary_login_prompt}
          </p>
          <button
            type="button"
            className="text-white bg-primary border border-primary px-4 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-primary-hover"
            onClick={() => navigate("/login")}
          >
            {lstr(settings.lLocale).login_button}
          </button>
        </div>
      )}
    </AppShell>
  );
}

function LoginComponent({ settings, setSettings }: RouteProps) {
  return (
    <AppShell settings={settings} setSettings={setSettings}>
      <SignInPage l={settings.lLocale} />
    </AppShell>
  );
}

function SignUpComponent({ settings, setSettings }: RouteProps) {
  return (
    <AppShell settings={settings} setSettings={setSettings}>
      <SignUpPage l={settings.lLocale} />
    </AppShell>
  );
}

function App() {
  const [settings, setSettingsState] = useState<Settings>(loadSettingsOrDefault);

  const setSettings = (value: Settings) => {
    if (value.lLocale === value.rLocale) {
      value = { ...value, rLocale: value.lLocale === "en" ? "de" : "en" };
    }
    localStorage.setItem("settings", JSON.stringify(value));
    applyTheme(value.theme);
    setSettingsState(value);
  };

  const routeProps = { settings, setSettings };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StoryMenuComponent {...routeProps} />} />
        <Route path="/login" element={<LoginComponent {...routeProps} />} />
        <Route path="/signup" element={<SignUpComponent {...routeProps} />} />
        <Route path="/generate" element={<StoryGenerateComponent {...routeProps} />} />
        <Route path="/upload" element={<UploadComponent {...routeProps} />} />
        <Route path="/dictionary" element={<MyDictionaryComponent {...routeProps} />} />
        <Route path="/generated/:storyId" element={<StoryComponent {...routeProps} />} />
        <Route path="/:storyId" element={<StoryComponent {...routeProps} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
