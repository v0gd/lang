/** @type {import('tailwindcss').Config} */
module.exports = {
  purge: ["./src/**/*.{js,jsx,ts,tsx,html}"],
  content: [],
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
      },
    },
  },
  plugins: [],
};
