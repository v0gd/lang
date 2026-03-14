function getFlagEmoji(l: string): string {
  if (l == "en") return "🇺🇸";
  if (l == "de") return "🇩🇪";
  if (l == "ru") return "🇷🇺";
  return l;
}

export default getFlagEmoji;
