/** @type {import('tailwindcss').Config} */
module.exports = {
  purge: ["./src/**/*.{js,jsx,ts,tsx,html}"],
  content: [],
  theme: {
    extend: {
      fontFamily: {
        literata: ["Literata", "serif"],
      },
      colors: {
        cream: "#faf7f0",
        "cream-dark": "#f0ebe0",
        surface: "#ffffff",
        primary: "#2d6a5a",
        "primary-hover": "#245849",
        "primary-light": "#e8f3f0",
        "main-text": "#1a1a1a",
        "secondary-text": "#7a7368",
        "muted-text": "#a39e94",
        border: "#e5e0d5",
        highlight: "#d4a853",
        "highlight-light": "#faf0d8",
      },
    },
  },
  plugins: [],
};
