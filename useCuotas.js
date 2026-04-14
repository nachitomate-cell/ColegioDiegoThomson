// ─────────────────────────────────────────────────────────────────────────────
// hooks/useCuotas.js
// Escucha en tiempo real las cuotas de un estudiante usando onSnapshot.
//
// ESQUEMA FIRESTORE:
//
//   Cuotas/{cuotaId}   ← ID auto-generado por Firestore
//   ┣ estudiante_id    : string    → "est_abc123"  (referencia al doc de Estudiantes)
//   ┣ mes              : string    → "Junio"        (label para UI)
//   ┣ anio             : number    → 2025
//   ┣ monto            : number    → 85000          (en pesos CLP, sin decimales)
//   ┣ fecha_vencimiento: Timestamp → Firestore Timestamp (NO string ISO)
//   ┣ estado           : string    → 'pendiente' | 'pagado' | 'en_revision' | 'atrasado'
//   ┣ comprobante_url  : string | null  → URL de Firebase Storage
//   ┣ fecha_pago       : Timestamp | null
//   ┗ created_at       : Timestamp  → serverTimestamp() al crear
//
// RETORNA:
//   {
//     cuotas  : Cuota[],   ← ordenadas por fecha_vencimiento ASC
//     loading : boolean,
//     error   : Error | null
//   }
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
    // No suscribir si no hay estudianteId todavía
    if (!estudianteId) {
      setCuotas([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // ── Construcción de la query ──────────────────────────────────────────────
    // REQUISITO ÍNDICE COMPUESTO en Firestore Console:
    //   Colección: Cuotas
    //   Campos: estudiante_id (ASC) + fecha_vencimiento (ASC)
    //   Tipo: Índice compuesto
    //   Firebase genera el link automáticamente en la consola del navegador
    //   la primera vez que ejecutas esta query sin el índice.
    const cuotasQuery = query(
      collection(db, 'Cuotas'),
      where('estudiante_id', '==', estudianteId),
      orderBy('fecha_vencimiento', 'asc')
    )

    // ── Suscripción en tiempo real ────────────────────────────────────────────
    // onSnapshot llama al callback INMEDIATAMENTE con el estado actual de la BD,
    // y luego cada vez que algún documento de la query cambia.
    // Esto permite que el badge de estado se actualice sin refrescar la página
    // cuando el admin cambia 'en_revision' → 'pagado'.
    const unsubscribe = onSnapshot(
      cuotasQuery,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
          const d = docSnap.data()
          return {
            id:              docSnap.id,
            estudianteId:    d.estudiante_id,
            mes:             d.mes,
            anio:            d.anio,
            monto:           d.monto,
            // Convertir Firestore Timestamp → Date de JS para facilitar el formateo
            fechaVencimiento: d.fecha_vencimiento?.toDate() ?? null,
            fechaPago:        d.fecha_pago?.toDate() ?? null,
            estado:          d.estado,
            comprobanteUrl:  d.comprobante_url ?? null,
            createdAt:       d.created_at?.toDate() ?? null,
          }
        })

        setCuotas(data)
        setLoading(false)
      },
      (err) => {
        // El segundo callback de onSnapshot captura errores de permisos,
        // problemas de red, etc.
        console.error('[useCuotas] Error en onSnapshot:', err)
        setError(err)
        setLoading(false)
      }
    )

    // Cleanup: desuscribirse cuando cambie estudianteId o se desmonte el componente
    return () => unsubscribe()
  }, [estudianteId])

  return { cuotas, loading, error }
}
