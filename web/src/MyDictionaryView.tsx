import { useState } from "react";
import { SavedWord, useMyDictionaryQuery } from "./queries";
import { lstr } from "./localization";

function PartOfSpeechBadge({ partOfSpeech }: { partOfSpeech: string }) {
  return (
    <span className="text-xs font-medium text-secondary-text bg-cream-dark rounded-full px-2 py-0.5">
      {partOfSpeech}
    </span>
  );
}

function WordCard({ word, l }: { word: SavedWord; l: string }) {
  return (
    <div className="w-full my-1.5 p-4 bg-surface border border-border rounded-xl">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-lg font-semibold text-main-text">
          {word.displayForm}
        </span>
        {word.partOfSpeech !== "interjection" &&
          word.partOfSpeech !== "other" && (
            <PartOfSpeechBadge partOfSpeech={word.partOfSpeech} />
          )}
        {word.briefMeaning ? (
          <span className="text-main-text">— {word.briefMeaning}</span>
        ) : (
          <span className="text-sm italic text-muted-text">
            — {lstr(l).my_dictionary_meaning_pending}
          </span>
        )}
      </div>

      {word.examples.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-text">
            {lstr(l).my_dictionary_examples_heading}
          </div>
          <ul className="mt-1 flex flex-col gap-0.5">
            {word.examples.map((example, idx) => (
              <li key={idx} className="text-sm text-secondary-text">
                {example}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function MyDictionaryView({ l, r }: { l: string; r: string }) {
  const [page, setPage] = useState(0);
  const query = useMyDictionaryQuery(l, r, page);

  return (
    <div className="w-full overflow-auto pb-10">
      <header className="text-left text-2xl font-semibold text-main-text mb-3">
        {lstr(l).my_dictionary_header}
      </header>

      {query.isPending && (
        <div className="text-secondary-text">{lstr(l).my_dictionary_loading}</div>
      )}

      {query.isError && (
        <div className="text-red-600">{lstr(l).my_dictionary_error}</div>
      )}

      {query.isSuccess && query.data.words.length === 0 && page === 0 && (
        <div className="text-secondary-text">{lstr(l).my_dictionary_empty}</div>
      )}

      {query.isSuccess &&
        query.data.words.map((word) => (
          <WordCard key={word.dictionaryEntryId} word={word} l={l} />
        ))}

      {query.isSuccess && (page > 0 || query.data.hasMore) && (
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            disabled={page === 0 || query.isFetching}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-4 py-1.5 rounded-lg text-sm font-medium border border-border bg-surface hover:bg-cream-dark transition-colors disabled:opacity-40"
          >
            {lstr(l).my_dictionary_prev_page}
          </button>
          <span className="text-sm text-secondary-text">
            {lstr(l).my_dictionary_page_label} {page + 1}
          </span>
          <button
            type="button"
            disabled={!query.data.hasMore || query.isFetching}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium border border-border bg-surface hover:bg-cream-dark transition-colors disabled:opacity-40"
          >
            {lstr(l).my_dictionary_next_page}
          </button>
        </div>
      )}
    </div>
  );
}

export default MyDictionaryView;
