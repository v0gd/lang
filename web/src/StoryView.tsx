import { createContext, Fragment, useCallback, useContext, useEffect, useState } from "react";
import { Chapter, Paragraph, Sentence } from "./story";
import { apiUrl, useStoryQuery, NotFoundError } from "./queries";
import { lstr } from "./localization";
import { WordExplanationPopup } from "./Explanation";
import {
  GENDER_CLASS,
  GENDER_MARKER_REGEX,
  Gender,
  stripGenderMarkers,
  supportsGenderColoring,
} from "./gender";

interface ActivePopup {
  storyId: string;
  l: string;
  r: string;
  lSentenceIdx: number;
  rSentenceIdx: number;
  wordIdx: number;
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

function PopupProvider({ children }: { children: React.ReactNode }) {
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
    <div className="relative w-full pb-[40%] overflow-hidden rounded-2xl shadow-sm mb-6">
      <img
        alt=""
        src={imageUrl.toString()}
        className="absolute object-cover top-1/2 left-0 w-full h-auto -translate-y-1/2"
      />
    </div>
  );
}

// Extracts the gender marker (if any) from a single token and returns the
// token with the marker stripped. Returns the marker letter (m/f/n) or null
// when the token has no marker. Used by both the interactive and
// non-interactive branches in SentenceView so markers NEVER reach the DOM.
function splitGenderMarker(token: string): {
  cleanToken: string;
  gender: Gender | null;
} {
  const match = token.match(GENDER_MARKER_REGEX);
  // Reset lastIndex because GENDER_MARKER_REGEX is a /g regex and
  // `match` on a /g regex doesn't have capture groups; we read the letter
  // out of the matched string itself ("{m}" -> "m").
  if (!match || match.length === 0) {
    return { cleanToken: token, gender: null };
  }
  const gender = match[0][1] as Gender;
  return { cleanToken: token.replace(GENDER_MARKER_REGEX, ""), gender };
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
  applyGenderColors,
}: {
  text: string;
  storyId: string;
  l: string;
  r: string;
  lSentence: Sentence;
  rSentence: Sentence;
  textStyle: string;
  interactive: boolean;
  // When true, tokens carrying a {m/f/n} marker are tinted with the
  // gender-specific class. When false the markers are still stripped, just
  // not coloured (used for the L-side / translated text and for stories in
  // locales that don't support gender markers at all).
  applyGenderColors: boolean;
}) {
  const { activePopup, openPopup } = useContext(PopupContext);

  const onWordClick = useCallback(
    (e: React.MouseEvent, wordIdx: number) => {
      e.stopPropagation();
      openPopup({
        storyId,
        l,
        r,
        lSentenceIdx: lSentence.index,
        rSentenceIdx: rSentence.index,
        wordIdx,
      });
    },
    [storyId, l, r, lSentence.index, rSentence.index, openPopup],
  );

  if (!interactive) {
    // Strip markers but do not colour: this branch is used for the L-side
    // translation row, which is markerless in practice but we strip
    // defensively to avoid rendering a literal "{n}" if anything ever
    // slipped through.
    return (
      <span className={`select-none ${textStyle}`}>
        {stripGenderMarkers(text)}
      </span>
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
        // Strip the gender marker BEFORE splitting punctuation, because the
        // backend strips markers before extracting the word too - keeping
        // both sides in lock-step is what makes the word_idx match.
        const { cleanToken, gender } = splitGenderMarker(token);
        const leading = cleanToken.match(/^\p{P}+/u)?.[0] ?? "";
        const trailing = cleanToken.match(/\p{P}+$/u)?.[0] ?? "";
        const word = cleanToken.slice(
          leading.length,
          cleanToken.length - trailing.length || undefined,
        );
        const isActive =
          isActiveInThisSentence && activePopup?.wordIdx === currentWordIdx;
        const genderClass =
          applyGenderColors && gender ? GENDER_CLASS[gender] : "";

        return (
          <Fragment key={idx}>
            {leading}
            <span
              className={`cursor-pointer hover:bg-highlight-light rounded px-[1px] transition-colors ${genderClass} ${isActive ? "bg-highlight relative" : ""}`}
              onClick={(e) => onWordClick(e, currentWordIdx)}
            >
              {word}
              {isActive && (
                <WordExplanationPopup
                  storyId={storyId}
                  l={l}
                  r={r}
                  lSentenceIdx={lSentence.index}
                  rSentenceIdx={rSentence.index}
                  wordIdx={currentWordIdx}
                />
              )}
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
  applyGenderColors,
}: {
  storyId: string;
  l: string;
  r: string;
  lParagraph: Paragraph;
  rParagraph: Paragraph;
  shouldShowTranslation: boolean;
  showTranslationBySentence: boolean;
  applyGenderColors: boolean;
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
            <Fragment key={index}>
              <span className={index === 0 ? "ml-4" : ""}>
                <SentenceView
                  text={sentence.text}
                  storyId={storyId}
                  l={l}
                  r={r}
                  lSentence={lParagraph.sentences[index]}
                  rSentence={sentence}
                  textStyle="text-base text-main-text"
                  interactive={true}
                  applyGenderColors={applyGenderColors}
                />
              </span>
              {index < rParagraph.sentences.length - 1 && " "}
            </Fragment>
          ))}
        </div>
      )}
      {shouldShowTranslation && !showTranslationBySentence && (
        <div className="mt-3 text-justify">
          {lParagraph.sentences.map((sentence, index) => (
            <Fragment key={index}>
              <span className={index === 0 ? "ml-4" : ""}>
                <SentenceView
                  text={sentence.text}
                  storyId={storyId}
                  l={l}
                  r={r}
                  lSentence={sentence}
                  rSentence={rParagraph.sentences[index]}
                  textStyle="text-base text-secondary-text font-thin"
                  interactive={false}
                  applyGenderColors={false}
                />
              </span>
              {index < lParagraph.sentences.length - 1 && " "}
            </Fragment>
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
                    applyGenderColors={applyGenderColors}
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
                      applyGenderColors={false}
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
  applyGenderColors,
}: {
  storyId: string;
  l: string;
  r: string;
  lChapter: Chapter;
  rChapter: Chapter;
  shouldShowTranslation: boolean;
  showTranslationBySentence: boolean;
  applyGenderColors: boolean;
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
        <h2 className="text-xl font-bold text-center mt-6 text-main-text">
          {rChapter.title}
        </h2>
      )}
      <div className={`flex flex-col gap-${paragraphGap} mt-5`}>
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
            applyGenderColors={applyGenderColors}
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
  colorNounGenders,
}: {
  storyId: string;
  l: string;
  r: string;
  shouldShowTranslation: boolean;
  showTranslationBySentence: boolean;
  // User-facing toggle. The effective decision (`applyGenderColors`) also
  // checks that the learned-language locale actually supports gender markers
  // - we honour the flag even when R doesn't support gender, because flipping
  // it off should still strip any stray markers in older content.
  colorNounGenders: boolean;
}) {
  const query = useStoryQuery(storyId, l, r);

  if (query.isPending) {
    return (
      <div className="w-full p-4 overflow-auto text-secondary-text">{lstr(l).loading_story}</div>
    );
  }

  if (query.isError) {
    return (
      <div className="w-full p-4 overflow-auto font-semibold text-xl text-main-text">
        {query.error instanceof NotFoundError
          ? lstr(l).story_not_found_error
          : lstr(l).loading_story_error}
      </div>
    );
  }

  const rStory = query.data.localizations.get(r);
  if (!rStory) {
    console.error("Story is missing the learned-language localization");
    return (
      <div className="w-full p-4 overflow-auto font-semibold text-xl text-main-text">
        {lstr(l).story_not_found_error}
      </div>
    );
  }

  // The L localization is optional. When absent, we render
  // r-only and disable the translation layer.
  var lStory = query.data.localizations.get(l);
  const hasLStory = lStory !== undefined;
  lStory = lStory ?? rStory;
  const effectiveShowTranslation = shouldShowTranslation && hasLStory;

  if (lStory.chapters.length !== rStory.chapters.length) {
    console.error("Story paragraphs are not aligned");
    return (
      <div className="text-red-800">Story paragraphs are not aligned</div>
    );
  }

  const applyGenderColors = colorNounGenders && supportsGenderColoring(r);

  return (
    <PopupProvider>
      <div>
        <Image storyId={storyId} imageId={rStory.imageId} />
        <h1 className="text-2xl font-bold text-center text-main-text">{rStory.title}</h1>
        {effectiveShowTranslation && (
          <h1 className="text-xl font-medium text-secondary-text text-center mt-1">
            {lStory.title}
          </h1>
        )}
        <div className="mt-6">
          <div className="flex flex-col gap-10 pb-12">
            {rStory.chapters.map((chapter, index) => (
              <ChapterView
                key={index}
                storyId={storyId}
                l={l}
                r={r}
                lChapter={lStory!.chapters[index]}
                rChapter={chapter}
                shouldShowTranslation={effectiveShowTranslation}
                showTranslationBySentence={showTranslationBySentence}
                applyGenderColors={applyGenderColors}
              />
            ))}
          </div>
        </div>
      </div>
    </PopupProvider>
  );
}

export default StoryView;
