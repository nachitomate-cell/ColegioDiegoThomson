// ─────────────────────────────────────────────────────────────────────────────
// hooks/useCuotasCGPA.js
// Escucha en tiempo real las cuotas voluntarias (CGPA) de un apoderado.
// A diferencia de useCuotas, filtra por apoderado_id en lugar de estudiante_id,
// ya que la cuota CGPA pertenece a la familia, no al alumno individual.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/firebaseConfig'

/**
 * @param {string | null | undefined} apoderadoRutLimpio  — rut limpio del apoderado (doc ID en /Apoderados)
 * @returns {{ cuotas: object[], loading: boolean, error: Error | null }}
 */
export function useCuotasCGPA(apoderadoRutLimpio) {
  const [cuotas, setCuotas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!apoderadoRutLimpio) {
      setCuotas([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Consulta por apoderado_id. No necesita índice compuesto porque
    // todos los docs con apoderado_id son voluntarios por diseño.
    const q = query(
      collection(db, 'Cuotas'),
      where('apoderado_id', '==', apoderadoRutLimpio)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => {
          const f = d.data()
          return {
            id:             d.id,
            concepto:       f.concepto ?? '—',
            monto:          f.monto,
            estado:         f.estado,
            esVoluntaria:   f.es_voluntaria ?? true,
            apoderadoId:    f.apoderado_id,
            comprobanteUrl: f.comprobante_url ?? null,
            fechaPago:      f.fecha_pago?.toDate()  ?? null,
            fechaEnvio:     f.fecha_envio?.toDate() ?? null,
            anio:           f.anio ?? null,
            // estudianteId es null para cuotas CGPA
          }
        })
        setCuotas(data)
        setLoading(false)
      },
      (err) => {
        console.error('[useCuotasCGPA] Error en onSnapshot:', err)
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [apoderadoRutLimpio])

  return { cuotas, loading, error }
}
