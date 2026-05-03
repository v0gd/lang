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
  variant = "default",
}: {
  children: React.ReactNode;
  onPressed: () => void;
  variant?: "default" | "cta";
}) {
  if (variant === "cta") {
    return (
      <div className="w-full mt-2 mb-4">
        <button
          type="button"
          onClick={onPressed}
          className="w-full bg-primary hover:bg-primary-hover text-white p-3 rounded-xl transition-colors"
        >
          {children}
        </button>
      </div>
    );
  }
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onPressed}
        className="my-1.5 w-full hover:bg-cream-dark p-3 bg-surface border border-border rounded-xl transition-colors"
      >
        {children}
      </button>
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
  // The story is shown as a primary title in the learned language (r) with an
  // optional mother-tongue (l) subtitle. Stories generated without a mother
  // tongue have only the r title.
  const primaryTitle = titleForLocale(s, r) ?? s.titles[0];
  const secondaryTitle = titleForLocale(s, l);
  const languagesMatch =
    s.locales.includes(r) &&
    (secondaryTitle !== undefined || s.locales.length === 1);
  const shouldShowFlags = !languagesMatch && showLanguageFlagsIfDontMatch;
  return (
    <Button onPressed={() => onStorySelected(s.id)}>
      <div className="flex items-center w-full gap-3">
        <div className="text-center min-w-[48px] text-sm font-semibold text-primary bg-primary-light rounded-full py-1">
          {s.level}
        </div>
        <div className="flex flex-col flex-grow text-left">
          <div className="font-semibold text-main-text">{primaryTitle}</div>
          {secondaryTitle && (
            <div className="text-secondary-text text-sm">{secondaryTitle}</div>
          )}
        </div>
        {shouldShowFlags && (
          <div className="flex items-center min-w-[40px] text-center">
            {s.locales.map((loc) => getFlagEmoji(loc)).join("")}
          </div>
        )}
        {onDelete && (
          <div
            className="flex items-center justify-center min-w-[40px] text-muted-text hover:text-red-500 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(s.id);
            }}
          >
            <FaTrashCan size={14} />
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
      <header className="text-left text-2xl font-semibold text-main-text mb-3">
        {lstr(l).my_stories_header}
      </header>

      <Button key="generate" onPressed={() => navigate("/generate")} variant="cta">
        <div className="w-full flex justify-center font-semibold text-base items-center gap-2">
          <FaWandMagicSparkles />
          {lstr(l).generate_story_button}
        </div>
      </Button>

      <header className="text-left text-2xl font-semibold text-main-text mt-10 mb-3">
        {lstr(l).stories_header}
      </header>

      {query.data.map(
        (story) =>
          story.locales.length === story.titles.length &&
          story.locales.length >= 1 && (
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
            <p className="text-lg font-semibold text-main-text">
              Delete this story?
            </p>
            <p className="text-secondary-text text-sm">
              The story and all its data will be permanently removed.
            </p>
            <div className="flex gap-3 mt-2 w-full">
              <button
                className="flex-1 py-2.5 rounded-xl font-semibold border border-border bg-surface hover:bg-cream-dark transition-colors"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      <header className="text-left text-2xl font-semibold text-main-text mb-3">
        {lstr(l).my_stories_header}
      </header>

      <Button key="generate" onPressed={() => navigate("/generate")} variant="cta">
        <div className="w-full flex justify-center font-semibold text-base items-center gap-2">
          <FaWandMagicSparkles />
          {lstr(l).generate_story_button}
        </div>
      </Button>

      {!queryGenerated.isError &&
        queryGenerated.data.map(
          (story) =>
            story.locales.length === story.titles.length &&
            story.locales.length >= 1 && (
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
        <div className="text-red-600 text-sm mt-2">{lstr(l).loading_story_list_error}</div>
      )}

      <header className="text-left text-2xl font-semibold text-main-text mt-10 mb-3">
        {lstr(l).stories_header}
      </header>

      {query.data.map(
        (story) =>
          story.locales.length === story.titles.length &&
          story.locales.length >= 1 && (
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
