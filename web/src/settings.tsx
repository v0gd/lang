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
}
