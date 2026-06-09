import React, { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
} from "firebase/auth";
import { auth, useLoggedIn } from "./firebase";
import { FirebaseError } from "firebase/app";
import { useNavigate } from "react-router-dom";
import { lstr, LocalizationStrings } from "./localization";

// localizedAuthErrorMessage maps the Firebase error codes a user can
// realistically trigger from this form to a localized, human message.
// Anything unexpected collapses to the generic message (the raw error is
// still logged for debugging).
function localizedAuthErrorMessage(
  err: unknown,
  strings: LocalizationStrings,
): string {
  console.error("Auth error:", err);
  if (!(err instanceof FirebaseError)) {
    return strings.login_error_generic;
  }
  switch (err.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return strings.login_error_invalid_credentials;
    case "auth/email-already-in-use":
      return strings.login_error_email_in_use;
    case "auth/weak-password":
      return strings.login_error_weak_password;
    case "auth/invalid-email":
      return strings.login_error_invalid_email;
    case "auth/too-many-requests":
      return strings.login_error_too_many_requests;
    default:
      return strings.login_error_generic;
  }
}

export function LoginPage({ isSignUp, l }: { isSignUp: boolean; l: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const navigate = useNavigate();
  const strings = lstr(l);

  const toggleSignUp = () => {
    navigate(isSignUp ? "/login" : "/signup");
  };

  // Sign In with email and password
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setErrorMsg(localizedAuthErrorMessage(err, strings));
    }
  };

  // Sign In with Google
  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    const provider = new GoogleAuthProvider();
    try {
      if (process.env.NODE_ENV === "development") {
        await signInWithPopup(auth, provider);
      } else {
        await signInWithRedirect(auth, provider);
        // After this, the browser redirects to the OAuth provider; we won't
        // reach the code below. The outcome is handled by the
        // getRedirectResult effect when the user lands back here.
      }
    } catch (err) {
      setErrorMsg(localizedAuthErrorMessage(err, strings));
    }
  };

  const loggedIn = useLoggedIn();
  useEffect(() => {
    if (loggedIn) {
      navigate("/");
    }
  }, [loggedIn, navigate]);

  // Surface errors from the Google sign-in redirect flow. A null result just
  // means this page load isn't a return from the provider — only failures
  // need handling here; success is picked up by the loggedIn effect above.
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      setErrorMsg(localizedAuthErrorMessage(err, strings));
    });
    // strings changes only with the locale; re-running on locale change is
    // harmless (getRedirectResult resolves null after the first consume).
  }, [strings]);

  return (
    <div className="flex flex-col items-center justify-center flex-grow px-4 py-8">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border p-8">
        <h1 className="text-3xl font-bold text-center mb-4 text-main-text">
          {isSignUp ? strings.login_title_signup : strings.login_title_signin}
        </h1>

        <p className="text-secondary-text text-center mb-8 text-sm">
          {isSignUp
            ? strings.login_subtitle_signup
            : strings.login_subtitle_signin}
        </p>

        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
            <p className="text-red-700 text-sm">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-main-text">
              {strings.login_email_label}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-border rounded-xl bg-surface text-main-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              placeholder="your@email.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-main-text">
              {strings.login_password_label}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-border rounded-xl bg-surface text-main-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              placeholder="••••••••"
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-3 px-4 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {isSignUp ? strings.login_submit_signup : strings.login_submit_signin}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center">
          <hr className="flex-grow border-border" />
          <span className="px-4 text-sm text-muted-text">{strings.login_or}</span>
          <hr className="flex-grow border-border" />
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full mt-5 flex items-center justify-center bg-surface border border-border rounded-xl px-4 py-3 text-sm font-medium text-main-text hover:bg-cream-dark transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <svg className="h-5 w-5 mr-3" viewBox="-3 0 262 262" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid"><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/></svg>
          {strings.login_google_button}
        </button>

        <p className="mt-8 text-center text-sm text-secondary-text">
          {isSignUp
            ? strings.login_toggle_to_signin_question
            : strings.login_toggle_to_signup_question}
          <button
            onClick={toggleSignUp}
            className="text-primary hover:text-primary-hover font-medium transition-colors"
          >
            {isSignUp
              ? strings.login_toggle_to_signin
              : strings.login_toggle_to_signup}
          </button>
        </p>
      </div>
    </div>
  );
}

export function SignInPage({ l }: { l: string }) {
  return <LoginPage isSignUp={false} l={l} />;
}

export function SignUpPage({ l }: { l: string }) {
  return <LoginPage isSignUp={true} l={l} />;
}
