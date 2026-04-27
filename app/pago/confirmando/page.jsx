'use client'

// ─────────────────────────────────────────────────────────────────────────────
// app/pago/confirmando/page.jsx
// Pantalla intermedia tras retorno de la pasarela (Khipu / Webpay).
// Hace polling a /api/pago/estado cada 2s hasta que el webhook confirme
// el cambio de estado en Firestore (máx. 60 segundos).
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams }             from 'next/navigation'
import { toast }                                  from 'sonner'
import { Info, AlertCircle }                      from 'lucide-react'
import { auth }                                   from '../../../firebaseConfig'
import { LOGO_SRC }                               from '../../../lib/logo'

const POLL_MS  = 2_000   // intervalo entre polls
const LIMIT_MS = 60_000  // timeout total

function ConfirmandoContent() {
  const router  = useRouter()
  const params  = useSearchParams()
  const cuotaId = params.get('cuota_id')

  const [fase, setFase]         = useState('polling') // 'polling'|'pagado'|'en_revision'|'timeout'
  const [segundos, setSegundos] = useState(0)
  const startedAt               = useRef(null)

  useEffect(() => {
    if (!cuotaId) {
      toast.error('No pudimos verificar el pago')
      const t = setTimeout(() => router.replace('/dashboard'), 2000)
      return () => clearTimeout(t)
    }

    let stopped   = false
    let pollTimer = null
    let tickTimer = null

    const stopAll = () => {
      stopped = true
      clearTimeout(pollTimer)
      clearInterval(tickTimer)
    }

    const doPoll = async (user) => {
      if (stopped) return

      if (Date.now() - startedAt.current >= LIMIT_MS) {
        stopAll()
        setFase('timeout')
        return
      }

      try {
        const token = await user.getIdToken()
        const res   = await fetch(
          `/api/pago/estado?cuota_id=${encodeURIComponent(cuotaId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (stopped) return

        if (res.status === 401 || res.status === 403 || res.status === 404) {
          stopAll()
          toast.error('No pudimos verificar el pago')
          setTimeout(() => router.replace('/dashboard'), 2000)
          return
        }

        if (res.ok) {
          const { estado } = await res.json()

          if (estado === 'pagado') {
            stopAll()
            setFase('pagado')
            setTimeout(() => {
              toast.success('Pago confirmado correctamente')
              router.replace('/dashboard')
            }, 1500)
            return
          }

          if (estado === 'en_revision') {
            stopAll()
            setFase('en_revision')
            return
          }
        }
      } catch { /* error de red — reintentar en el próximo tick */ }

      if (!stopped) pollTimer = setTimeout(() => doPoll(user), POLL_MS)
    }

    tickTimer = setInterval(() => setSegundos(s => s + 1), 1000)

    const unsub = auth.onAuthStateChanged(user => {
      unsub()
      if (stopped) return
      if (!user) {
        stopAll()
        toast.error('No pudimos verificar el pago')
        setTimeout(() => router.replace('/dashboard'), 2000)
        return
      }
      startedAt.current = Date.now()
      doPoll(user)
    })

    return () => {
      stopAll()
      unsub()
    }
  }, [cuotaId, router])

  const mensajePolling =
    segundos < 10 ? 'Esto suele tomar unos segundos...'
    : segundos < 30 ? 'Estamos verificando con la pasarela...'
    : 'Casi listo, gracias por tu paciencia...'

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md flex flex-col items-center gap-8 animate-fade-in">

        {/* Logo */}
        <img
          src={LOGO_SRC}
          alt="Colegio Diego Thomson"
          className="w-16 h-16 rounded-xl object-cover shadow-card"
        />

        {/* ── Polling ─────────────────────────────────────────────────────── */}
        {fase === 'polling' && <>
          <div
            className="w-20 h-20 rounded-full animate-spin"
            style={{ border: '6px solid rgba(201,162,39,0.18)', borderTopColor: '#C9A227' }}
          />
          <div className="text-center space-y-2">
            <h2 className="text-[28px] font-bold leading-tight" style={{ color: '#0D2C54' }}>
              Confirmando tu pago
            </h2>
            <p className="text-ink-muted text-base">{mensajePolling}</p>
          </div>
        </>}

        {/* ── Pagado ──────────────────────────────────────────────────────── */}
        {fase === 'pagado' && <>
          <div className="w-20 h-20 rounded-full bg-paid-bg border-2 border-paid flex items-center justify-center shadow-glow-green">
            <svg
              className="w-10 h-10 text-paid"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-[28px] font-bold leading-tight" style={{ color: '#0D2C54' }}>
              ¡Pago confirmado!
            </h2>
            <p className="text-ink-muted text-base">Tu cuota ha sido registrada correctamente</p>
          </div>
        </>}

        {/* ── Comprobante en revisión ──────────────────────────────────────── */}
        {fase === 'en_revision' && <>
          <div className="w-20 h-20 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center">
            <Info className="w-10 h-10 text-blue-600" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-[28px] font-bold leading-tight" style={{ color: '#0D2C54' }}>
              Comprobante recibido
            </h2>
            <p className="text-ink-muted text-base leading-relaxed">
              La secretaría revisará tu comprobante. Recibirás confirmación cuando sea aprobado.
            </p>
          </div>
          <button
            onClick={() => router.replace('/dashboard')}
            className="w-full max-w-xs bg-accent hover:bg-accent-hover text-gray-900 font-semibold py-3 rounded-xl transition-all"
          >
            Ir al dashboard
          </button>
        </>}

        {/* ── Timeout ─────────────────────────────────────────────────────── */}
        {fase === 'timeout' && <>
          <div className="w-20 h-20 rounded-full bg-review-bg border-2 border-review flex items-center justify-center shadow-glow-amber">
            <AlertCircle className="w-10 h-10 text-review" />
          </div>
          <div className="text-center space-y-3">
            <h2 className="text-[28px] font-bold leading-tight" style={{ color: '#0D2C54' }}>
              Procesando tu pago
            </h2>
            <p className="text-ink-muted text-base leading-relaxed">
              Tu pago está siendo procesado por la pasarela. Si en 5 minutos no se refleja en el
              portal, contacta a secretaría con este código:
            </p>
            <button
              onClick={() => navigator.clipboard?.writeText(cuotaId ?? '')}
              title="Copiar código de referencia"
              className="font-mono text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg px-4 py-2 text-ink-primary transition-colors cursor-copy"
            >
              {cuotaId}
            </button>
          </div>
          <button
            onClick={() => router.replace('/dashboard')}
            className="w-full max-w-xs bg-accent hover:bg-accent-hover text-gray-900 font-semibold py-3 rounded-xl transition-all"
          >
            Ir al dashboard
          </button>
        </>}

        <p className="text-xs text-ink-disabled">Colegio Diego Thomson · Portal Escolar</p>
      </div>
    </div>
  )
}

export default function PagoConfirmandoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="w-10 h-10 rounded-full animate-spin"
          style={{ border: '4px solid rgba(201,162,39,0.18)', borderTopColor: '#C9A227' }}
        />
      </div>
    }>
      <ConfirmandoContent />
    </Suspense>
  )
}
