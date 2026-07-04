// Colors for CEFR level badges, ramping from green (A1, easiest) to red
// (C1, hardest). The underlying colors live in index.css as --color-level-*
// variables (with separate light and dark values) exposed through
// tailwind.config.js; this module owns the level-string -> class mapping.
//
// The class strings must stay full literals: Tailwind's scanner extracts
// class names statically from source and would miss interpolated ones.
const levelBadgeClassesByStop: Record<string, string> = {
  A1: "text-level-a1 bg-level-a1-bg",
  A2: "text-level-a2 bg-level-a2-bg",
  B1: "text-level-b1 bg-level-b1-bg",
  B2: "text-level-b2 bg-level-b2-bg",
  C1: "text-level-c1 bg-level-c1-bg",
  C2: "text-level-c1 bg-level-c1-bg",
};

// Returns badge text/background classes for a CEFR level string as produced
// by the API: either a single level ("B1") or a range ("B1-B2"). Ranges are
// colored by their upper bound - a B2-C1 story reads closer to C1 difficulty.
export function levelBadgeClasses(level: string): string {
  const parts = level.split("-");
  const upperBound = parts[parts.length - 1].trim().toUpperCase();
  const classes = levelBadgeClassesByStop[upperBound];
  if (classes === undefined) {
    console.error("Unknown CEFR level for badge coloring:", level);
    return levelBadgeClassesByStop["B1"];
  }
  return classes;
}
