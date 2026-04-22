'use client'

import { useState, useEffect } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { DrawerAyuda } from './DrawerAyuda'

/**
 * Botón flotante del Centro de Ayuda.
 *
 * Props:
 *   rol — 'admin' | 'secretaria' | null
 *         Si es null, el componente no renderiza nada.
 */
export function BotonFlotanteAyuda({ rol }) {
  const [abierto,  setAbierto]  = useState(false)
  const [pulsando, setPulsando] = useState(false)

  // Pulso de atención los primeros 3 s, una sola vez al montar
  useEffect(() => {
    if (!rol) return
    setPulsando(true)
    const t = setTimeout(() => setPulsando(false), 3000)
    return () => clearTimeout(t)
  }, [rol])

  // Solo visible para admin o secretaria
  if (!rol) return null

  return (
    <>
      {/* ── Botón flotante ──────────────────────────────────────────────── */}
      <button
        onClick={() => setAbierto((v) => !v)}
        title="Centro de ayuda"
        aria-label={abierto ? 'Cerrar centro de ayuda' : 'Abrir centro de ayuda'}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={[
          // Posición y tamaño
          'fixed bottom-6 right-6 z-40',
          'w-14 h-14 rounded-full',
          // Color
          'text-white shadow-lg hover:shadow-xl',
          // Transiciones
          'flex items-center justify-center',
          'transition-all duration-200 active:scale-95',
          // Pulse inicial (solo cuando el drawer no está abierto)
          pulsando && !abierto ? 'animate-pulse' : '',
        ].join(' ')}
        style={{ background: '#C9A227' }}
      >
        {abierto
          ? <X          className="w-6 h-6" />
          : <HelpCircle className="w-7 h-7" />
        }
      </button>

      {/* ── Tooltip (visible en hover, solo desktop) ─────────────────────── */}
      <style>{`
        .ayuda-btn-tooltip::after {
          content: 'Centro de ayuda';
          position: fixed;
          bottom: 5.5rem;
          right: 1.5rem;
          background: #0D2C54;
          color: #fff;
          font-size: 0.7rem;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 150ms, transform 150ms;
        }
        .ayuda-btn-tooltip:hover::after {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      {/* ── Drawer ───────────────────────────────────────────────────────── */}
      <DrawerAyuda
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      />
    </>
  )
}
