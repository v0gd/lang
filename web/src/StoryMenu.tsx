import { useState } from "react";
import {
  useDeleteStoryMutation,
  useGeneratedStoryListQuery,
  useStoryListQuery,
} from "./queries";
import { lstr } from "./localization";
import { useNavigate } from "react-router-dom";
import { FaWandMagicSparkles, FaTrashCan } from "react-icons/fa6";
import { StoryDescriptor } from "./story";
import getFlagEmoji from "./LanguageFlag";
import { Modal } from "./Modal";

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
  onDelete,
}: {
  s: StoryDescriptor;
  l: string;
  r: string;
  showLanguagesIfDontMatch: boolean;
  onStorySelected: (storyId: string) => void;
  onDelete?: (storyId: string) => void;
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
        {onDelete && (
          <div
            className="flex items-center justify-center min-w-[40px] text-gray-400 hover:text-red-500 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(s.id);
            }}
          >
            <FaTrashCan size={16} />
          </div>
        )}
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
  const queryGenerated = useGeneratedStoryListQuery(l, r);
  const deleteMutation = useDeleteStoryMutation();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const confirmDelete = () => {
    if (confirmDeleteId) {
      deleteMutation.mutate(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  if (query.isPending || queryGenerated.isPending) {
    return <div>{lstr(l).loading_story_list}</div>;
  }

  if (query.isError) {
    return <div>{lstr(l).loading_story_list_error}</div>;
  }

  return (
    <div className="w-full overflow-auto">
      {confirmDeleteId && (
        <Modal
          showCloseButton={false}
          locale={l}
          closeModal={() => setConfirmDeleteId(null)}
        >
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-lg font-semibold text-gray-800">
              Delete this story?
            </p>
            <p className="text-secondary-text text-sm">
              The story and all its data will be permanently removed.
            </p>
            <div className="flex gap-3 mt-2 w-full">
              <button
                className="flex-1 py-2 rounded-lg font-semibold bg-gray-50 hover:bg-blue-100 shadow transition-colors"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2 rounded-lg font-semibold bg-red-500 hover:bg-red-600 text-white shadow transition-colors"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

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
                onDelete={setConfirmDeleteId}
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
