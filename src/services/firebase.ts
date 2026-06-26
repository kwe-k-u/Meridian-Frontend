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

let app: FirebaseApp | null = null

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig)
  }
  return app
}

export async function signInWithGoogle(): Promise<string> {
  const auth = getAuth(getFirebaseApp())
  const provider = new GoogleAuthProvider()
  provider.addScope('email')
  provider.addScope('profile')

  const result: UserCredential = await signInWithPopup(auth, provider)
  const idToken = await result.user.getIdToken()
  return idToken
}
