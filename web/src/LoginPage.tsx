import React, { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
} from "firebase/auth";
import { auth, useLoggedIn } from "./firebase";
import { FirebaseError } from "firebase/app";
import { useNavigate } from "react-router-dom";

// TODO: localize it
export function LoginPage({ isSignUp }: { isSignUp: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const navigate = useNavigate();

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
      // TODO: handle weak password and other Firebase errors
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(String(err));
      }
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
      }
      // After this, the browser will redirect to the OAuth provider
      // We won't reach the code below
    } catch (err) {
      if (err instanceof FirebaseError) {
        console.error("Google sign-in error:", err);
        setErrorMsg(`Error during Google sign-in: ${err.message}`);
      } else {
        console.error("Unknown Google sign-in error:", err);
        setErrorMsg("Unknown error during Google sign-in");
      }
    }
  };

  const loggedIn = useLoggedIn();
  useEffect(() => {
    if (loggedIn) {
      console.log("User is logged in");
      navigate("/");
    }
  }, [loggedIn, navigate]);

  // useEffect(()=>{
  //   onAuthStateChanged(auth, (user) => {
  //       if (user) {
  //         // User is signed in, see docs for a list of available properties
  //         // https://firebase.google.com/docs/reference/js/firebase.User
  //         const uid = user.uid;
  //         // ...
  //         console.log("uid", uid);
  //       } else {
  //         // User is signed out
  //         // ...
  //         console.log("user is logged out");
  //       }
  //     });
  // }, []);


  // Handle redirect result when user returns from Google sign-in
  // useEffect(() => {
  //   const handleRedirectResult = async () => {
  //     try {
  //       const result = await getRedirectResult(auth);
        
  //       // If the result is null, it could mean:
  //       // 1. User hasn't been redirected back from Google yet
  //       // 2. This is the first page load and not a redirect back
  //       if (result) {
  //         // Successfully signed in with Google. Navigate immediately.
  //         console.log("Successfully signed in with Google", result.user.displayName);
  //         navigate("/");
  //       } else {
  //         console.log("No redirect result, user might not have signed in yet");
  //       }
  //     } catch (err) {
  //       if (err instanceof FirebaseError) {
  //         console.error("Google sign-in redirect error:", err);
  //         setErrorMsg(`Google sign-in failed: ${err.message}`);
  //       } else {
  //         setErrorMsg("Error during Google sign-in");
  //         console.error("Unknown error during redirect:", err);
  //       }
  //     }
  //   };

  //   // Only run once when component mounts
  //   handleRedirectResult();
  // }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-main-white px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-literata font-bold text-center mb-6 text-main-text">
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h1>
        
        <p className="text-secondary-text text-center mb-8">
          {isSignUp 
            ? "Sign up to start your journey" 
            : "Sign in to continue your experience"}
        </p>

        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
            <p className="text-red-700 text-sm">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="your@email.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="••••••••"
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center">
          <hr className="flex-grow border-gray-200" />
          <span className="px-4 text-sm text-gray-500">OR</span>
          <hr className="flex-grow border-gray-200" />
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full mt-5 flex items-center justify-center bg-white border border-gray-300 rounded-md shadow-sm px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="h-5 w-5 mr-3" viewBox="-3 0 262 262" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid"><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/></svg>
          Continue with Google
        </button>

        <p className="mt-8 text-center text-sm text-gray-600">
          {isSignUp ? "Already have an account? " : "Don't have an account yet? "}
          <button 
            onClick={toggleSignUp} 
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

export function SignInPage() {
  return <LoginPage isSignUp={false} />;
}

export function SignUpPage() {
  return <LoginPage isSignUp={true} />;
}
