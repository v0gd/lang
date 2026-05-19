// Frontend mirror of `api/src/gender`. The backend annotates German and
// Russian story text with `{m}`, `{f}`, `{n}` markers attached directly to
// each noun (no surrounding whitespace). The markers are stored verbatim in
// the response payload; this module is the single place that defines:
//
// - the regex used to find / strip them,
// - the Tailwind colour classes used to tint each gender, and
// - the small set of locales that support the feature plus a representative
//   example noun for each gender (used by the SettingsMenu legend).
//
// Keeping these in one place ensures the settings legend can never drift
// from what the story renderer actually draws.

export type Gender = "m" | "f" | "n";

// Matches one gender marker. The `g` flag lets `replaceAll` strip every
// occurrence. Compile once at module load.
export const GENDER_MARKER_REGEX = /\{([mfn])\}/g;

export function stripGenderMarkers(text: string): string {
  return text.replace(GENDER_MARKER_REGEX, "");
}

// Tailwind colour classes per gender. Hue choices: blueish (sky) for
// masculine, reddish (rose) for feminine, grey (slate) for neuter. Each
// class pair has a darker shade for light mode and a lighter shade for dark
// mode so contrast holds in both themes.
export const GENDER_CLASS: Record<Gender, string> = {
  m: "text-sky-700 dark:text-sky-300",
  f: "text-rose-700 dark:text-rose-300",
  n: "text-slate-500 dark:text-slate-400",
};

// Locales whose stories are annotated with gender markers. Mirrors
// `gender.Supports` on the backend; kept as a tiny static set on purpose.
const SUPPORTED_LOCALES = new Set<string>(["de", "ru"]);

export function supportsGenderColoring(locale: string): boolean {
  return SUPPORTED_LOCALES.has(locale);
}

// Representative nouns per locale, used by the settings legend so the user
// can see the actual colours next to a familiar word. The "n" slot for
// Russian uses a noun whose gender is unambiguous to a learner.
export const GENDER_EXAMPLES: Record<string, Record<Gender, string>> = {
  de: { m: "der Tag", f: "die Frau", n: "das Haus" },
  ru: { m: "стол", f: "книга", n: "окно" },
};
