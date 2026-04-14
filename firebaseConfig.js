// ─────────────────────────────────────────────────────────────────────────────
// firebase/firebaseConfig.js
// Inicialización única de Firebase para toda la app.
// Usar variables de entorno de Next.js (.env.local) — NUNCA hardcodear keys.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth }                         from 'firebase/auth'
import { getFirestore }                    from 'firebase/firestore'
import { getStorage }                      from 'firebase/storage'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Patrón singleton: evita reinicializar en Hot Module Replacement (HMR) de Next.js
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)
export default app
