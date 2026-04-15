// ─────────────────────────────────────────────────────────────────────────────
// hooks/useAuth.js
// Escucha el estado de autenticación de Firebase Auth.
// Retorna: { user, loading }
//   · user    → objeto Firebase User | null
//   · loading → true mientras se resuelve el estado inicial (evita flashes)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { onAuthStateChanged }  from 'firebase/auth'
import { auth }                from '../firebase/firebaseConfig'

/**
 * @returns {{ user: import('firebase/auth').User | null, loading: boolean }}
 */
export function useAuth() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { user, loading }
}
