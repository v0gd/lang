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

export function useGeneratedStoryListQuery(
  authorId: string,
  l: string,
  r: string,
) {
  let url = new URL(`${API_URL}/generated-list`);
  url.searchParams.append("author_id", authorId);
  url.searchParams.append("l", l);
  url.searchParams.append("r", r);

  return useQuery<StoryDescriptor[]>({
    queryKey: ["generated-story-list", authorId],
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
    }: {
      l: string;
      r: string;
      level: string;
      moods: string[];
      topics: string[];
    }) => {
      const moodStr = moods.join(",");
      const topicStr = topics.join(",");

      let url = new URL(`${API_URL}/generate`);
      url.searchParams.append("l", l);
      url.searchParams.append("r", r);
      url.searchParams.append("level", level);
      url.searchParams.append("moods", moodStr);
      url.searchParams.append("topics", topicStr);

      const params = fetchParamsWithAuth("POST");

      return params.then((params) => {
        return fetch(url, params).then((res) => {
          queryClient.invalidateQueries({ queryKey: ["generated-story-list"] });
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
            throw new Error("Unexpected result for story generate mutation");
          }
        });
      });
    },
    retry: false,
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
