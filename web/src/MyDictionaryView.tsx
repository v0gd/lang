import { useEffect, useState } from "react";
import {
  SavedWord,
  useMyDictionaryQuery,
  useRemoveWordMutation,
} from "./queries";
import { lstr } from "./localization";
import { Gender, GENDER_CLASS, supportsGenderColoring } from "./gender";

// Dictionary entries store the gender spelled out ("masculine"); the reading
// view's coloring works on single-letter markers. Map between the two so a
// saved noun is tinted exactly like it is in the stories.
const GENDER_BY_NAME: Record<string, Gender> = {
  masculine: "m",
  feminine: "f",
  neuter: "n",
};

function PartOfSpeechBadge({ partOfSpeech }: { partOfSpeech: string }) {
  return (
    <span className="text-xs font-medium text-secondary-text bg-cream-dark rounded-full px-2 py-0.5">
      {partOfSpeech}
    </span>
  );
}

// DeleteWordControl is a two-step delete: the first click reveals a
// confirm/cancel pair so a stray tap can't remove a word. Removal invalidates
// the My Dictionary cache, so the card disappears on success.
function DeleteWordControl({ word, l }: { word: SavedWord; l: string }) {
  const [confirming, setConfirming] = useState(false);
  const removeMutation = useRemoveWordMutation();

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        {removeMutation.isError && (
          <span className="text-sm text-red-600">
            {lstr(l).my_dictionary_delete_error}
          </span>
        )}
        <button
          type="button"
          disabled={removeMutation.isPending}
          onClick={() =>
            removeMutation.mutate({ dictionaryEntryId: word.dictionaryEntryId })
          }
          className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
        >
          {removeMutation.isPending
            ? lstr(l).my_dictionary_deleting
            : lstr(l).my_dictionary_delete_confirm}
        </button>
        <button
          type="button"
          disabled={removeMutation.isPending}
          onClick={() => setConfirming(false)}
          className="text-sm font-medium text-secondary-text hover:text-main-text transition-colors disabled:opacity-50"
        >
          {lstr(l).my_dictionary_delete_cancel}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-sm font-medium text-secondary-text hover:text-red-600 transition-colors"
    >
      {lstr(l).my_dictionary_delete}
    </button>
  );
}

function WordCard({ word, l, r }: { word: SavedWord; l: string; r: string }) {
  const gender = GENDER_BY_NAME[word.gender];
  const genderClass =
    gender && supportsGenderColoring(r) ? GENDER_CLASS[gender] : "text-main-text";
  return (
    <div className="w-full my-1.5 p-4 bg-surface border border-border rounded-xl">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`text-lg font-semibold ${genderClass}`}>
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
        <span className="ml-auto">
          <DeleteWordControl word={word} l={l} />
        </span>
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

  // A page number from one language pair is meaningless in another; start
  // from the first page whenever the pair changes.
  useEffect(() => {
    setPage(0);
  }, [l, r]);

  // Deleting the last word of a trailing page leaves it empty; step back so
  // the user isn't stranded on a blank page.
  const isOnEmptyTrailingPage =
    query.isSuccess && !query.isFetching && query.data.words.length === 0 && page > 0;
  useEffect(() => {
    if (isOnEmptyTrailingPage) {
      setPage((p) => Math.max(0, p - 1));
    }
  }, [isOnEmptyTrailingPage]);

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
          <WordCard key={word.dictionaryEntryId} word={word} l={l} r={r} />
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
