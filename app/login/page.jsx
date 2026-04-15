'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/firebaseConfig'

// ─── Email interno derivado del RUT ──────────────────────────────────────────
// Firebase Auth requiere email. Usamos un dominio interno para derivarlo del RUT.
// El admin crea cuentas con el RUT del ESTUDIANTE como base.
// Formato: "12345678-9" → "12345678-9@portal.cdt"
const EMAIL_DOMAIN = 'portal.cdt'

// ─── Utilidades RUT ───────────────────────────────────────────────────────────

/** Elimina puntos y espacios, mantiene el guión, devuelve mayúsculas */
function normalizarRut(rut) {
  return rut.replace(/\./g, '').trim().toUpperCase()
}

/**
 * Valida el dígito verificador chileno.
 * Acepta formatos: "12345678-9", "12.345.678-9", "12345678-K"
 */
function validarRut(rut) {
  const clean = normalizarRut(rut)
  const guion = clean.lastIndexOf('-')
  if (guion <= 0) return false

  const cuerpo = clean.slice(0, guion)
  const dv     = clean.slice(guion + 1)

  if (!/^\d+$/.test(cuerpo))  return false
  if (!/^[\dKk]$/.test(dv))   return false

  let suma       = 0
  let multiplo   = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma     += parseInt(cuerpo[i]) * multiplo
    multiplo  = multiplo === 7 ? 2 : multiplo + 1
  }

  const resto     = suma % 11
  const dvEsperado = resto === 0 ? '0' : resto === 1 ? 'K' : String(11 - resto)

  return dv.toUpperCase() === dvEsperado
}

/**
 * Auto-formatea mientras el usuario escribe.
 * "123456789" → "12.345.678-9"
 */
function formatearRut(valor) {
  const limpio = valor.replace(/[^0-9kK]/g, '')
  if (limpio.length <= 1) return limpio

  const dv     = limpio.slice(-1).toUpperCase()
  const cuerpo = limpio.slice(0, -1)
  const fmt    = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${fmt}-${dv}`
}

/** Convierte RUT normalizado a email interno para Firebase Auth */
function rutAEmail(rut) {
  return `${normalizarRut(rut).toLowerCase()}@${EMAIL_DOMAIN}`
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()

  const [rut, setRut]           = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  const handleRutChange = (e) => {
    setRut(formatearRut(e.target.value))
    setError(null)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)

    // ── 1. Validar formato y dígito verificador ────────────────────────────────
    if (!validarRut(rut)) {
      setError('RUT inválido. Revisa que el dígito verificador sea correcto.')
      return
    }

    setLoading(true)

    try {
      // ── 2. Derivar email interno y autenticar con Firebase ───────────────────
      // El RUT "12.345.678-9" se convierte a "12345678-9@portal.cdt"
      // Firebase Auth confirma si ese RUT está registrado en el sistema.
      const email      = rutAEmail(rut)
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const uid        = credential.user.uid

      // ── 3. Detectar si es admin ───────────────────────────────────────────────
      const adminSnap = await getDoc(doc(db, 'Admins', uid))
      if (adminSnap.exists()) {
        router.push('/admin')
        return
      }

      // ── 4. Verificar si el estudiante debe cambiar su clave ─────────────────
      // El ID del documento en "Estudiantes" es el Firebase Auth UID
      const estudianteSnap = await getDoc(doc(db, 'Estudiantes', uid))

      if (estudianteSnap.exists() && estudianteSnap.data().requiere_cambio_clave === true) {
        router.push('/cambiar-clave')
      } else {
        router.push('/dashboard')
      }

    } catch (err) {
      // ── 3. Mensajes de error descriptivos ────────────────────────────────────
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          // Firebase v9+ unifica "usuario no existe" y "contraseña incorrecta"
          // en auth/invalid-credential por seguridad (evita enumeración de users)
          setError('RUT del estudiante no registrado o contraseña incorrecta.')
          break
        case 'auth/wrong-password':
          setError('Contraseña incorrecta.')
          break
        case 'auth/too-many-requests':
          setError('Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta más tarde.')
          break
        case 'auth/operation-not-allowed':
          setError('El inicio de sesión con email/contraseña no está habilitado. Actívalo en Firebase Console → Authentication → Sign-in method.')
          break
        case 'auth/network-request-failed':
          setError('Sin conexión a internet. Verifica tu red.')
          break
        default:
          setError(`Error al iniciar sesión (${err.code ?? 'desconocido'}). Intenta nuevamente.`)
      }
    } finally {
      setLoading(false)
    }
  }

  // Indicador visual: verde si el RUT es válido y tiene al menos 8 chars
  const rutValido = rut.length >= 9 && validarRut(rut)
  const rutInvalido = rut.length >= 9 && !validarRut(rut)

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="bg-surface-700 border border-surface-500 rounded-2xl shadow-card-lg w-full max-w-sm p-8 ring-1 ring-black/5">

        {/* Logo + título */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-gray-900 font-bold text-sm shadow-glow-blue">
            C
          </div>
          <div>
            <p className="text-ink-primary font-semibold leading-tight">Portal Escolar</p>
            <p className="text-ink-muted text-xs">Colegio Diego Thomson</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">

          {/* Campo RUT */}
          <div>
            <label className="block text-ink-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">
              RUT del Estudiante
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                value={rut}
                onChange={handleRutChange}
                maxLength={12}
                className={`w-full bg-white border-2 rounded-lg px-3 py-2.5 text-ink-primary text-sm focus:outline-none transition-all placeholder:text-ink-disabled pr-8
                  ${rutValido   ? 'border-paid focus:border-paid focus:ring-2 focus:ring-paid/20'       : ''}
                  ${rutInvalido ? 'border-overdue focus:border-overdue focus:ring-2 focus:ring-overdue/20' : ''}
                  ${!rutValido && !rutInvalido ? 'border-surface-400 focus:border-accent focus:ring-2 focus:ring-accent/20' : ''}
                `}
                placeholder="12.345.678-9"
              />
              {/* Indicador de validez */}
              {rutValido && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-paid text-sm">✓</span>
              )}
              {rutInvalido && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-overdue text-sm">✗</span>
              )}
            </div>
            {rutInvalido && (
              <p className="text-overdue text-xs mt-1">Dígito verificador incorrecto</p>
            )}
          </div>

          {/* Campo contraseña */}
          <div>
            <label className="block text-ink-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null) }}
              className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2.5 text-ink-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-ink-disabled"
              placeholder="••••••••"
            />
          </div>

          {/* Error general */}
          {error && (
            <div className="text-overdue text-xs bg-overdue-bg border border-overdue-border rounded-lg px-3 py-2.5 leading-relaxed">
              {error}
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={loading || rutInvalido}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-semibold py-2.5 rounded-lg transition-all shadow-glow-blue active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                Verificando RUT...
              </span>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        <p className="text-ink-muted text-xs text-center mt-6">
          Si olvidaste tu contraseña, contacta a la secretaría del colegio.
        </p>
      </div>
    </div>
  )
}
