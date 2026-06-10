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
