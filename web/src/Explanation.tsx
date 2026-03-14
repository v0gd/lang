import { Sentence } from "./story";
import { useExplainQuery } from "./queries";
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
