import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
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
        // authDomain: "lang-dev-70b39.firebaseapp.com",
        authDomain: "localhost:5001",
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

export async function getAuthToken() {
  console.debug("Getting auth token");
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error("User is not signed in");
    throw new UnauthorizedError();
  }
  return currentUser.getIdToken();
}
