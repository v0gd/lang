export interface Sentence {
  text: string;
  index: number;
  hasAudio: boolean;
}

export interface Paragraph {
  sentences: Sentence[];
  imageId?: string;
}

export interface Chapter {
  title?: string;
  paragraphs: Paragraph[];
}

export interface Story {
  title: string;
  chapters: Chapter[];
  imageId?: string;
}

export interface StoryMultilingual {
  id: string;
  localizations: Map<string, Story>;
  // Per-user favorite mark; false for anonymous requests.
  favorite: boolean;
}

export interface StoryDescriptor {
  id: string;
  level: string;
  locales: string[];
  titles: string[];
  // Per-user favorite mark; false for anonymous requests. The backend sorts
  // favorites to the top of both story lists.
  favorite: boolean;
}

// Story-list rows show at most this many characters of a title; anything
// longer is cut and terminated with "...".
const maxStoryListTitleLength = 50;

export function truncateStoryListTitle(title: string): string {
  // Array.from splits by code points so a cut never lands inside a surrogate
  // pair (e.g. an emoji in a scanned title).
  const characters = Array.from(title);
  if (characters.length <= maxStoryListTitleLength) {
    return title;
  }
  return characters.slice(0, maxStoryListTitleLength).join("") + "...";
}
