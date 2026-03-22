function getFlagEmoji(l: string): string {
  if (l == "en") return "🇺🇸";
  if (l == "de") return "🇩🇪";
  if (l == "ru") return "🇷🇺";
  return l;
}

export function getLanguageName(l: string): string {
  if (l == "en") return "English";
  if (l == "de") return "Deutsch";
  if (l == "ru") return "Русский";
  return l;
}

export default getFlagEmoji;
