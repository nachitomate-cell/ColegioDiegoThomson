// ─────────────────────────────────────────────────────────────────────────────
// hooks/useApoderado.js
// Carga los datos del apoderado y sus estudiantes desde Firestore.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/firebaseConfig'

/**
 * @param {string | null | undefined} uid  Firebase Auth UID del usuario logueado.
 * @returns {{ apoderado: object | null, loading: boolean, error: Error | null }}
 */
export function useApoderado(uid) {
  const [apoderado, setApoderado] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchApoderado() {
      setLoading(true)
      setError(null)

      try {
        const apoderadoRef  = doc(db, 'Apoderados', uid)
        const apoderadoSnap = await getDoc(apoderadoRef)

        if (!apoderadoSnap.exists()) {
          throw new Error(`No se encontró apoderado con uid: ${uid}`)
        }

        const apoderadoData  = apoderadoSnap.data()
        const estudiantesIds = apoderadoData.estudiantes_ids ?? []

        let estudiantesData = []

        if (estudiantesIds.length > 0) {
          const estudiantesQuery = query(
            collection(db, 'Estudiantes'),
            where('__name__', 'in', estudiantesIds)
          )
          const snapshot = await getDocs(estudiantesQuery)

          const docsMap = {}
          snapshot.forEach((d) => { docsMap[d.id] = d.data() })

          estudiantesData = estudiantesIds
            .filter((id) => docsMap[id])
            .map((id) => ({
              id,
              nombre: docsMap[id].nombre,
              curso:  docsMap[id].curso,
            }))
        }

        if (!cancelled) {
          setApoderado({
            nombre:      apoderadoData.nombre,
            email:       apoderadoData.email,
            rut:         apoderadoData.rut,
            estudiantes: estudiantesData,
          })
        }
      } catch (err) {
        console.error('[useApoderado] Error:', err)
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchApoderado()

    return () => { cancelled = true }
  }, [uid])

  return { apoderado, loading, error }
}
