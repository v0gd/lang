import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { API_URL, RELOAD_STORY } from "./config";
import { StoryDescriptor, StoryMultilingual } from "./story";
import { getAuthToken, isLoggedInSettled } from "./firebase";

async function fetchParamsWithAuth(method: string) {
  return getAuthToken().then((token) => {
    return {
      method: method,
      headers: new Headers({
        Authorization: `Bearer ${token}`,
      }),
    };
  });
}

async function fetchParamsWithOptionalAuth(method: string) {
  // Await the initial Firebase auth hydration: a synchronous check here could
  // be stale on page load and produce an unauthenticated request for a
  // resource that requires the token (e.g. a generated story).
  return (await isLoggedInSettled())
    ? fetchParamsWithAuth(method)
    : { method: method };
}

export function apiUrl(path: string) {
  if (!path.startsWith("/") || path.includes("..")) {
    throw new Error("Invalid path");
  }
  return new URL(`${API_URL}${path}`);
}

export function useStoryListQuery(l: string, r: string) {
  let url = new URL(`${API_URL}/story-list`);
  url.searchParams.append("l", l);
  url.searchParams.append("r", r);

  return useQuery<StoryDescriptor[]>({
    queryKey: ["story-list", l, r],
    queryFn: async () =>
      fetchParamsWithOptionalAuth("GET").then((params) =>
        fetch(url, params).then((res) => {
          if (res.status === 200) {
            return res.json();
          } else {
            console.error("Unexpected result for", url);
            console.error(res);
            throw new Error("Unexpected result for story-list query");
          }
        }),
      ),
  });
}

export function useGeneratedStoryListQuery(l: string, r: string) {
  let url = new URL(`${API_URL}/generated-list`);
  url.searchParams.append("l", l);
  url.searchParams.append("r", r);

  return useQuery<StoryDescriptor[]>({
    // l and r must be part of the key: the request URL depends on them, and a
    // locale-agnostic key would serve one language pair's cached list to
    // another after a settings change.
    queryKey: ["generated-story-list", l, r],
    queryFn: async () =>
      fetchParamsWithAuth("GET").then((params) =>
        fetch(url, params).then((res) => {
          if (res.status === 200) {
            return res.json();
          } else {
            console.error("Unexpected result for", url);
            console.error(res);
            throw new Error("Unexpected result for generated-story-list query");
          }
        }),
      ),
  });
}

export class NotFoundError {}

// Thrown by useScanMutation and useUploadMutation when the backend determines
// that the user input doesn't contain a meaningful amount of target-language
// text. The UI uses this to show a specific message instead of a generic one.
export class NoTargetLanguageError {}

// Thrown by the three long-running mutations (generate/scan/upload) when the
// caller aborts the AbortController. We surface this as a typed error so the
// view can silently reset the mutation state instead of showing a generic
// "something went wrong" message. NOTE: aborting only cancels the HTTP
// request on the client side; the backend may continue processing for a few
// seconds (current LLM calls are not yet plumbed with request context).
export class CancelledError {}

// isAbortError detects the DOMException that fetch() throws when its signal
// is aborted. We accept both the DOMException form (modern browsers) and the
// legacy `error.name === "AbortError"` form for safety.
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (
    err &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name?: unknown }).name === "AbortError"
  ) {
    return true;
  }
  return false;
}

// Thrown by useScanMutation and useUploadMutation when the backend safety
// gate rejects the input (pasted text, or text extracted from scanned
// images). The backend deliberately reports prompt-injection and
// content-policy rejections under this single generic code so an attacker
// gets no confirmation that an injection attempt was specifically detected.
export class DisallowedContentError {}

export function useStoryQuery(storyId: string, l: string, r: string) {
  let url = new URL(`${API_URL}/story`);
  url.searchParams.append("id", storyId);
  url.searchParams.append("l", l);
  url.searchParams.append("r", r);

  const refetchInterval = RELOAD_STORY ? 5000 : false;

  return useQuery<StoryMultilingual>({
    queryKey: ["story", storyId, l, r],
    queryFn: async () =>
      fetchParamsWithOptionalAuth("GET").then((params) =>
        fetch(url, params).then((res) => {
          if (res.ok) {
            return res.json().then((obj) => {
              return {
                id: obj.id,
                localizations: new Map(Object.entries(obj.localizations)),
                favorite: obj.favorite ?? false,
              };
            });
          } else if (res.status === 404) {
            throw new NotFoundError();
          } else {
            console.error("Unexpected result for", url);
            console.error(res);
            throw new Error("Unexpected result for story query");
          }
        }),
      ),
    refetchInterval: refetchInterval,
    retry: 2,
    gcTime: 1000 * 60 * 240, // 2 hours
    staleTime: 1000 * 60 * 240, // 2 hours
  });
}

export function useGenerateStoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      l,
      r,
      level,
      moods,
      topics,
      signal,
    }: {
      // l is the optional mother-tongue locale; omit it (empty string) to
      // generate a story only in the learned language.
      l: string;
      r: string;
      level: string;
      moods: string[];
      topics: string[];
      // Optional AbortSignal so the caller can cancel the in-flight request.
      signal?: AbortSignal;
    }) => {
      const moodStr = moods.join(",");
      const topicStr = topics.join(",");

      let url = new URL(`${API_URL}/generate`);
      if (l) {
        url.searchParams.append("l", l);
      }
      url.searchParams.append("r", r);
      url.searchParams.append("level", level);
      url.searchParams.append("moods", moodStr);
      url.searchParams.append("topics", topicStr);

      const params = await fetchParamsWithAuth("POST");
      try {
        const res = await fetch(url, { ...params, signal });
        queryClient.invalidateQueries({ queryKey: ["generated-story-list"] });
        if (res.ok) {
          const obj = await res.json();
          return {
            id: obj.id,
            localizations: new Map(Object.entries(obj.localizations)),
          };
        } else if (res.status === 404) {
          throw new NotFoundError();
        } else {
          console.error("Unexpected result for", url, res);
          throw new Error("Unexpected result for story generate mutation");
        }
      } catch (err) {
        if (isAbortError(err)) throw new CancelledError();
        throw err;
      }
    },
    retry: false,
  });
}

export function useScanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      images,
      r,
      signal,
    }: {
      images: File[];
      r: string;
      signal?: AbortSignal;
    }) => {
      if (images.length === 0) {
        throw new Error("No images selected for scan");
      }

      const formData = new FormData();
      for (const img of images) {
        formData.append("images", img, img.name);
      }

      const url = apiUrl("/scan");
      url.searchParams.append("r", r);
      const token = await getAuthToken();
      try {
        // Note: do NOT set Content-Type manually here - the browser must add
        // the multipart boundary to the header.
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
          signal,
        });
        queryClient.invalidateQueries({ queryKey: ["generated-story-list"] });

        if (res.status === 422) {
          const body = await res.json().catch(() => null);
          const code = body && typeof body.error === "string" ? body.error : "";
          if (code === "disallowed_content")
            throw new DisallowedContentError();
          if (code === "no_target_language") throw new NoTargetLanguageError();
          throw new Error("Unexpected 422 result for scan");
        }
        if (!res.ok) {
          console.error("Unexpected result for", url, res);
          throw new Error("Unexpected result for scan mutation");
        }
        const obj = await res.json();
        return {
          id: obj.id as string,
          localizations: new Map(Object.entries(obj.localizations)),
        };
      } catch (err) {
        if (isAbortError(err)) throw new CancelledError();
        throw err;
      }
    },
    retry: false,
  });
}

// useUploadMutation drives the user-pasted-text ingest flow. The request is a
// small JSON body so we send it directly (no multipart). The backend may
// return a 422 with one of two specific error codes; we surface each as a
// dedicated typed error so the UI can localize messages.
export function useUploadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      text,
      r,
      signal,
    }: {
      text: string;
      r: string;
      signal?: AbortSignal;
    }) => {
      const url = apiUrl("/upload");
      url.searchParams.append("r", r);
      const token = await getAuthToken();
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
          signal,
        });
        queryClient.invalidateQueries({ queryKey: ["generated-story-list"] });

        if (res.status === 422) {
          const body = await res.json().catch(() => null);
          const code = body && typeof body.error === "string" ? body.error : "";
          if (code === "disallowed_content")
            throw new DisallowedContentError();
          if (code === "no_target_language") throw new NoTargetLanguageError();
          throw new Error("Unexpected 422 result for upload");
        }
        if (!res.ok) {
          console.error("Unexpected result for", url, res);
          throw new Error("Unexpected result for upload mutation");
        }
        const obj = await res.json();
        return {
          id: obj.id as string,
          localizations: new Map(Object.entries(obj.localizations)),
        };
      } catch (err) {
        if (isAbortError(err)) throw new CancelledError();
        throw err;
      }
    },
    retry: false,
  });
}

// useSetFavoriteStoryMutation toggles the per-user favorite mark on a story
// (generated or curated). Both story lists are invalidated so the refetched,
// server-sorted lists move the story to/from the favorites block at the top.
// Cached story objects (the reading view) are patched in place instead of
// invalidated, because the story content is deliberately cached for hours and
// only the favorite flag changed.
export function useSetFavoriteStoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storyId,
      favorite,
    }: {
      storyId: string;
      favorite: boolean;
    }) => {
      const url = apiUrl(favorite ? "/favorite-story" : "/unfavorite-story");
      url.searchParams.append("story_id", storyId);

      const params = await fetchParamsWithAuth(favorite ? "POST" : "DELETE");
      const res = await fetch(url, params);
      if (!res.ok) {
        console.error("Unexpected result for", url, res);
        throw new Error("Unexpected result for favorite-story mutation");
      }
    },
    onSuccess: (_data, { storyId, favorite }) => {
      queryClient.invalidateQueries({ queryKey: ["story-list"] });
      queryClient.invalidateQueries({ queryKey: ["generated-story-list"] });
      queryClient.setQueriesData<StoryMultilingual>(
        { queryKey: ["story", storyId] },
        (old) => (old ? { ...old, favorite } : old),
      );
    },
    retry: false,
  });
}

export function useDeleteStoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storyId: string) => {
      let url = apiUrl("/delete-generated");
      url.searchParams.append("story_id", storyId);

      const params = await fetchParamsWithAuth("DELETE");
      const res = await fetch(url, params);
      if (!res.ok) {
        throw new Error("Failed to delete story");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-story-list"] });
    },
  });
}

// markWordSavedInCache flips alreadySaved on every cached word-explanation that
// resolved to this dictionary entry. The explain query carries the saved state,
// so without this a save/remove would be forgotten as soon as the popup is
// reopened from cache. Keying off the entry id (not the click position) also
// keeps other sentences' explanations of the same word in sync.
function markWordSavedInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  dictionaryEntryId: number,
  saved: boolean,
) {
  queryClient.setQueriesData<WordExplanation>(
    { queryKey: ["explain-word"] },
    (old) => {
      if (!old || old.dictionaryEntryId !== dictionaryEntryId) return old;
      return { ...old, alreadySaved: saved };
    },
  );
}

// SAVE_WORD_LIMIT_ERROR is the Error message thrown by useSaveWordMutation when
// the backend rejects a save because the user hit their saved-word cap (HTTP
// 409). The UI checks for it to show a specific "limit reached" message.
export const SAVE_WORD_LIMIT_ERROR = "save-word-limit-reached";

// useSaveWordMutation adds an already-ingested dictionary sense to the user's
// saved-word list. The dictionary entry was created when the word's explanation
// was generated; here we just send its id plus the spoken language l (used to
// generate the localized description in the background). The backend returns
// immediately.
export function useSaveWordMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    {
      dictionaryEntryId: number;
      l: string;
    }
  >({
    mutationFn: async ({ dictionaryEntryId, l }) => {
      const url = apiUrl("/save-word");
      url.searchParams.append("dictionary_entry_id", dictionaryEntryId.toString());
      url.searchParams.append("l", l);

      const params = await fetchParamsWithAuth("POST");
      const res = await fetch(url, params);
      if (!res.ok) {
        // 409 means the per-user saved-word cap is reached; surface it as a
        // distinct, actionable message instead of the generic save error.
        if (res.status === 409) {
          throw new Error(SAVE_WORD_LIMIT_ERROR);
        }
        console.error("Unexpected result for", url, res);
        throw new Error("Unexpected result for save-word mutation");
      }
    },
    onSuccess: (_data, { dictionaryEntryId }) =>
      markWordSavedInCache(queryClient, dictionaryEntryId, true),
    retry: false,
  });
}

// useRemoveWordMutation removes a dictionary sense from the user's saved-word
// list. Only the user reference is dropped; the global dictionary entry stays.
export function useRemoveWordMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    {
      dictionaryEntryId: number;
    }
  >({
    mutationFn: async ({ dictionaryEntryId }) => {
      const url = apiUrl("/remove-word");
      url.searchParams.append("dictionary_entry_id", dictionaryEntryId.toString());

      const params = await fetchParamsWithAuth("DELETE");
      const res = await fetch(url, params);
      if (!res.ok) {
        console.error("Unexpected result for", url, res);
        throw new Error("Unexpected result for remove-word mutation");
      }
    },
    onSuccess: (_data, { dictionaryEntryId }) => {
      markWordSavedInCache(queryClient, dictionaryEntryId, false);
      // Drop the word from any cached My Dictionary page so the list reflects
      // the removal (e.g. when deleting from the dictionary page itself).
      queryClient.invalidateQueries({ queryKey: ["my-dictionary"] });
    },
    retry: false,
  });
}

// fetchSentenceAudioUrl fetches the TTS audio of one sentence and returns an
// object URL for playback. A plain <audio src> can't be used because
// generated stories require the Authorization header, which media elements
// cannot send - so we fetch the bytes ourselves. The caller owns the returned
// URL and must revoke it with URL.revokeObjectURL when done.
export async function fetchSentenceAudioUrl(
  storyId: string,
  locale: string,
  sentenceIdx: number,
): Promise<string> {
  const url = apiUrl("/audio");
  url.searchParams.append("story_id", storyId);
  url.searchParams.append("locale", locale);
  url.searchParams.append("sentence_idx", sentenceIdx.toString());

  const params = await fetchParamsWithOptionalAuth("GET");
  const res = await fetch(url, params);
  if (!res.ok) {
    console.error("Unexpected result for", url);
    console.error(res);
    throw new Error("Unexpected result for audio fetch");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// useProgressLinesQuery fetches the playful status lines rotated in the
// story-generation progress overlay. Unauthenticated; `enabled` is meant to
// be wired to the generate mutation's isPending so the request only fires
// when the overlay is actually shown. The lines are static server content,
// so a fetched set is kept for the whole session (staleTime: Infinity).
export function useProgressLinesQuery(
  l: string,
  moods: string[],
  enabled: boolean,
) {
  const url = apiUrl("/progress-lines");
  url.searchParams.append("l", l);
  url.searchParams.append("moods", moods.join(","));

  return useQuery<string[]>({
    queryKey: ["progress-lines", l, moods],
    queryFn: async () =>
      fetch(url).then((res) => {
        if (res.ok) {
          return res.json().then((obj) => obj.lines ?? []);
        } else {
          console.error("Unexpected result for", url);
          console.error(res);
          throw new Error("Unexpected result for progress-lines query");
        }
      }),
    enabled,
    staleTime: Infinity,
    retry: 1,
  });
}

export interface WordExplanation {
  content: string;
  // The global dictionary sense this word was resolved to, or null if the word
  // wasn't ingested. The Save button is only shown when this is set.
  dictionaryEntryId: number | null;
  // Whether the logged-in user already has this sense in their saved-word list.
  // Always false for anonymous users; used to render the Save button as
  // already-saved.
  alreadySaved: boolean;
}

export function useWordExplainQuery(
  storyId: string,
  l: string,
  r: string,
  lSentenceIdx: number,
  rSentenceIdx: number,
  wordIdx: number,
) {
  let url = new URL(`${API_URL}/explain`);
  url.searchParams.append("story_id", storyId);
  url.searchParams.append("l", l);
  url.searchParams.append("r", r);
  url.searchParams.append("l_sentence_idx", lSentenceIdx.toString());
  url.searchParams.append("r_sentence_idx", rSentenceIdx.toString());
  url.searchParams.append("word_idx", wordIdx.toString());

  return useQuery<WordExplanation>({
    queryKey: [
      "explain-word",
      storyId,
      l,
      r,
      lSentenceIdx,
      rSentenceIdx,
      wordIdx,
    ],
    queryFn: async () =>
      fetchParamsWithOptionalAuth("GET").then((params) =>
        fetch(url, params).then((res) => {
          if (res.ok) {
            return res.json().then((obj) => {
              return {
                content: obj.content,
                dictionaryEntryId: obj.dictionary_entry_id ?? null,
                alreadySaved: obj.already_saved ?? false,
              };
            });
          } else {
            console.error("Unexpected result for", url);
            console.error(res);
            throw new Error("Unexpected result for word explain query");
          }
        }),
      ),
    retry: 2,
  });
}

// SavedWord is one row of the user's "My Dictionary" page. briefMeaning is an
// empty string until the background localization job has produced the
// description in the user's spoken language.
export interface SavedWord {
  dictionaryEntryId: number;
  displayForm: string;
  partOfSpeech: string;
  gender: string;
  examples: string[];
  briefMeaning: string;
}

export interface MyDictionaryPage {
  words: SavedWord[];
  page: number;
  hasMore: boolean;
}

export const MY_DICTIONARY_PAGE_SIZE = 100;

// useMyDictionaryQuery fetches one page (MY_DICTIONARY_PAGE_SIZE words) of the
// user's saved words in learned language r, localized to spoken language l.
// page is 0-based. Previous page data is kept while the next page loads to
// avoid a flash of empty content during pagination.
export function useMyDictionaryQuery(l: string, r: string, page: number) {
  const url = apiUrl("/my-dictionary");
  url.searchParams.append("l", l);
  url.searchParams.append("r", r);
  url.searchParams.append("page", page.toString());

  return useQuery<MyDictionaryPage>({
    queryKey: ["my-dictionary", l, r, page],
    queryFn: async () =>
      fetchParamsWithAuth("GET").then((params) =>
        fetch(url, params).then((res) => {
          if (res.ok) {
            return res.json().then((obj) => ({
              words: (obj.words ?? []).map((w: Record<string, unknown>) => ({
                dictionaryEntryId: w.dictionary_entry_id as number,
                displayForm: w.display_form as string,
                partOfSpeech: w.part_of_speech as string,
                gender: w.gender as string,
                examples: (w.examples as string[]) ?? [],
                briefMeaning: (w.brief_meaning as string) ?? "",
              })),
              page: obj.page ?? page,
              hasMore: obj.has_more ?? false,
            }));
          } else {
            console.error("Unexpected result for", url);
            console.error(res);
            throw new Error("Unexpected result for my-dictionary query");
          }
        }),
      ),
    placeholderData: keepPreviousData,
    retry: 2,
  });
}
