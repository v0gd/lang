import { createContext, Fragment, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Chapter, Paragraph, Sentence } from "./story";
import { apiUrl, useStoryQuery, NotFoundError } from "./queries";
import { lstr } from "./localization";
import {
  WordExplanationPopup,
  PopupPosition,
  computePopupPosition,
} from "./Explanation";

interface ActivePopup {
  storyId: string;
  l: string;
  r: string;
  lSentenceIdx: number;
  rSentenceIdx: number;
  wordIdx: number;
  position: PopupPosition;
}

const PopupContext = createContext<{
  activePopup: ActivePopup | null;
  openPopup: (popup: ActivePopup) => void;
  closePopup: () => void;
}>({
  activePopup: null,
  openPopup: () => {},
  closePopup: () => {},
});

function PopupProvider({ l, children }: { l: string; children: React.ReactNode }) {
  const [activePopup, setActivePopup] = useState<ActivePopup | null>(null);
  const closePopup = useCallback(() => setActivePopup(null), []);
  const openPopup = useCallback((popup: ActivePopup) => setActivePopup(popup), []);

  useEffect(() => {
    if (!activePopup) return;
    const handleClick = () => closePopup();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [activePopup, closePopup]);

  return (
    <PopupContext.Provider value={{ activePopup, openPopup, closePopup }}>
      {children}
      {activePopup &&
        createPortal(
          <WordExplanationPopup
            storyId={activePopup.storyId}
            l={activePopup.l}
            r={activePopup.r}
            lSentenceIdx={activePopup.lSentenceIdx}
            rSentenceIdx={activePopup.rSentenceIdx}
            wordIdx={activePopup.wordIdx}
            position={activePopup.position}
            onClose={closePopup}
          />,
          document.body,
        )}
    </PopupContext.Provider>
  );
}

function Image({ storyId, imageId }: { storyId: string; imageId?: string }) {
  if (!imageId) {
    return <></>;
  }
  let imageUrl = apiUrl("/image");
  imageUrl.searchParams.append("story_id", storyId);
  imageUrl.searchParams.append("id", imageId);
  return (
    <div className="relative w-full pb-[40%] overflow-hidden rounded-xl bg-yellow mb-4">
      <img
        alt=""
        src={imageUrl.toString()}
        className="absolute object-cover top-1/2 left-0 w-full h-auto -translate-y-1/2"
      />
    </div>
  );
}

function SentenceView({
  text,
  storyId,
  l,
  r,
  lSentence,
  rSentence,
  textStyle,
  interactive,
}: {
  text: string;
  storyId: string;
  l: string;
  r: string;
  lSentence: Sentence;
  rSentence: Sentence;
  textStyle: string;
  interactive: boolean;
}) {
  const { activePopup, openPopup } = useContext(PopupContext);

  const onWordClick = useCallback(
    (e: React.MouseEvent, wordIdx: number) => {
      e.stopPropagation();
      const pos = computePopupPosition(e.target as HTMLElement);
      openPopup({
        storyId,
        l,
        r,
        lSentenceIdx: lSentence.index,
        rSentenceIdx: rSentence.index,
        wordIdx,
        position: pos,
      });
    },
    [storyId, l, r, lSentence.index, rSentence.index, openPopup],
  );

  if (!interactive) {
    return (
      <span className={`select-none ${textStyle}`}>{text}</span>
    );
  }

  const isActiveInThisSentence =
    activePopup?.lSentenceIdx === lSentence.index &&
    activePopup?.rSentenceIdx === rSentence.index;

  const tokens = text.split(/(\s+)/);
  let wordIdx = 0;

  return (
    <span className={`select-none ${textStyle}`}>
      {tokens.map((token, idx) => {
        if (/^\s+$/.test(token) || token === "") {
          return (
            <Fragment key={idx}>{token}</Fragment>
          );
        }

        const currentWordIdx = wordIdx++;
        const leading = token.match(/^\p{P}+/u)?.[0] ?? "";
        const trailing = token.match(/\p{P}+$/u)?.[0] ?? "";
        const word = token.slice(
          leading.length,
          token.length - trailing.length || undefined,
        );
        const isActive =
          isActiveInThisSentence && activePopup?.wordIdx === currentWordIdx;

        return (
          <Fragment key={idx}>
            {leading}
            <span
              className={`cursor-pointer hover:bg-emerald-300 rounded px-[1px] transition-colors ${isActive ? "bg-emerald-300" : ""}`}
              onClick={(e) => onWordClick(e, currentWordIdx)}
            >
              {word}
            </span>
            {trailing}
          </Fragment>
        );
      })}
    </span>
  );
}

function ParagraphView({
  storyId,
  l,
  r,
  lParagraph,
  rParagraph,
  shouldShowTranslation,
  showTranslationBySentence,
}: {
  storyId: string;
  l: string;
  r: string;
  lParagraph: Paragraph;
  rParagraph: Paragraph;
  shouldShowTranslation: boolean;
  showTranslationBySentence: boolean;
}) {
  if (lParagraph.sentences.length !== rParagraph.sentences.length) {
    console.error("Paragraph sentences are not aligned");
    return (
      <div className="text-red-800">Paragraph sentences are not aligned</div>
    );
  }

  return (
    <div>
      <Image storyId={storyId} imageId={rParagraph.imageId} />
      {(!shouldShowTranslation || !showTranslationBySentence) && (
        <div className="text-justify">
          {rParagraph.sentences.map((sentence, index) => (
            <span key={index} className={index === 0 ? "ml-4" : ""}>
              <SentenceView
                text={sentence.text}
                storyId={storyId}
                l={l}
                r={r}
                lSentence={lParagraph.sentences[index]}
                rSentence={sentence}
                textStyle="text-base text-main-text"
                interactive={true}
              />
            </span>
          ))}
        </div>
      )}
      {shouldShowTranslation && !showTranslationBySentence && (
        <div className="mt-3 text-justify">
          {lParagraph.sentences.map((sentence, index) => (
            <span key={index} className={index === 0 ? "ml-4" : ""}>
              <SentenceView
                text={sentence.text}
                storyId={storyId}
                l={l}
                r={r}
                lSentence={sentence}
                rSentence={rParagraph.sentences[index]}
                textStyle="text-base text-secondary-text font-thin"
                interactive={false}
              />
            </span>
          ))}
        </div>
      )}
      {shouldShowTranslation && showTranslationBySentence && (
        <>
          {rParagraph.sentences.map((sentence, index) => (
            <Fragment key={index}>
              <div
                className={index !== 0 ? "text-justify mt-3" : "text-justify"}
              >
                <span>
                  <SentenceView
                    text={sentence.text}
                    storyId={storyId}
                    l={l}
                    r={r}
                    lSentence={lParagraph.sentences[index]}
                    rSentence={sentence}
                    textStyle="text-base text-main-text"
                    interactive={true}
                  />
                </span>
              </div>
              {index < lParagraph.sentences.length && (
                <div className="text-justify">
                  <span>
                    <SentenceView
                      text={lParagraph.sentences[index].text}
                      storyId={storyId}
                      l={l}
                      r={r}
                      lSentence={lParagraph.sentences[index]}
                      rSentence={rParagraph.sentences[index]}
                      textStyle="text-base text-secondary-text font-thin"
                      interactive={false}
                    />
                  </span>
                </div>
              )}
            </Fragment>
          ))}
        </>
      )}
    </div>
  );
}

function ChapterView({
  storyId,
  l,
  r,
  lChapter,
  rChapter,
  shouldShowTranslation,
  showTranslationBySentence,
}: {
  storyId: string;
  l: string;
  r: string;
  lChapter: Chapter;
  rChapter: Chapter;
  shouldShowTranslation: boolean;
  showTranslationBySentence: boolean;
}) {
  if (lChapter.paragraphs.length !== rChapter.paragraphs.length) {
    console.error("Chapter paragraphs are not aligned");
    return (
      <div className="text-red-800">Chapter paragraphs are not aligned</div>
    );
  }

  const paragraphGap = shouldShowTranslation ? 8 : 4;

  return (
    <div>
      {rChapter.title && (
        <h2 className="text-xl font-bold text-center mt-4">
          {rChapter.title}
        </h2>
      )}
      <div className={`flex flex-col gap-${paragraphGap} mt-4`}>
        {rChapter.paragraphs.map((paragraph, index) => (
          <ParagraphView
            key={index}
            storyId={storyId}
            l={l}
            r={r}
            lParagraph={lChapter.paragraphs[index]}
            rParagraph={paragraph}
            shouldShowTranslation={shouldShowTranslation}
            showTranslationBySentence={showTranslationBySentence}
          />
        ))}
      </div>
    </div>
  );
}

function StoryView({
  storyId,
  l,
  r,
  shouldShowTranslation,
  showTranslationBySentence,
}: {
  storyId: string;
  l: string;
  r: string;
  shouldShowTranslation: boolean;
  showTranslationBySentence: boolean;
}) {
  const query = useStoryQuery(storyId, l, r);

  if (query.isPending) {
    return (
      <div className="w-full p-4 overflow-auto">{lstr(l).loading_story}</div>
    );
  }

  if (query.isError) {
    return (
      <div className="w-full p-4 overflow-auto font-semibold text-[22px]">
        {query.error instanceof NotFoundError
          ? lstr(l).story_not_found_error
          : lstr(l).loading_story_error}
      </div>
    );
  }

  if (storyId.startsWith("g_")) {
    let locales = Array.from(query.data.localizations.keys());
    if (locales.includes(l)) {
      r = locales[0] == l ? locales[1] : locales[0];
    } else if (locales.includes(r)) {
      l = locales[0] == r ? locales[1] : locales[0];
    } else {
      l = locales[0];
      r = locales[1];
    }
  }

  const lStory = query.data.localizations.get(l)!;
  const rStory = query.data.localizations.get(r)!;

  if (lStory.chapters.length !== rStory.chapters.length) {
    console.error("Story paragraphs are not aligned");
    return (
      <div className="text-red-800">Story paragraphs are not aligned</div>
    );
  }

  return (
    <PopupProvider l={l}>
      <div>
        <Image storyId={storyId} imageId={rStory.imageId} />
        <h1 className="text-2xl font-bold text-center">{rStory.title}</h1>
        {shouldShowTranslation && (
          <h1 className="text-2xl font-medium text-secondary-text text-center">
            {lStory.title}
          </h1>
        )}
        <div className="mt-4">
          <div className="flex flex-col gap-8 pb-10">
            {rStory.chapters.map((chapter, index) => (
              <ChapterView
                key={index}
                storyId={storyId}
                l={l}
                r={r}
                lChapter={lStory.chapters[index]}
                rChapter={chapter}
                shouldShowTranslation={shouldShowTranslation}
                showTranslationBySentence={showTranslationBySentence}
              />
            ))}
          </div>
        </div>
      </div>
    </PopupProvider>
  );
}

export default StoryView;
