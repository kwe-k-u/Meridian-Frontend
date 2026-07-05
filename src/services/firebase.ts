// ── Firebase Service ────────────────────────────────────────
// Initializes Firebase with env-based config and exposes Google sign-in via popup.
// The idToken (plus basic profile info) is then exchanged with the backend for a Meridian
// session token — see ApiService.googleLogin(), which posts these to POST /auth/login.
// Firebase itself is only used client-side to run the Google popup; the backend never talks
// to Firebase directly; it just trusts whatever this file hands it (see the "Mocking
// decoding logic" comment in AuthController::handleGoogleLogin on the backend).

import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth'


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// ── App Initialization ──
// Singleton pattern: initializes Firebase once and caches the app instance.
let app: FirebaseApp | null = null

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig)
  }
  return app
}

export interface GoogleSignInResult {
  idToken: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}

// ── Google Sign-In ──
// Opens a Google sign-in popup, requests email+profile scopes, and returns the idToken
// plus the profile fields the backend needs to provision/match the account.
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const auth = getAuth(getFirebaseApp())
  const provider = new GoogleAuthProvider()
  provider.addScope('email')
  provider.addScope('profile')

  const result: UserCredential = await signInWithPopup(auth, provider)
  const idToken = await result.user.getIdToken()
  return {
    idToken,
    email: result.user.email,
    displayName: result.user.displayName,
    avatarUrl: result.user.photoURL,
  }
}
