'use client'

// ─────────────────────────────────────────────────────────────────────────────
// app/pago/resultado/page.jsx
// Página que muestra el resultado del pago después de que Transbank redirige.
// Transbank redirige a /pago/resultado con query params:
//   success=true|false
//   monto=85000          (si aprobado)
//   auth=XXXXXX          (código de autorización del banco)
//   cuotaId=xxx          (ID de la cuota)
//   motivo=cancelado|rechazado|error  (si fallido)
// ─────────────────────────────────────────────────────────────────────────────

import { useSearchParams, useRouter } from 'next/navigation'
import { LOGO_SRC } from '../../../lib/logo'
import { Suspense }                   from 'react'

const formatCLP = (monto) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(Number(monto))

const MOTIVOS = {
  cancelado: 'Cancelaste el pago antes de completarlo.',
  rechazado: 'Tu banco rechazó la transacción. Por favor contáctalo o intenta con otra tarjeta.',
  error:     'Ocurrió un error inesperado. Por favor intenta nuevamente.',
}

function ResultadoContent() {
  const params  = useSearchParams()
  const router  = useRouter()

  const success = params.get('success') === 'true'
  const monto   = params.get('monto')
  const auth    = params.get('auth')
  const cuotaId = params.get('cuotaId')
  const motivo  = params.get('motivo') ?? 'error'

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center p-4">

      {/* Tarjeta de resultado */}
      <div className="bg-surface-700 border border-surface-500 rounded-2xl shadow-card-lg w-full max-w-md p-8 animate-fade-in">

        {success ? (
          // ── Pago Aprobado ───────────────────────────────────────────────────
          <>
            {/* Ícono de éxito */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-paid-bg border-2 border-paid flex items-center justify-center shadow-glow-green">
                <svg className="w-10 h-10 text-paid" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <div className="text-center space-y-2 mb-6">
              <h1 className="text-ink-primary text-2xl font-bold">¡Pago Aprobado!</h1>
              <p className="text-ink-muted text-sm">Tu mensualidad fue pagada exitosamente.</p>
            </div>

            {/* Detalle del pago */}
            <div className="bg-surface-800 rounded-xl p-4 space-y-3 mb-6">
              {monto && (
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted text-sm">Monto pagado</span>
                  <span className="text-paid font-bold text-lg">{formatCLP(monto)}</span>
                </div>
              )}
              {auth && (
                <div className="flex justify-between items-center border-t border-surface-500 pt-3">
                  <span className="text-ink-muted text-sm">Código de autorización</span>
                  <span className="text-ink-primary font-mono text-sm font-semibold">{auth}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-surface-500 pt-3">
                <span className="text-ink-muted text-sm">Estado</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-paid-bg text-paid border border-paid-border">
                  <span className="w-1.5 h-1.5 rounded-full bg-paid" />
                  Pagado
                </span>
              </div>
            </div>

            <p className="text-ink-muted text-xs text-center mb-5">
              Guarda el código de autorización como comprobante. El estado se actualizará automáticamente en tu portal.
            </p>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-accent hover:bg-accent-hover text-gray-900 font-semibold py-3 rounded-xl transition-all shadow-glow-blue active:scale-[0.98]"
            >
              Volver al Portal
            </button>
          </>

        ) : (
          // ── Pago Fallido / Cancelado ────────────────────────────────────────
          <>
            {/* Ícono de error */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-overdue-bg border-2 border-overdue flex items-center justify-center shadow-glow-red">
                <svg className="w-10 h-10 text-overdue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>

            <div className="text-center space-y-2 mb-6">
              <h1 className="text-ink-primary text-2xl font-bold">
                {motivo === 'cancelado' ? 'Pago Cancelado' : 'Pago No Completado'}
              </h1>
              <p className="text-ink-muted text-sm leading-relaxed">
                {MOTIVOS[motivo] ?? MOTIVOS.error}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-accent hover:bg-accent-hover text-gray-900 font-semibold py-3 rounded-xl transition-all shadow-glow-blue active:scale-[0.98]"
              >
                Volver al Portal
              </button>
              <p className="text-ink-muted text-xs text-center">
                Si el problema persiste, contacta a la secretaría del colegio.
              </p>
            </div>
          </>
        )}

        {/* Logo del colegio */}
        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-surface-500">
          <img src={LOGO_SRC} alt="CDT" className="w-5 h-5 rounded object-cover" />
          <span className="text-ink-muted text-xs">Colegio Diego Thomson · Portal Escolar</span>
        </div>

      </div>
    </div>
  )
}

export default function PagoResultadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResultadoContent />
    </Suspense>
  )
}
