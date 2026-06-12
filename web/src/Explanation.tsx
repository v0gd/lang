import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FaVolumeHigh, FaStop } from "react-icons/fa6";
import {
  SAVE_WORD_LIMIT_ERROR,
  fetchSentenceAudioUrl,
  useRemoveWordMutation,
  useSaveWordMutation,
  useWordExplainQuery,
} from "./queries";
import { useLoggedIn } from "./firebase";
import { lstr } from "./localization";

// Height the popup is assumed to reach once the explanation has loaded. The
// above/below placement is decided against this estimate instead of the live
// height: the popup is small while the explanation is loading, and deciding
// on the live height would flip the popup to the other side of the word the
// moment content arrives - moving the Listen button right before a click.
const ESTIMATED_LOADED_POPUP_HEIGHT_PX = 180;

export function WordExplanationPopup({
  storyId,
  l,
  r,
  lSentenceIdx,
  rSentenceIdx,
  wordIdx,
}: {
  storyId: string;
  l: string;
  r: string;
  lSentenceIdx: number;
  rSentenceIdx: number;
  wordIdx: number;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(false);
  const [shiftX, setShiftX] = useState(0);

  const query = useWordExplainQuery(
    storyId,
    l,
    r,
    lSentenceIdx,
    rSentenceIdx,
    wordIdx,
  );

  const reposition = useCallback(() => {
    const popup = popupRef.current;
    if (!popup || !popup.offsetParent) return;

    const parentRect = (popup.offsetParent as HTMLElement).getBoundingClientRect();
    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;

    const gap = 5;
    const spaceBelow = window.innerHeight - parentRect.bottom;
    // max() so a popup that turned out even taller than the estimate can
    // still flip above as a last resort instead of clipping off-screen.
    const effectiveHeight = Math.max(
      popupHeight,
      ESTIMATED_LOADED_POPUP_HEIGHT_PX,
    );
    setAbove(
      spaceBelow < effectiveHeight + gap && parentRect.top > effectiveHeight + gap,
    );

    const margin = 8;
    const nudge = 16;
    const naturalLeft = parentRect.left - nudge;
    let shift = 0;
    if (naturalLeft + popupWidth > window.innerWidth - margin) {
      shift = window.innerWidth - margin - naturalLeft - popupWidth;
    }
    if (naturalLeft + shift < margin) {
      shift = margin - naturalLeft;
    }
    setShiftX(shift);
  }, []);

  useLayoutEffect(() => {
    reposition();
  });

  useEffect(() => {
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [reposition]);

  return (
    <div
      ref={popupRef}
      className="absolute -left-4 z-50 flex flex-col bg-surface rounded-xl shadow-xl border border-border px-5 py-4 select-text cursor-text"
      style={{
        ...(above
          ? { bottom: "100%", marginBottom: 5 }
          : { top: "100%", marginTop: 5 }),
        transform: shiftX ? `translateX(${shiftX}px)` : undefined,
        width: "min(24rem, calc(100vw - 1rem))",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* The Listen row is pinned to the popup's anchored edge: top when the
          popup opens below the word (top-anchored, grows downward), bottom
          when it opens above (bottom-anchored, grows upward). That way the
          button keeps its position on the page when the loading row is
          replaced by the explanation text. The edge is switched via CSS
          order, NOT by rendering the row in two conditional slots: the row
          must keep its React identity across an above/below flip, or the
          remount would stop in-progress audio playback. */}
      <div className={above ? "order-last mt-3" : "mb-3"}>
        <ListenSentenceButton l={l} storyId={storyId} r={r} rSentenceIdx={rSentenceIdx} />
      </div>
      {query.isPending && (
        <div className="flex items-center gap-2 text-secondary-text">
          <svg
            className="animate-spin h-4 w-4 text-primary"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {lstr(l).loading_explain}
        </div>
      )}
      {query.isError && (
        <p className="text-red-600 text-sm">{lstr(l).loading_explain_error}</p>
      )}
      {query.isSuccess && (
        <p className="text-sm text-main-text leading-relaxed select-text">
          {query.data.content}
        </p>
      )}
      {query.isSuccess && query.data.dictionaryEntryId !== null && (
        <SaveWordButton
          l={l}
          dictionaryEntryId={query.data.dictionaryEntryId}
          alreadySaved={query.data.alreadySaved}
        />
      )}
    </div>
  );
}

// ListenSentenceButton plays the TTS audio of the whole sentence the clicked
// word belongs to. The audio bytes are fetched once per popup and cached as
// an object URL; clicking while playing stops playback. Unmounting (closing
// the popup) stops the audio and releases the object URL.
function ListenSentenceButton({
  l,
  storyId,
  r,
  rSentenceIdx,
}: {
  l: string;
  storyId: string;
  r: string;
  rSentenceIdx: number;
}) {
  type PlayState = "idle" | "loading" | "playing" | "error";
  const [playState, setPlayState] = useState<PlayState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    // Reset on every (re-)mount: React StrictMode runs mount -> cleanup ->
    // mount in development, and a ref left true by the simulated unmount
    // would make every fetch result look like it arrived after close.
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      audioRef.current?.pause();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleClick = async () => {
    if (playState === "loading") return;
    if (playState === "playing") {
      audioRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      setPlayState("idle");
      return;
    }
    try {
      if (!objectUrlRef.current) {
        setPlayState("loading");
        const objectUrl = await fetchSentenceAudioUrl(storyId, r, rSentenceIdx);
        if (unmountedRef.current) {
          // The popup closed while the audio was loading; don't start
          // playback from beyond the grave.
          URL.revokeObjectURL(objectUrl);
          return;
        }
        objectUrlRef.current = objectUrl;
        const audio = new Audio(objectUrl);
        audio.onended = () => {
          if (!unmountedRef.current) setPlayState("idle");
        };
        audioRef.current = audio;
      }
      await audioRef.current!.play();
      setPlayState("playing");
    } catch (err) {
      console.error("Failed to play sentence audio", err);
      if (!unmountedRef.current) setPlayState("error");
    }
  };

  const strings = lstr(l);
  const label = (() => {
    switch (playState) {
      case "loading":
        return strings.listen_loading;
      case "playing":
        return strings.listen_stop;
      default:
        return strings.listen_button;
    }
  })();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={playState === "loading"}
        onClick={handleClick}
        className="flex items-center gap-1.5 text-sm font-medium text-primary border border-border rounded-lg px-3 py-1.5 bg-surface hover:bg-cream-dark transition-colors disabled:opacity-50"
      >
        {playState === "playing" ? <FaStop size={12} /> : <FaVolumeHigh size={12} />}
        {label}
      </button>
      {playState === "error" && (
        <span className="text-sm text-red-600">{strings.listen_error}</span>
      )}
    </div>
  );
}

// SaveWordButton toggles the (already-ingested) dictionary sense in the user's
// saved-word list. It is only shown to logged-in users, since saving requires
// auth. Saving returns immediately; the localized description is produced in
// the background server-side. Removing drops only the user's reference, leaving
// the global dictionary entry intact.
function SaveWordButton({
  l,
  dictionaryEntryId,
  alreadySaved,
}: {
  l: string;
  dictionaryEntryId: number;
  alreadySaved: boolean;
}) {
  const saveMutation = useSaveWordMutation();
  const removeMutation = useRemoveWordMutation();
  // Reactive hook (not the synchronous isLoggedIn()) so the button doesn't
  // render in the wrong state while Firebase is still hydrating auth.
  const loggedIn = useLoggedIn();

  if (!loggedIn) {
    return null;
  }

  // alreadySaved comes from the explain query, which both save and remove keep
  // up to date in the query cache, so this stays correct across popup reopens.
  if (alreadySaved) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z"
              clipRule="evenodd"
            />
          </svg>
          {lstr(l).word_saved}
        </span>
        <button
          type="button"
          disabled={removeMutation.isPending}
          onClick={() => removeMutation.mutate({ dictionaryEntryId })}
          className="text-sm font-medium text-secondary-text hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {removeMutation.isPending
            ? lstr(l).removing_word
            : lstr(l).remove_word_button}
        </button>
        {removeMutation.isError && (
          <span className="text-sm text-red-600">
            {lstr(l).remove_word_error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        disabled={saveMutation.isPending}
        onClick={() => saveMutation.mutate({ dictionaryEntryId, l })}
        className="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {saveMutation.isPending
          ? lstr(l).saving_word
          : lstr(l).save_word_button}
      </button>
      {saveMutation.isError && (
        <span className="text-sm text-red-600">
          {saveMutation.error.message === SAVE_WORD_LIMIT_ERROR
            ? lstr(l).save_word_limit_error
            : lstr(l).save_word_error}
        </span>
      )}
    </div>
  );
}
