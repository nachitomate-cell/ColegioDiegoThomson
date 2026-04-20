'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/ConsentimientoModal.jsx
// Modal de consentimiento de política de privacidad.
// Se muestra en el primer acceso y cuando la versión de política cambia.
//
// Props:
//   visible    {boolean}   controla el render
//   onAceptar  {function}  callback cuando el usuario acepta (llama al API)
//   loading    {boolean}   deshabilita botón mientras guarda
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import Link from 'next/link'

export default function ConsentimientoModal({ visible, onAceptar, loading = false }) {
  const [aceptaPolitica,   setAceptaPolitica]   = useState(false)
  const [aceptaTratamiento, setAceptaTratamiento] = useState(false)

  const ambosAceptados = aceptaPolitica && aceptaTratamiento

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consentimiento-titulo"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.72)', backdropFilter: 'blur(3px)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">

        {/* Encabezado */}
        <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #f0f0f0' }}>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: '#0D2C54' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h2 id="consentimiento-titulo" className="text-lg font-bold text-gray-900 leading-tight">
            Política de Privacidad
          </h2>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            Antes de continuar, necesitamos tu consentimiento para tratar los datos
            personales del estudiante y del apoderado conforme a la ley chilena.
          </p>
        </div>

        {/* Cuerpo con checkboxes */}
        <div className="px-6 py-5 space-y-4">

          {/* Checkbox 1 — Política */}
          <label className="flex gap-3 cursor-pointer group">
            <div className="mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={aceptaPolitica}
                onChange={(e) => setAceptaPolitica(e.target.checked)}
                className="sr-only"
              />
              <div
                className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: aceptaPolitica ? '#0D2C54' : '#d1d5db',
                  background:  aceptaPolitica ? '#0D2C54' : 'white',
                }}
              >
                {aceptaPolitica && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              He leído y acepto la{' '}
              <Link
                href="/privacidad"
                target="_blank"
                rel="noopener"
                className="font-semibold underline"
                style={{ color: '#0D2C54' }}
              >
                Política de Privacidad
              </Link>{' '}
              del Portal de Pagos del Colegio Diego Thomson.
            </p>
          </label>

          {/* Checkbox 2 — Menores */}
          <label className="flex gap-3 cursor-pointer group">
            <div className="mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={aceptaTratamiento}
                onChange={(e) => setAceptaTratamiento(e.target.checked)}
                className="sr-only"
              />
              <div
                className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: aceptaTratamiento ? '#0D2C54' : '#d1d5db',
                  background:  aceptaTratamiento ? '#0D2C54' : 'white',
                }}
              >
                {aceptaTratamiento && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              Consiento expresamente el tratamiento de los datos personales del
              estudiante menor de edad para las finalidades de gestión de pagos
              escolares descritas en la política.
            </p>
          </label>

          {/* Nota legal */}
          <div className="rounded-lg px-3 py-2.5 text-xs text-gray-500 leading-relaxed"
            style={{ background: '#f8f8f8', border: '1px solid #efefef' }}>
            Tu consentimiento queda registrado con fecha, hora y versión de la política,
            conforme a la Ley 19.628 y Ley 21.719 de Chile.
            Puedes revocar tu consentimiento o ejercer tus derechos ARCO+P escribiendo a{' '}
            <span className="font-medium">privacidad@colegiodiegothomson.cl</span>.
          </div>
        </div>

        {/* Footer con CTA */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={onAceptar}
            disabled={!ambosAceptados || loading}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background:  ambosAceptados && !loading ? '#0D2C54' : '#e5e7eb',
              color:       ambosAceptados && !loading ? 'white'    : '#9ca3af',
              cursor:      ambosAceptados && !loading ? 'pointer'  : 'not-allowed',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: 'transparent' }}
                />
                Registrando consentimiento...
              </span>
            ) : (
              'Continuar al portal'
            )}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            Para acceder al portal debes aceptar ambos puntos.
          </p>
        </div>

      </div>
    </div>
  )
}
