// ─────────────────────────────────────────────────────────────────────────────
// hooks/useCuotas.js
// Carga las cuotas de un estudiante con getDocs (lectura única bajo demanda).
// Expone refresh() para recargar manualmente — se llama tras pagar o subir
// comprobante, y cuando la pestaña vuelve a ser visible.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase/firebaseConfig'

/**
 * @param {string | null | undefined} estudianteId
 * @returns {{ cuotas: object[], loading: boolean, error: Error | null, refresh: () => void }}
 */
export function useCuotas(estudianteId) {
  const [cuotas, setCuotas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [tick, setTick]       = useState(0)           // incrementar para forzar re-fetch
  const lastFetch             = useRef(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  // Recargar cuando la pestaña vuelve a estar visible (usuario regresa de Transbank)
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastFetch.current
        if (elapsed > 10_000) refresh()               // solo si pasaron más de 10s
      }
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [refresh])

  useEffect(() => {
    if (!estudianteId) {
      setCuotas([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const q = query(
      collection(db, 'Cuotas'),
      where('estudiante_id', '==', estudianteId),
      orderBy('fecha_vencimiento', 'asc')
    )

    getDocs(q)
      .then((snapshot) => {
        if (cancelled) return
        lastFetch.current = Date.now()
        setCuotas(snapshot.docs.map((docSnap) => {
          const d = docSnap.data()
          return {
            id:                  docSnap.id,
            estudianteId:        d.estudiante_id,
            mes:                 d.mes,
            anio:                d.anio,
            monto:               d.monto,
            fechaVencimiento:    d.fecha_vencimiento?.toDate() ?? null,
            fechaPago:           d.fecha_pago?.toDate()        ?? null,
            fechaEnvio:          d.fecha_envio?.toDate()       ?? null,
            estado:              d.estado,
            comprobanteUrl:      d.comprobante_url             ?? null,
            transbank_auth_code: d.transbank_auth_code         ?? null,
            createdAt:           d.created_at?.toDate()        ?? null,
          }
        }))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[useCuotas] Error:', err)
        setError(err)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [estudianteId, tick])

  return { cuotas, loading, error, refresh }
}
