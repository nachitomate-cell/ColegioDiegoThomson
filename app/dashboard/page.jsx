'use client'

// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/page.jsx
// Protege el Dashboard con verificación de consentimiento de política.
// Si el apoderado no ha aceptado la versión actual, muestra el modal antes
// de renderizar el Dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { onAuthStateChanged, getIdToken } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/firebaseConfig'
import { POLITICA_PRIVACIDAD_VERSION } from '../../lib/constants'
import Dashboard from '../../components/Dashboard'
import ConsentimientoModal from '../../components/ConsentimientoModal'

export default function DashboardPage() {
  const [estado, setEstado] = useState('cargando') // 'cargando' | 'consentimiento' | 'ok'
  const [user,   setUser]   = useState(null)
  const [consentimientoLoading, setConsentimientoLoading] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        // No hay sesión — el Dashboard interno maneja la redirección
        setEstado('ok')
        return
      }
      setUser(u)

      try {
        const consnSnap = await getDoc(doc(db, 'Consentimientos', u.uid))
        if (consnSnap.exists() && consnSnap.data().version_politica === POLITICA_PRIVACIDAD_VERSION) {
          // Versión aceptada coincide con la actual → acceso directo
          setEstado('ok')
        } else {
          // Nunca aceptó o versión desactualizada → pedir reconsentimiento
          setEstado('consentimiento')
        }
      } catch (err) {
        console.error('[dashboard] Error verificando consentimiento:', err)
        // En caso de fallo de red, permitir acceso (no bloquear por error de auditoría)
        setEstado('ok')
      }
    })
    return () => unsub()
  }, [])

  const handleAceptarConsentimiento = async () => {
    if (!user) return
    setConsentimientoLoading(true)
    try {
      const token = await getIdToken(user)
      await fetch('/api/consentimiento/registrar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    } catch (err) {
      console.error('[dashboard] Error al registrar consentimiento:', err)
      // Continuamos — no bloqueamos el acceso por un fallo de auditoría
    } finally {
      setConsentimientoLoading(false)
      setEstado('ok')
    }
  }

  if (estado === 'cargando') {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <ConsentimientoModal
        visible={estado === 'consentimiento'}
        onAceptar={handleAceptarConsentimiento}
        loading={consentimientoLoading}
      />
      <Dashboard />
    </>
  )
}
