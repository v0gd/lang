/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx,html}", "./public/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        literata: ["Literata", "serif"],
      },
      colors: {
        cream: "var(--color-cream)",
        "cream-dark": "var(--color-cream-dark)",
        surface: "var(--color-surface)",
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        "primary-light": "var(--color-primary-light)",
        "main-text": "var(--color-main-text)",
        "secondary-text": "var(--color-secondary-text)",
        "muted-text": "var(--color-muted-text)",
        border: "var(--color-border)",
        highlight: "var(--color-highlight)",
        "highlight-light": "var(--color-highlight-light)",
        "level-a1": "var(--color-level-a1)",
        "level-a1-bg": "var(--color-level-a1-bg)",
        "level-a2": "var(--color-level-a2)",
        "level-a2-bg": "var(--color-level-a2-bg)",
        "level-b1": "var(--color-level-b1)",
        "level-b1-bg": "var(--color-level-b1-bg)",
        "level-b2": "var(--color-level-b2)",
        "level-b2-bg": "var(--color-level-b2-bg)",
        "level-c1": "var(--color-level-c1)",
        "level-c1-bg": "var(--color-level-c1-bg)",
      },
    },
  },
  plugins: [],
};
