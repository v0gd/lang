import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";

const firebaseConfig =
  process.env.NODE_ENV === "production"
    ? {
        apiKey: "AIzaSyDZo1WtxCrAC7D8Kfb5TRCmvRx0BoBUFUE",
        // authDomain: "lang-2dd5b.firebaseapp.com",
        authDomain: "polypup.org",
        projectId: "lang-2dd5b",
        storageBucket: "lang-2dd5b.firebasestorage.app",
        messagingSenderId: "794096243134",
        appId: "1:794096243134:web:9b62eeb5e2ec9eae4129ef",
      }
    : {
        apiKey: "AIzaSyBqHJnZzKGY70a8phfIGs0s0EC_1CSvjr0",
        authDomain: "lang-dev-70b39.firebaseapp.com",
        // authDomain: "localhost:5001",
        projectId: "lang-dev-70b39",
        storageBucket: "lang-dev-70b39.firebasestorage.app",
        messagingSenderId: "939289662679",
        appId: "1:939289662679:web:c4b8961e04ed6818780c92",
      };

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

export class UnauthorizedError {}

export function isLoggedIn() {
  return !!auth.currentUser;
}

// isLoggedInSettled waits for Firebase to finish loading the persisted auth
// state before answering. Use this on data paths (request building) where the
// synchronous isLoggedIn() could be stale during the initial page load and
// cause an authenticated request to go out without a token.
export async function isLoggedInSettled(): Promise<boolean> {
  await auth.authStateReady();
  return !!auth.currentUser;
}

// WAS_LOGGED_IN_HINT_KEY persists the last known auth state across page
// loads. Firebase restores the session asynchronously, so on a cold load
// auth.currentUser is null for a few hundred ms even for a logged-in user;
// the hint lets the UI guess the right state immediately instead of flashing
// the logged-out variant first. The module-level listener below keeps the
// hint in sync on every auth change (login, logout, session expiry).
const WAS_LOGGED_IN_HINT_KEY = "wasLoggedInHint";

onAuthStateChanged(auth, (user) => {
  try {
    localStorage.setItem(WAS_LOGGED_IN_HINT_KEY, user ? "true" : "false");
  } catch (err) {
    // localStorage can be unavailable (e.g. blocked storage); the only cost
    // is a brief wrong-state flash on the next load.
    console.error("Failed to persist auth state hint", err);
  }
});

function loadWasLoggedInHint(): boolean {
  try {
    return localStorage.getItem(WAS_LOGGED_IN_HINT_KEY) === "true";
  } catch (err) {
    console.error("Failed to read auth state hint", err);
    return false;
  }
}

// useLoggedInOptimistic is useLoggedIn with a better initial guess: until
// Firebase settles, it reports the persisted last-session state instead of
// false. Use it for layout-level decisions (which page to render) where a
// wrong "false" causes a visible flash. Do NOT use it to gate authenticated
// requests - the guess can be wrong; data paths must use useLoggedIn /
// isLoggedInSettled.
export function useLoggedInOptimistic() {
  const [loggedIn, setLoggedIn] = useState(
    () => isLoggedIn() || loadWasLoggedInHint(),
  );

  useEffect(() => {
    // Fires immediately with the current state once auth has settled, which
    // corrects an initial guess that turned out wrong.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  return loggedIn;
}

// It takes some time for the auth state to be loaded, returned loggedIn
// can be stale for a short period of time.
export function useLoggedIn() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoggedIn(!!user);
    });

    return () => unsubscribe();
  }, []);

  return loggedIn;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  return user;
}

export async function getAuthToken() {
  console.debug("Getting auth token");
  // Wait for the persisted session to be restored: with optimistic rendering
  // an authenticated view can mount (and fire its queries) before Firebase
  // has settled, and reading currentUser synchronously here would throw for
  // a user who is actually logged in.
  await auth.authStateReady();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error("User is not signed in");
    throw new UnauthorizedError();
  }
  return currentUser.getIdToken();
}
