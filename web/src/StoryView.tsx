import { Fragment, useState } from "react";
import { Chapter, Paragraph, Sentence } from "./story";
import { apiUrl, useStoryQuery, NotFoundError } from "./queries";
import { lstr } from "./localization";
import { ExplanationModal } from "./Explanation";

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
  style,
  onHover,
}: {
  text: string;
  storyId: string;
  l: string;
  r: string;
  lSentence: Sentence;
  rSentence: Sentence;
  style: string;
  onHover: (hover: boolean) => void;
}) {
  const [showExplanation, setShowExplanation] = useState(false);

  const onClick = () => {
    setShowExplanation(true);
  };

  return (
    <>
      <span
        className={`select-none hover:bg-emerald-300 rounded px-[2px] py-[1px] transition-colors ${style}`}
        onClick={() => onClick()}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
      >
        {text}
      </span>
      {showExplanation && (
        <ExplanationModal
          storyId={storyId}
          l={l}
          r={r}
          lSentence={lSentence}
          rSentence={rSentence}
          closeModal={() => setShowExplanation(false)}
        />
      )}
    </>
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
  const [hoveredSentence, setHoveredSentence] = useState<number | null>(null);

  if (lParagraph.sentences.length !== rParagraph.sentences.length) {
    console.error("Paragraph sentences are not aligned");
    return (
      <div className="text-red-800">Paragraph sentences are not aligned</div>
    );
  }

  const onHover = (sentenceIdx: number, hover: boolean) => {
    if (hover) {
      setHoveredSentence(sentenceIdx);
    } else {
      setHoveredSentence(null);
    }
  };

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
                style={
                  hoveredSentence === index
                    ? "text-base text-main-text bg-emerald-300"
                    : "text-base text-main-text"
                }
                onHover={(hover) => onHover(index, hover)}
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
                style={
                  hoveredSentence === index
                    ? "text-base text-secondary-text font-thin bg-emerald-300"
                    : "text-base text-secondary-text font-thin"
                }
                onHover={(hover) => onHover(index, hover)}
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
                <span key={index}>
                  <SentenceView
                    text={sentence.text}
                    storyId={storyId}
                    l={l}
                    r={r}
                    lSentence={lParagraph.sentences[index]}
                    rSentence={sentence}
                    style={
                      hoveredSentence === index
                        ? "text-base text-main-text bg-emerald-300"
                        : "text-base text-main-text"
                    }
                    onHover={(hover) => onHover(index, hover)}
                  />
                </span>
              </div>
              {index < lParagraph.sentences.length && (
                <div className="text-justify">
                  <span key={index}>
                    <SentenceView
                      text={lParagraph.sentences[index].text}
                      storyId={storyId}
                      l={l}
                      r={r}
                      lSentence={lParagraph.sentences[index]}
                      rSentence={rParagraph.sentences[index]}
                      style={
                        hoveredSentence === index
                          ? "text-base text-secondary-text font-thin bg-emerald-300"
                          : "text-base text-secondary-text font-thin"
                      }
                      onHover={(hover) => onHover(index, hover)}
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
        <h2 className="text-xl font-bold text-center mt-4">{rChapter.title}</h2>
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
    // If the story is generated, override 'l' and 'r' with whatever we have
    // in the story localizations.
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
    return <div className="text-red-800">Story paragraphs are not aligned</div>;
  }

  return (
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
  );
}

export default StoryView;
