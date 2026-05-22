import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_URL, RELOAD_STORY } from "./config";
import { StoryDescriptor, StoryMultilingual } from "./story";
import { getAuthToken, isLoggedIn } from "./firebase";

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
  return isLoggedIn() ? fetchParamsWithAuth(method) : { method: method };
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
    queryKey: ["generated-story-list"],
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

// Thrown by useUploadMutation when the prompt-injection gate flags the input.
export class PromptInjectionError {}

// Thrown by useUploadMutation when the content-policy gate flags the input.
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
          if (body && body.error === "no_target_language") {
            throw new NoTargetLanguageError();
          }
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
// return a 422 with one of three specific error codes; we surface each as a
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
          if (code === "prompt_injection") throw new PromptInjectionError();
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

export function useExplainQuery(
  storyId: string,
  l: string,
  r: string,
  lSentenceIdx: number,
  rSentenceIdx: number,
) {
  let url = new URL(`${API_URL}/explain`);
  url.searchParams.append("l_sentence_idx", lSentenceIdx.toString());
  url.searchParams.append("r_sentence_idx", rSentenceIdx.toString());
  url.searchParams.append("story_id", storyId);
  url.searchParams.append("l", l);
  url.searchParams.append("r", r);

  return useQuery<string>({
    queryKey: ["explain", storyId, l, r, lSentenceIdx, rSentenceIdx],
    queryFn: async () =>
      fetchParamsWithOptionalAuth("GET").then((params) =>
        fetch(url, params).then((res) => {
          if (res.ok) {
            return res.json().then((obj) => {
              return obj.content;
            });
          } else {
            console.error("Unexpected result for", url);
            console.error(res);
            throw new Error("Unexpected result for explain query");
          }
        }),
      ),
    retry: 2,
  });
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

  return useQuery<string>({
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
              return obj.content;
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
