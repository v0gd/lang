export enum Theme {
  Dark = "Dark",
  Light = "Light",
}

export enum ShowTranslationMode {
  ByParagraph = "ByParagraph",
  BySentence = "BySentence",
}

export interface Settings {
  lLocale: string;
  rLocale: string;
  showTranslation: boolean;
  showTranslationMode: ShowTranslationMode;
  theme: Theme;
  // When the learned language has grammatical gender (de, ru), tint every
  // annotated noun in the story by its gender. Stored even when the current
  // R locale doesn't support genders so the user's preference survives a
  // language switch.
  colorNounGenders: boolean;
}
