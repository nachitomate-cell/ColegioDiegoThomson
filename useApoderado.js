// ─────────────────────────────────────────────────────────────────────────────
// hooks/useApoderado.js
// Carga los datos del apoderado y sus estudiantes desde Firestore.
//
// ESQUEMA FIRESTORE:
//
//   Apoderados/{rut}
//   ┣ nombre          : string       → "Carlos Fuentes Morales"
//   ┣ email           : string       → "c.fuentes@gmail.com"
//   ┣ rut             : string       → "12345678-9"
//   ┗ estudiantes_ids : string[]     → ["est_abc123", "est_def456"]
//
//   Estudiantes/{estudianteId}
//   ┣ nombre          : string       → "Sofía Fuentes"
//   ┗ curso           : string       → "7° Básico A"
//
// RETORNA:
//   {
//     apoderado : { nombre, email, rut, estudiantes: [{id, nombre, curso}] } | null,
//     loading   : boolean,
//     error     : Error | null
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/firebaseConfig'

/**
 * @param {string | null | undefined} uid  ← Firebase Auth UID del usuario logueado.
 *        IMPORTANTE: El UID de Firebase Auth debe coincidir con el ID del documento
 *        en Apoderados/{uid}. Configura esto al crear el usuario (ver nota abajo).
 */
export function useApoderado(uid) {
  const [apoderado, setApoderado] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    // No hacer nada si todavía no hay uid (auth cargando o no autenticado)
    if (!uid) {
      setLoading(false)
      return
    }

    let cancelled = false // flag para evitar actualizar estado en componente desmontado

    async function fetchApoderado() {
      setLoading(true)
      setError(null)

      try {
        // ── 1. Leer documento del apoderado ────────────────────────────────────
        // El ID del documento en Apoderados es el UID de Firebase Auth.
        // Al crear el usuario con createUserWithEmailAndPassword(), debes llamar:
        //   await setDoc(doc(db, 'Apoderados', userCredential.user.uid), { nombre, email, rut, estudiantes_ids: [] })
        const apoderadoRef = doc(db, 'Apoderados', uid)
        const apoderadoSnap = await getDoc(apoderadoRef)

        if (!apoderadoSnap.exists()) {
          throw new Error(`No se encontró apoderado con uid: ${uid}`)
        }

        const apoderadoData = apoderadoSnap.data()
        const estudiantesIds = apoderadoData.estudiantes_ids ?? []

        // ── 2. Cargar documentos de cada estudiante en paralelo ────────────────
        // Usamos Promise.all para no hacer N requests secuenciales.
        // Nota: Firestore limita 'in' a 30 elementos. Para más de 30 hijos,
        // dividir en chunks o usar una subcolección.
        let estudiantesData = []

        if (estudiantesIds.length > 0) {
          // Estrategia A: getDocs con query 'in' (eficiente, ≤ 30 ids)
          const estudiantesQuery = query(
            collection(db, 'Estudiantes'),
            where('__name__', 'in', estudiantesIds)
          )
          const snapshot = await getDocs(estudiantesQuery)

          // Preservar el orden original de estudiantes_ids
          const docsMap = {}
          snapshot.forEach((d) => { docsMap[d.id] = d.data() })

          estudiantesData = estudiantesIds
            .filter((id) => docsMap[id]) // ignorar ids que no existan
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
  }, [uid]) // re-ejecutar solo si cambia el uid

  return { apoderado, loading, error }
}
