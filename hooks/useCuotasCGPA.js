// ─────────────────────────────────────────────────────────────────────────────
// hooks/useCuotasCGPA.js
// Carga las cuotas voluntarias (CGPA) de un apoderado con getDocs.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase/firebaseConfig'

/**
 * @param {string | null | undefined} apoderadoRutLimpio
 * @returns {{ cuotas: object[], loading: boolean, error: Error | null, refresh: () => void }}
 */
export function useCuotasCGPA(apoderadoRutLimpio) {
  const [cuotas, setCuotas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [tick, setTick]       = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!apoderadoRutLimpio) {
      setCuotas([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const q = query(
      collection(db, 'Cuotas'),
      where('apoderado_id', '==', apoderadoRutLimpio)
    )

    getDocs(q)
      .then((snapshot) => {
        if (cancelled) return
        setCuotas(snapshot.docs.map((d) => {
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
          }
        }))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[useCuotasCGPA] Error:', err)
        setError(err)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [apoderadoRutLimpio, tick])

  return { cuotas, loading, error, refresh }
}
