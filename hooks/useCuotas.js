// ─────────────────────────────────────────────────────────────────────────────
// hooks/useCuotas.js
// Escucha en tiempo real las cuotas de un estudiante usando onSnapshot.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase/firebaseConfig'

/**
 * @param {string | null | undefined} estudianteId
 * @returns {{ cuotas: object[], loading: boolean, error: Error | null }}
 */
export function useCuotas(estudianteId) {
  const [cuotas, setCuotas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!estudianteId) {
      setCuotas([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // REQUISITO: índice compuesto en Firestore Console
    //   Colección: Cuotas | estudiante_id (ASC) + fecha_vencimiento (ASC)
    const cuotasQuery = query(
      collection(db, 'Cuotas'),
      where('estudiante_id', '==', estudianteId),
      orderBy('fecha_vencimiento', 'asc')
    )

    const unsubscribe = onSnapshot(
      cuotasQuery,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
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
        })

        setCuotas(data)
        setLoading(false)
      },
      (err) => {
        console.error('[useCuotas] Error en onSnapshot:', err)
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [estudianteId])

  return { cuotas, loading, error }
}
