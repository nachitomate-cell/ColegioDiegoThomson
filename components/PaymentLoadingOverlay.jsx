'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/PaymentLoadingOverlay.jsx
// Overlay full-screen que cubre la UI mientras se procesa el inicio de pago.
//
// Props:
//   visible   {boolean}                       controla el render
//   estado    {'iniciando'|'redirigiendo'|'error'}
//   pasarela  {'Khipu'|'Webpay'}              para personalizar texto
// ─────────────────────────────────────────────────────────────────────────────

import { LOGO_SRC } from '../lib/logo'

const MENSAJES = {
  iniciando: {
    principal: 'Preparando tu pago',
    secundario: 'Estamos validando los datos de tu cuota...',
  },
  redirigiendo: (pasarela) => ({
    principal: `Redirigiendo a ${pasarela}`,
    secundario: 'En unos segundos serás llevado a la página segura de pago. No cierres esta ventana.',
  }),
  error: {
    principal: 'No pudimos procesar tu pago',
    secundario: 'Intenta nuevamente o contacta a secretaría.',
  },
}

export default function PaymentLoadingOverlay({ visible, estado = 'iniciando', pasarela = 'Webpay' }) {
  if (!visible) return null

  const msgs = estado === 'redirigiendo'
    ? MENSAJES.redirigiendo(pasarela)
    : MENSAJES[estado] ?? MENSAJES.iniciando

  const esError = estado === 'error'

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 animate-fade-in"
      style={{ background: 'rgba(13, 44, 84, 0.93)', backdropFilter: 'blur(4px)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 opacity-90">
        <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg ring-2 ring-white/20">
          <img src={LOGO_SRC} alt="Colegio Diego Thomson" className="w-full h-full object-cover" />
        </div>
        <p className="text-white/60 text-xs tracking-widest uppercase font-medium">
          Colegio Diego Thomson
        </p>
      </div>

      {/* Spinner o ícono de error */}
      {esError ? (
        <div className="w-16 h-16 rounded-full border-4 border-red-400/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ) : (
        <div className="relative w-16 h-16">
          {/* Pista del spinner */}
          <div className="absolute inset-0 rounded-full border-4 border-white/10" />
          {/* Arco giratorio */}
          <div
            className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
            style={{ borderTopColor: '#C9A227' }}
          />
          {/* Destello interior suave */}
          <div className="absolute inset-3 rounded-full bg-[#C9A227]/10" />
        </div>
      )}

      {/* Textos */}
      <div className="text-center space-y-2 px-8 max-w-xs">
        <p className="text-white text-xl font-bold leading-tight">
          {msgs.principal}
        </p>
        <p className="text-white/65 text-sm leading-relaxed">
          {msgs.secundario}
        </p>
      </div>

      {/* Barra de progreso animada (solo en estados no-error) */}
      {!esError && (
        <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-[#C9A227]/70 rounded-full animate-bar-slide" />
        </div>
      )}
    </div>
  )
}
