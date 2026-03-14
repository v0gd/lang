export const API_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === "development"
    ? "https://localhost:5001"
    : "https://lang-api-ax25l.ondigitalocean.app/api");

export const RELOAD_STORY = process.env.REACT_APP_API_URL === "true" || false;
