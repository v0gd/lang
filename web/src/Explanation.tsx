import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Sentence } from "./story";
import { useExplainQuery, useWordExplainQuery } from "./queries";
import { API_URL } from "./config";
import { Modal } from "./Modal";
import { lstr } from "./localization";

export function ExplanationModal({
  storyId,
  l,
  r,
  lSentence,
  rSentence,
  closeModal,
}: {
  storyId: string;
  l: string;
  r: string;
  lSentence: Sentence;
  rSentence: Sentence;
  closeModal: () => void;
}) {
  const query = useExplainQuery(
    storyId,
    l,
    r,
    lSentence.index,
    rSentence.index,
  );

  let audioUrl = new URL(`${API_URL}/audio`);
  audioUrl.searchParams.append("story_id", storyId);
  audioUrl.searchParams.append("locale", r);
  audioUrl.searchParams.append("sentence_idx", rSentence.index.toString());

  return (
    <Modal
      showCloseButton={true}
      locale={l}
      closeModal={closeModal}
      height="h-[90%] max-h-[1200px]"
    >
      <div className="flex flex-col px-2 pt-2">
        <div className="text-lg text-main-text font-semibold leading-relaxed">
          {rSentence.text}
        </div>
        <div className="text-lg font-medium text-secondary-text mt-3 leading-relaxed">
          {lSentence.text}
        </div>
        {lSentence.hasAudio && (
          <div className="mt-4">
            <audio src={audioUrl.toString()} controls></audio>
          </div>
        )}
        {query.isPending && (
          <div className="mt-8 text-secondary-text">{lstr(l).loading_explain}</div>
        )}
        {query.isError && (
          <div className="mt-8 text-red-600">{lstr(l).loading_explain_error}</div>
        )}
        {query.isSuccess && (
          <div
            className="mt-8 flex flex-col gap-4 text-main-text leading-relaxed"
            dangerouslySetInnerHTML={{ __html: query.data }}
          ></div>
        )}
      </div>
    </Modal>
  );
}

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
    setAbove(spaceBelow < popupHeight + gap && parentRect.top > popupHeight + gap);

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
      className="absolute -left-4 z-50 bg-surface rounded-xl shadow-xl border border-border px-5 py-4"
      style={{
        ...(above
          ? { bottom: "100%", marginBottom: 5 }
          : { top: "100%", marginTop: 5 }),
        transform: shiftX ? `translateX(${shiftX}px)` : undefined,
        width: "min(24rem, calc(100vw - 1rem))",
      }}
      onClick={(e) => e.stopPropagation()}
    >
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
        <p className="text-sm text-main-text leading-relaxed">
          {query.data}
        </p>
      )}
    </div>
  );
}
