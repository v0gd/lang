import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBookOpen,
  FaBookmark,
  FaCamera,
  FaHandPointer,
  FaPenToSquare,
  FaWandMagicSparkles,
} from "react-icons/fa6";
import { useStoryListQuery } from "./queries";
import { lstr } from "./localization";
import { levelBadgeClasses } from "./levelColors";
import { StoryDescriptor, truncateStoryListTitle } from "./story";
import { Settings } from "./settings";
import { LanguageDropdown } from "./LanguageDropdown";

// HomePage is the logged-out landing page mounted at "/" (logged-in users
// still get StoryMenu there). It only relies on what already works
// anonymously: the curated story list and client-side navigation.
//
// The page is ordered for conversion: value proposition and language pair
// first, a three-step "how it works" strip, then the freely readable curated
// stories (the actual product demo), and only after that the signup-gated
// creation features and the final signup banner. Every gated action routes to
// /signup rather than /login because a first-time visitor almost never has an
// account yet.
export function HomePage({
  settings,
  setSettings,
  onStorySelected,
}: {
  settings: Settings;
  setSettings: (value: Settings) => void;
  onStorySelected: (storyId: string) => void;
}) {
  const navigate = useNavigate();
  const l = settings.lLocale;
  const r = settings.rLocale;
  const strings = lstr(l);
  const query = useStoryListQuery(l, r);

  const goToSignUp = () => navigate("/signup");

  return (
    <div className="w-full pb-12">
      <header className="mt-2">
        <h1 className="font-literata text-3xl md:text-4xl font-bold tracking-tight text-main-text leading-tight">
          {strings.home_hero_title_pre}{" "}
          <span className="text-primary">{strings.home_hero_title_highlight}</span>
        </h1>
        <p className="mt-3 text-secondary-text">{strings.home_hero_subtitle}</p>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2">
          <span className="text-sm text-secondary-text">
            {strings.settings_i_speak}
          </span>
          <LanguageDropdown
            language={l}
            excludeLanguage={undefined}
            setLanguage={(value: string) =>
              setSettings({ ...settings, lLocale: value })
            }
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-secondary-text">
            {strings.settings_i_learn}
          </span>
          <LanguageDropdown
            language={r}
            excludeLanguage={l}
            setLanguage={(value: string) =>
              setSettings({ ...settings, rLocale: value })
            }
          />
        </label>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HowItWorksStep
          icon={<FaBookOpen />}
          title={strings.home_how_read_title}
          description={strings.home_how_read_description}
        />
        <HowItWorksStep
          icon={<FaHandPointer />}
          title={strings.home_how_tap_title}
          description={strings.home_how_tap_description}
        />
        <HowItWorksStep
          icon={<FaBookmark />}
          title={strings.home_how_save_title}
          description={strings.home_how_save_description}
        />
      </div>

      <header className="text-left text-2xl font-semibold text-main-text mt-10 mb-3">
        {strings.home_stories_heading}
      </header>

      {query.isPending && (
        <div className="text-secondary-text">{strings.loading_story_list}</div>
      )}
      {query.isError && (
        <div className="text-secondary-text">
          {strings.loading_story_list_error}
        </div>
      )}
      {query.isSuccess &&
        query.data.map(
          (story) =>
            story.locales.length === story.titles.length &&
            story.locales.length >= 1 && (
              <StoryCard
                key={story.id}
                s={story}
                l={l}
                r={r}
                onStorySelected={onStorySelected}
              />
            ),
        )}

      <header className="text-left text-2xl font-semibold text-main-text mt-10 mb-1">
        {strings.home_create_heading}
      </header>
      <p className="text-secondary-text text-sm mb-3">
        {strings.home_create_subtitle}
      </p>

      <CreateOptionCard
        icon={<FaWandMagicSparkles />}
        title={strings.home_create_generate_title}
        description={strings.home_create_generate_description}
        onPressed={goToSignUp}
      />
      <CreateOptionCard
        icon={<FaCamera />}
        title={strings.home_create_scan_title}
        description={strings.home_create_scan_description}
        onPressed={goToSignUp}
      />
      <CreateOptionCard
        icon={<FaPenToSquare />}
        title={strings.home_create_upload_title}
        description={strings.home_create_upload_description}
        onPressed={goToSignUp}
      />

      <div className="mt-10 bg-primary-light border border-border rounded-2xl px-6 py-7 flex flex-col items-center text-center gap-2">
        <div className="font-literata text-xl font-bold text-main-text">
          {strings.home_cta_title}
        </div>
        <p className="text-secondary-text text-sm">{strings.home_cta_subtitle}</p>
        <button
          type="button"
          onClick={goToSignUp}
          className="mt-2 bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          {strings.home_cta_button}
        </button>
      </div>
    </div>
  );
}

function HowItWorksStep({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-1.5 p-4 bg-surface border border-border rounded-xl">
      <span aria-hidden className="text-primary text-xl mb-1">
        {icon}
      </span>
      <div className="font-semibold text-main-text text-sm">{title}</div>
      <div className="text-secondary-text text-sm">{description}</div>
    </div>
  );
}

function titleForLocale(
  s: StoryDescriptor,
  locale: string,
): string | undefined {
  const idx = s.locales.indexOf(locale);
  return idx === -1 ? undefined : s.titles[idx];
}

// StoryCard is a read-only variant of StoryMenu's StoryButton: level badge
// plus learned-language title with a mother-tongue subtitle. No favorite or
// delete controls - those only make sense for logged-in users.
function StoryCard({
  s,
  l,
  r,
  onStorySelected,
}: {
  s: StoryDescriptor;
  l: string;
  r: string;
  onStorySelected: (storyId: string) => void;
}) {
  const primaryTitle = truncateStoryListTitle(
    titleForLocale(s, r) ?? s.titles[0],
  );
  const secondaryTitleForLocale = titleForLocale(s, l);
  const secondaryTitle =
    secondaryTitleForLocale === undefined
      ? undefined
      : truncateStoryListTitle(secondaryTitleForLocale);
  return (
    <button
      type="button"
      onClick={() => onStorySelected(s.id)}
      className="my-1.5 w-full hover:bg-cream-dark p-3 bg-surface border border-border rounded-xl transition-colors"
    >
      <div className="flex items-center w-full gap-2">
        <div
          className={`text-center w-12 shrink-0 text-xs font-semibold rounded-full py-1 ${levelBadgeClasses(s.level)}`}
        >
          {s.level}
        </div>
        <div className="flex flex-col flex-grow min-w-0 text-left">
          <div className="font-semibold text-main-text">{primaryTitle}</div>
          {secondaryTitle && (
            <div className="text-secondary-text text-sm">{secondaryTitle}</div>
          )}
        </div>
      </div>
    </button>
  );
}

function CreateOptionCard({
  icon,
  title,
  description,
  onPressed,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onPressed: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPressed}
      className="my-1.5 w-full p-4 bg-surface border border-border rounded-xl transition-colors hover:bg-cream-dark text-left"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="text-primary text-xl min-w-[28px] flex justify-center"
        >
          {icon}
        </span>
        <div className="flex flex-col">
          <span className="font-semibold text-main-text">{title}</span>
          <span className="text-secondary-text text-sm">{description}</span>
        </div>
      </div>
    </button>
  );
}

export default HomePage;
