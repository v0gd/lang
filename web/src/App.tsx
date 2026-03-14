import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import { StoryMenu, StoryMenuUnauthorized } from "./StoryMenu";
import { SettingsModal } from "./SettingsMenu";
import StoryView from "./StoryView";
import { Settings, Theme, ShowTranslationMode } from "./settings";
import { TopMenu } from "./TopMenu";
import { GenerateStoryView } from "./GenerateView";
import { useLoggedIn } from "./firebase";
import { SignInPage, SignUpPage } from "./LoginPage";

function loadSettingsOrDefault(): Settings {
  const settingsString = localStorage.getItem("settings");
  if (settingsString) {
    // TODO: Validate settings
    const parsed = JSON.parse(settingsString);
    return parsed;
  }
  return {
    lLocale: "en",
    rLocale: "de",
    showTranslation: true,
    showTranslationMode: ShowTranslationMode.ByParagraph,
    theme: Theme.Light,
  };
}

function setAndStoreSettings(
  value: Settings,
  setSettings: (value: Settings) => void,
) {
  localStorage.setItem("settings", JSON.stringify(value));
  setSettings(value);
}

function setSettingsSafe(
  value: Settings,
  setSettings: (value: Settings) => void,
) {
  if (value.lLocale === value.rLocale) {
    const rLocale = value.lLocale === "en" ? "de" : "en";
    setAndStoreSettings({ ...value, rLocale }, setSettings);
  } else {
    setAndStoreSettings(value, setSettings);
  }
}

function StoryMenuComponent() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [settings, setSettings] = useState<Settings>(loadSettingsOrDefault());
  const loggedIn = useLoggedIn();

  const selectStory = (storyId: string) => {
    navigate(`/${storyId}`);
  };

  return (
    <div className="flex flex-col h-screen font-literata">
      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={(value: Settings) => setSettingsSafe(value, setSettings)}
          closeModal={() => setShowSettings(false)}
        />
      )}
      <div className="flex flex-col items-center w-full h-full bg-main-white overflow-auto">
        <TopMenu
          displayingStory={false}
          settings={settings}
          setSettings={(value: Settings) => setSettingsSafe(value, setSettings)}
          setShowSettingsMenu={() => setShowSettings(true)}
        />
        <div className="w-[100%] max-w-[650px] pt-4 px-4">
          {loggedIn && (
            <StoryMenu
              l={settings.lLocale}
              r={settings.rLocale}
              onStorySelected={selectStory}
            />
          )}
          {!loggedIn && (
            <StoryMenuUnauthorized
              l={settings.lLocale}
              r={settings.rLocale}
              onStorySelected={selectStory}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StoryComponent() {
  const { storyId } = useParams();
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [settings, setSettings] = useState<Settings>(loadSettingsOrDefault());

  return (
    <div className="flex flex-col h-screen font-literata">
      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={(value: Settings) => setSettingsSafe(value, setSettings)}
          closeModal={() => setShowSettings(false)}
        />
      )}
      <div className="flex flex-col items-center w-full h-full bg-main-white overflow-auto">
        <TopMenu
          displayingStory={true}
          settings={settings}
          setSettings={(value: Settings) => setSettingsSafe(value, setSettings)}
          setShowSettingsMenu={() => setShowSettings(true)}
        />
        <div className="max-w-[650px] pt-4 px-4">
          <StoryView
            storyId={storyId!}
            l={settings.lLocale}
            r={settings.rLocale}
            shouldShowTranslation={settings.showTranslation}
            showTranslationBySentence={
              settings.showTranslationMode === ShowTranslationMode.BySentence
            }
          />
        </div>
      </div>
    </div>
  );
}

function StoryGenerateComponent() {
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [settings, setSettings] = useState<Settings>(loadSettingsOrDefault());

  return (
    <div className="flex flex-col h-screen font-literata">
      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={(value: Settings) => setSettingsSafe(value, setSettings)}
          closeModal={() => setShowSettings(false)}
        />
      )}
      <div className="flex flex-col items-center w-full h-full bg-main-white overflow-auto">
        <TopMenu
          displayingStory={false}
          settings={settings}
          setSettings={(value: Settings) => setSettingsSafe(value, setSettings)}
          setShowSettingsMenu={() => setShowSettings(true)}
        />
        <div className="max-w-[650px] pt-4 px-4">
          <GenerateStoryView l={settings.lLocale} r={settings.rLocale} />
        </div>
      </div>
    </div>
  );
}

function LoginComponent() {
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [settings, setSettings] = useState<Settings>(loadSettingsOrDefault());

  return (
    <div className="flex flex-col h-screen font-literata">
      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={(value: Settings) => setSettingsSafe(value, setSettings)}
          closeModal={() => setShowSettings(false)}
        />
      )}
      <div className="flex flex-col items-center w-full h-full bg-main-white overflow-auto">
        <TopMenu
          displayingStory={false}
          settings={settings}
          setSettings={(value: Settings) => setSettingsSafe(value, setSettings)}
          setShowSettingsMenu={() => setShowSettings(true)}
        />
        <div className="w-[100%] max-w-[650px] pt-4 px-4">
          <SignInPage />
        </div>
      </div>
    </div>
  );
}

function SignUpComponent() {
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [settings, setSettings] = useState<Settings>(loadSettingsOrDefault());

  return (
    <div className="flex flex-col h-screen font-literata">
      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={(value: Settings) => setSettingsSafe(value, setSettings)}
          closeModal={() => setShowSettings(false)}
        />
      )}
      <div className="flex flex-col items-center w-full h-full bg-main-white overflow-auto">
        <TopMenu
          displayingStory={false}
          settings={settings}
          setSettings={(value: Settings) => setSettingsSafe(value, setSettings)}
          setShowSettingsMenu={() => setShowSettings(true)}
        />
        <div className="w-[100%] max-w-[650px] pt-4 px-4">
          <SignUpPage />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" Component={StoryMenuComponent}></Route>
        <Route path="/login" Component={LoginComponent}></Route>
        <Route path="/signup" Component={SignUpComponent}></Route>
        <Route path="/generate" Component={StoryGenerateComponent}></Route>
        <Route path="/generated/:storyId" Component={StoryComponent}></Route>
        <Route path="/:storyId" Component={StoryComponent}></Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
