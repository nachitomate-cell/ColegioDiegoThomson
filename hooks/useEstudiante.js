// ─────────────────────────────────────────────────────────────────────────────
// hooks/useEstudiante.js
// Carga los datos del estudiante directamente desde Firestore.
// El documento Estudiantes/{uid} usa el Firebase Auth UID como ID,
// ya que la cuenta de Auth se crea con el RUT del estudiante.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/firebaseConfig'

/**
 * @param {string | null | undefined} uid  Firebase Auth UID del estudiante logueado.
 * @returns {{ estudiante: object | null, loading: boolean, error: Error | null }}
 */
export function useEstudiante(uid) {
  const [estudiante, setEstudiante] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchEstudiante() {
      setLoading(true)
      setError(null)

      try {
        const estudianteRef  = doc(db, 'Estudiantes', uid)
        const estudianteSnap = await getDoc(estudianteRef)

        if (!estudianteSnap.exists()) {
          throw new Error(`No se encontró perfil de estudiante. Contacta a la secretaría.`)
        }

        const data = estudianteSnap.data()

        if (!cancelled) {
          setEstudiante({
            nombre:               data.nombre,
            rut:                  data.rut,
            rut_limpio:           data.rut_limpio           ?? null,
            curso:                data.curso,
            apoderado_nombre:     data.apoderado_nombre     ?? null,
            apoderado_rut:        data.apoderado_rut        ?? null,
            apoderado_rut_limpio: data.apoderado_rut_limpio ?? null,
            apoderado_email:      data.apoderado_email      ?? null,
            beca:                 data.beca                 ?? false,
            es_becado:            data.es_becado            ?? false,
            monto_cuota:          data.monto_cuota          ?? null,
          })
        }
      } catch (err) {
        console.error('[useEstudiante] Error:', err)
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchEstudiante()

    return () => { cancelled = true }
  }, [uid])

  return { estudiante, loading, error }
}
