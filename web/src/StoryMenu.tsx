import { useGeneratedStoryListQuery, useStoryListQuery } from "./queries";
import { lstr } from "./localization";
import { useNavigate } from "react-router-dom";
import { FaWandMagicSparkles } from "react-icons/fa6";
import { StoryDescriptor } from "./story";
import getFlagEmoji from "./LanguageFlag";

function Button({
  children,
  onPressed,
}: {
  children: React.ReactNode;
  onPressed: () => void;
}) {
  return (
    <div className="w-full px-3">
      <button
        type="button"
        onClick={onPressed}
        className="my-2 w-full hover:bg-blue-100 p-2 bg-gray-50 rounded-lg shadow-lg max-w-xl"
      >
        {children}
      </button>
    </div>
  );
}

function StoryButton({
  s,
  l,
  r,
  showLanguagesIfDontMatch: showLanguageFlagsIfDontMatch,
  onStorySelected,
}: {
  s: StoryDescriptor;
  l: string;
  r: string;
  showLanguagesIfDontMatch: boolean;
  onStorySelected: (storyId: string) => void;
}) {
  const languagesMatch =
    (s.locales[0] === l && s.locales[1] === r) ||
    (s.locales[0] === r && s.locales[1] === l);
  const shouldShowFlags = !languagesMatch && showLanguageFlagsIfDontMatch;
  return (
    <Button onPressed={() => onStorySelected(s.id)}>
      <div className="flex justify-left items-center w-[100%]">
        <div className="text-center min-w-[60px] font-semibold text-base">
          {s.level}
        </div>
        <div className="flex flex-col flex-grow items-left text-left text-base">
          <div className="font-semibold">
            {s.locales[0] == l ? s.titles[1] : s.titles[0]}
          </div>
          <div className="text-secondary-text font-semibold">
            {s.locales[0] == l ? s.titles[0] : s.titles[1]}
          </div>
        </div>
        {shouldShowFlags && (
          <div className="flex justify-center items-center min-w-[40px] text-center">
            {getFlagEmoji(s.locales[0]) + getFlagEmoji(s.locales[1])}
          </div>
        )}
        {/* {!shouldShowFlags && <div className="min-w-[60px]"></div>} */}
      </div>
    </Button>
  );
}

export function StoryMenuUnauthorized({
  l,
  r,
  onStorySelected,
}: {
  l: string;
  r: string;
  onStorySelected: (storyId: string) => void;
}) {
  const navigate = useNavigate();
  const query = useStoryListQuery(l, r);

  if (query.isPending) {
    return <div>{lstr(l).loading_story_list}</div>;
  }

  if (query.isError) {
    return <div>{lstr(l).loading_story_list_error}</div>;
  }

  return (
    <div className="w-full overflow-auto">
      <header className="text-left text-2xl font-semibold">
        {lstr(l).my_stories_header}
      </header>

      <Button key="generate" onPressed={() => navigate("/generate")}>
        <div className="w-full min-h-12 flex justify-left font-semibold text-lg items-center">
          <FaWandMagicSparkles className="inline-block mr-2 mt-[2px]" />
          {lstr(l).generate_story_button}
        </div>
      </Button>

      <header className="text-left text-2xl font-semibold mt-10">
        {lstr(l).stories_header}
      </header>

      {query.data.map(
        (story) =>
          story.locales.length === 2 &&
          story.titles.length === 2 && (
            <StoryButton
              key={story.id}
              s={story}
              l={l}
              r={r}
              onStorySelected={onStorySelected}
              showLanguagesIfDontMatch={false}
            />
          ),
      )}
    </div>
  );
}

export function StoryMenu({
  l,
  r,
  onStorySelected,
}: {
  l: string;
  r: string;
  onStorySelected: (storyId: string) => void;
}) {
  const navigate = useNavigate();
  const query = useStoryListQuery(l, r);
  const queryGenerated = useGeneratedStoryListQuery("test-author", l, r);

  if (query.isPending || queryGenerated.isPending) {
    return <div>{lstr(l).loading_story_list}</div>;
  }

  if (query.isError) {
    return <div>{lstr(l).loading_story_list_error}</div>;
  }

  return (
    <div className="w-full overflow-auto">
      <header className="text-left text-2xl font-semibold">
        {lstr(l).my_stories_header}
      </header>

      <Button key="generate" onPressed={() => navigate("/generate")}>
        <div className="w-full min-h-12 flex justify-center font-semibold text-lg items-center">
          <FaWandMagicSparkles className="inline-block mr-2 mt-[2px]" />
          {lstr(l).generate_story_button}
        </div>
      </Button>

      {!queryGenerated.isError &&
        queryGenerated.data.map(
          (story) =>
            story.locales.length === 2 &&
            story.titles.length === 2 && (
              <StoryButton
                key={story.id}
                s={story}
                l={l}
                r={r}
                onStorySelected={onStorySelected}
                showLanguagesIfDontMatch={true}
              />
            ),
        )}

      {queryGenerated.isError && (
        <div className="text-red-800">{lstr(l).loading_story_list_error}</div>
      )}

      <header className="text-left text-2xl font-semibold mt-10">
        {lstr(l).stories_header}
      </header>

      {query.data.map(
        (story) =>
          story.locales.length === 2 &&
          story.titles.length === 2 && (
            <StoryButton
              key={story.id}
              s={story}
              l={l}
              r={r}
              onStorySelected={onStorySelected}
              showLanguagesIfDontMatch={false}
            />
          ),
      )}
    </div>
  );
}

export default StoryMenu;
