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
        "main-white": "#faf7f0",
        "main-text": "#000000",
        "secondary-text": "#6b7280",
      },
    },
  },
  plugins: [],
};
