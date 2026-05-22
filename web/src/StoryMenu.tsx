import { useEffect, useRef, useState } from "react";
import {
  CancelledError,
  NoTargetLanguageError,
  useDeleteStoryMutation,
  useGeneratedStoryListQuery,
  useScanMutation,
  useStoryListQuery,
} from "./queries";
import { lstr } from "./localization";
import { useNavigate } from "react-router-dom";
import {
  FaWandMagicSparkles,
  FaTrashCan,
  FaCamera,
  FaPenToSquare,
} from "react-icons/fa6";
import { StoryDescriptor } from "./story";
import getFlagEmoji from "./LanguageFlag";
import { Modal } from "./Modal";
import { useLoggedIn } from "./firebase";
import { ProgressOverlay } from "./ProgressOverlay";

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

// ScanButton renders the "Scan" CTA on the main page and owns the hidden file
// input that triggers a multi-platform image picker (camera or gallery).
//
// Behavior:
// - When `onUnauthorized` is set (used in the logged-out variant) the click
//   bypasses the picker entirely and signals the parent to navigate to login.
// - Otherwise it opens the native picker. On selection, `onFiles` is called
//   with the chosen images and the parent kicks off the scan mutation.
function ScanButton({
  l,
  onFiles,
  onUnauthorized,
  disabled,
}: {
  l: string;
  onFiles: (files: File[]) => void;
  onUnauthorized?: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => {
    if (disabled) return;
    if (onUnauthorized) {
      onUnauthorized();
      return;
    }
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    onFiles(Array.from(files));
    // Reset so picking the same files again still fires onChange.
    e.target.value = "";
  };

  return (
    <div className="w-full mt-2 mb-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="w-full bg-surface hover:bg-cream-dark text-main-text border border-border p-3 rounded-xl transition-colors disabled:opacity-50"
      >
        <div className="w-full flex justify-center font-semibold text-base items-center gap-2">
          <FaCamera />
          {lstr(l).scan_button}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={handleChange}
      />
    </div>
  );
}

// UploadButton renders the "Upload text" CTA on the main page. The actual
// textarea + LLM pipeline lives on the /upload page; this button just
// navigates there. We keep it visually identical to ScanButton so the two
// secondary entry points read as a pair below the primary "Create a new
// story" CTA.
function UploadButton({ l, onPressed }: { l: string; onPressed: () => void }) {
  return (
    <div className="w-full mt-2 mb-4">
      <button
        type="button"
        onClick={onPressed}
        className="w-full bg-surface hover:bg-cream-dark text-main-text border border-border p-3 rounded-xl transition-colors"
      >
        <div className="w-full flex justify-center font-semibold text-base items-center gap-2">
          <FaPenToSquare />
          {lstr(l).upload_button}
        </div>
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

      <ScanButton l={l} onFiles={() => {}} onUnauthorized={() => navigate("/login")} />

      <UploadButton l={l} onPressed={() => navigate("/login")} />

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
  const loggedIn = useLoggedIn();
  const query = useStoryListQuery(l, r);
  const queryGenerated = useGeneratedStoryListQuery(l, r);
  const deleteMutation = useDeleteStoryMutation();
  const scanMutation = useScanMutation();
  const scanAbortRef = useRef<AbortController | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);

  const confirmDelete = () => {
    if (confirmDeleteId) {
      deleteMutation.mutate(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  const handleScanFiles = (files: File[]) => {
    if (!loggedIn) {
      navigate("/login");
      return;
    }
    if (scanMutation.isPending) return;
    setScanErrorMessage(null);
    scanAbortRef.current = new AbortController();
    scanMutation.mutate({
      images: files,
      r,
      signal: scanAbortRef.current.signal,
    });
  };

  const cancelScan = () => {
    scanAbortRef.current?.abort();
  };

  // Pump scan results into navigation / error UI. Doing this in an effect
  // (instead of inside the button click handler) lets useScanMutation own its
  // pending/error state and survives React strict-mode double-invocations.
  useEffect(() => {
    if (scanMutation.isSuccess && scanMutation.data) {
      const id = scanMutation.data.id;
      scanMutation.reset();
      navigate(`/generated/${id}`);
    }
  }, [scanMutation.isSuccess, scanMutation.data, scanMutation, navigate]);

  useEffect(() => {
    if (scanMutation.isError) {
      // User-initiated cancellation isn't a real error - silently reset so
      // the next scan attempt can happen without a stray error toast.
      if (scanMutation.error instanceof CancelledError) {
        scanMutation.reset();
        return;
      }
      const message =
        scanMutation.error instanceof NoTargetLanguageError
          ? lstr(l).scan_no_target_text_error
          : lstr(l).scan_error;
      setScanErrorMessage(message);
      scanMutation.reset();
    }
  }, [scanMutation.isError, scanMutation.error, scanMutation, l]);

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

      {scanMutation.isPending && (
        <ProgressOverlay
          l={l}
          message={lstr(l).scan_overlay_message}
          icon={<FaCamera />}
          onCancel={cancelScan}
        />
      )}

      {scanErrorMessage && (
        <Modal
          showCloseButton={true}
          locale={l}
          closeModal={() => setScanErrorMessage(null)}
        >
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-base text-main-text text-center">
              {scanErrorMessage}
            </p>
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

      <ScanButton l={l} onFiles={handleScanFiles} disabled={scanMutation.isPending} />

      <UploadButton l={l} onPressed={() => navigate("/upload")} />

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
