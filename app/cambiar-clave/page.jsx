'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updatePassword, onAuthStateChanged } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/firebaseConfig'

// ─── Requisitos mínimos de contraseña ────────────────────────────────────────
const MIN_LENGTH = 8

function validarPassword(pw) {
  if (pw.length < MIN_LENGTH) return `Mínimo ${MIN_LENGTH} caracteres`
  if (!/[A-Z]/.test(pw))     return 'Debe incluir al menos una letra mayúscula'
  if (!/[0-9]/.test(pw))     return 'Debe incluir al menos un número'
  return null // válida
}

// El email interno usa el dominio portal.cdt → el RUT está antes del "@"
function rutDesdeEmail(email) {
  return email?.split('@')[0]?.toUpperCase() ?? null
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CambiarClavePage() {
  const router = useRouter()

  const [user, setUser]             = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [nueva, setNueva]           = useState('')
  const [confirmar, setConfirmar]   = useState('')
  const [showNueva, setShowNueva]   = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)

  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(false)
  const [loading, setLoading]       = useState(false)

  // ── Protección de ruta: si no hay sesión activa, volver al login ──────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace('/login')
      } else {
        setUser(u)
      }
      setAuthLoading(false)
    })
    return () => unsub()
  }, [router])

  // ── Validaciones en tiempo real ───────────────────────────────────────────
  const errorNueva      = nueva      ? validarPassword(nueva) : null
  const errorConfirmar  = confirmar  ? (confirmar !== nueva ? 'Las contraseñas no coinciden' : null) : null
  const formValido      = !errorNueva && !errorConfirmar && nueva.length > 0 && confirmar.length > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formValido || !user) return

    setError(null)
    setLoading(true)

    try {
      // ── 1. Actualizar la credencial en Firebase Auth ──────────────────────
      await updatePassword(user, nueva)

      // ── 2. Marcar como clave ya cambiada en Firestore ─────────────────────
      const rut = rutDesdeEmail(user.email)
      if (rut) {
        await updateDoc(doc(db, 'Apoderados', rut), {
          requiere_cambio_clave: false,
        })
      }

      // ── 3. Mostrar confirmación y redirigir ───────────────────────────────
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 1500)

    } catch (err) {
      switch (err.code) {
        case 'auth/requires-recent-login':
          setError('Tu sesión expiró. Por favor cierra sesión, vuelve a ingresar y cambia tu clave.')
          break
        case 'auth/weak-password':
          setError('La contraseña es demasiado débil. Elige una más segura.')
          break
        case 'auth/network-request-failed':
          setError('Sin conexión. Verifica tu red e intenta de nuevo.')
          break
        default:
          setError(`Error al cambiar la contraseña (${err.code ?? 'desconocido'}). Intenta nuevamente.`)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Estado de carga inicial (esperando sesión) ────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="bg-surface-700 border border-surface-500 rounded-2xl shadow-card-lg w-full max-w-sm p-8 ring-1 ring-black/5 animate-fade-in">

        {/* Logo + título */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-gray-900 font-bold text-sm shadow-glow-blue">
            C
          </div>
          <div>
            <p className="text-ink-primary font-semibold leading-tight">Portal Escolar</p>
            <p className="text-ink-muted text-xs">Colegio Diego Thomson</p>
          </div>
        </div>

        {/* Banner informativo */}
        <div className="bg-accent/10 border border-accent-border rounded-xl px-4 py-3 mb-6">
          <p className="text-ink-secondary text-sm font-semibold leading-snug">
            Por tu seguridad, debes crear una nueva contraseña personal.
          </p>
          <p className="text-ink-muted text-xs mt-1">
            Mínimo {MIN_LENGTH} caracteres, una mayúscula y un número.
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nueva contraseña */}
          <div>
            <label className="block text-ink-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                type={showNueva ? 'text' : 'password'}
                required
                value={nueva}
                onChange={(e) => { setNueva(e.target.value); setError(null) }}
                className={`w-full bg-white border-2 rounded-lg px-3 py-2.5 text-ink-primary text-sm focus:outline-none transition-all placeholder:text-ink-disabled pr-10
                  ${nueva && !errorNueva ? 'border-paid focus:border-paid focus:ring-2 focus:ring-paid/20' : ''}
                  ${errorNueva          ? 'border-overdue focus:border-overdue focus:ring-2 focus:ring-overdue/20' : ''}
                  ${!nueva              ? 'border-surface-400 focus:border-accent focus:ring-2 focus:ring-accent/20' : ''}
                `}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNueva(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary text-xs select-none"
              >
                {showNueva ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            {errorNueva && (
              <p className="text-overdue text-xs mt-1">{errorNueva}</p>
            )}
            {nueva && !errorNueva && (
              <p className="text-paid text-xs mt-1">Contraseña válida ✓</p>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="block text-ink-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">
              Confirmar contraseña
            </label>
            <div className="relative">
              <input
                type={showConfirmar ? 'text' : 'password'}
                required
                value={confirmar}
                onChange={(e) => { setConfirmar(e.target.value); setError(null) }}
                className={`w-full bg-white border-2 rounded-lg px-3 py-2.5 text-ink-primary text-sm focus:outline-none transition-all placeholder:text-ink-disabled pr-10
                  ${confirmar && !errorConfirmar ? 'border-paid focus:border-paid focus:ring-2 focus:ring-paid/20' : ''}
                  ${errorConfirmar               ? 'border-overdue focus:border-overdue focus:ring-2 focus:ring-overdue/20' : ''}
                  ${!confirmar                   ? 'border-surface-400 focus:border-accent focus:ring-2 focus:ring-accent/20' : ''}
                `}
                placeholder="Repite la nueva contraseña"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmar(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary text-xs select-none"
              >
                {showConfirmar ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            {errorConfirmar && (
              <p className="text-overdue text-xs mt-1">{errorConfirmar}</p>
            )}
          </div>

          {/* Error del servidor */}
          {error && (
            <div className="text-overdue text-xs bg-overdue-bg border border-overdue-border rounded-lg px-3 py-2.5 leading-relaxed">
              {error}
            </div>
          )}

          {/* Éxito */}
          {success && (
            <div className="text-paid text-xs bg-paid-bg border border-paid-border rounded-lg px-3 py-2.5 leading-relaxed">
              Contraseña actualizada. Redirigiendo al panel...
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={loading || !formValido || success}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-semibold py-2.5 rounded-lg transition-all shadow-glow-blue active:scale-[0.98] mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                Guardando...
              </span>
            ) : (
              'Guardar nueva contraseña'
            )}
          </button>
        </form>

      </div>
    </div>
  )
}
