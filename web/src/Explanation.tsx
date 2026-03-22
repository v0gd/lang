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
      <div className="flex flex-col px-4 pt-4">
        <div className="text-xl text-main-text font-semibold">
          {rSentence.text}
        </div>
        <div className="text-xl font-semibold text-secondary-text mt-4">
          {lSentence.text}
        </div>
        {lSentence.hasAudio && (
          <div className="mt-4">
            <audio src={audioUrl.toString()} controls></audio>
          </div>
        )}
        {query.isPending && (
          <div className="mt-8">{lstr(l).loading_explain}</div>
        )}
        {query.isError && (
          <div className="mt-8">{lstr(l).loading_explain_error}</div>
        )}
        {query.isSuccess && (
          <div
            className="mt-8 flex flex-col gap-4"
            dangerouslySetInnerHTML={{ __html: query.data }}
          ></div>
        )}
      </div>
    </Modal>
  );
}

export interface PopupPosition {
  x: number;
  y: number;
  above: boolean;
  alignRight: boolean;
}

export function computePopupPosition(
  target: HTMLElement,
): PopupPosition {
  const rect = target.getBoundingClientRect();
  const popupHeight = 150;
  const popupWidth = 384;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceRight = window.innerWidth - rect.left;
  const above = spaceBelow < popupHeight && rect.top > popupHeight;
  const alignRight = spaceRight < popupWidth;

  return {
    x: (alignRight ? rect.right : rect.left) + window.scrollX,
    y: (above ? rect.top - 5 : rect.bottom + 5) + window.scrollY,
    above,
    alignRight,
  };
}

export function WordExplanationPopup({
  storyId,
  l,
  r,
  lSentenceIdx,
  rSentenceIdx,
  wordIdx,
  position,
}: {
  storyId: string;
  l: string;
  r: string;
  lSentenceIdx: number;
  rSentenceIdx: number;
  wordIdx: number;
  position: PopupPosition;
  onClose: () => void;
}) {
  const query = useWordExplainQuery(
    storyId,
    l,
    r,
    lSentenceIdx,
    rSentenceIdx,
    wordIdx,
  );

  return (
    <div
      className="absolute bg-emerald-50 rounded-xl shadow-2xl ring-1 ring-black/10 border border-emerald-200 px-5 py-4 max-w-sm z-50"
      style={{
        ...(position.alignRight
          ? { right: document.documentElement.scrollWidth - position.x }
          : { left: position.x }),
        top: position.y,
        ...(position.above && { transform: "translateY(-100%)" }),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {query.isPending && (
        <div className="flex items-center gap-2 text-gray-500">
          <svg
            className="animate-spin h-4 w-4"
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
        <p className="text-red-600">{lstr(l).loading_explain_error}</p>
      )}
      {query.isSuccess && (
        <p className="text-base text-gray-800 leading-relaxed">
          {query.data}
        </p>
      )}
    </div>
  );
}
