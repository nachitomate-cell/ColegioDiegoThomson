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
  // null  → no autenticado
  // User  → objeto Firebase con uid, email, displayName, etc.
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true) // true hasta que Firebase responda

  useEffect(() => {
    // onAuthStateChanged retorna una función "unsubscribe"
    // que se llama automáticamente al desmontar el componente.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { user, loading }
}
