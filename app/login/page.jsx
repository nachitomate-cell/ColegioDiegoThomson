'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/firebaseConfig'

// ─── Email interno derivado del RUT ──────────────────────────────────────────
// Firebase Auth requiere email. Usamos un dominio interno para derivarlo del RUT.
// El RUT se limpia (sin puntos ni guion) y se usa como base del email.
// Formato: "22.333.444-5" → "223334445@colegiodiegothompson.cl"
const EMAIL_DOMAIN = 'colegiodiegothompson.cl'

// ─── Utilidades RUT ───────────────────────────────────────────────────────────

/**
 * Para validación: elimina puntos pero mantiene el guion.
 * "22.333.444-5" → "22333444-5"
 */
function limpiarParaValidar(rut) {
  return rut.replace(/\./g, '').trim().toUpperCase()
}

/**
 * Para el email: elimina puntos, guion y espacios (igual que migracion.js).
 * "22.333.444-5" → "223334445"
 */
function normalizarRut(rut) {
  return rut.replace(/[.\-\s]/g, '').trim().toUpperCase()
}

/**
 * Valida el dígito verificador chileno.
 * Acepta formatos: "12345678-9", "12.345.678-9", "12345678-K"
 */
function validarRut(rut) {
  const clean = limpiarParaValidar(rut)
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

  const [rut, setRut]                       = useState('')
  const [password, setPassword]             = useState('')
  const [error, setError]                   = useState(null)
  const [loading, setLoading]               = useState(false)
  const [intentosFallidos, setIntentosFallidos] = useState(0)
  const [loadingRecuperar, setLoadingRecuperar] = useState(false)
  const [toast, setToast]                   = useState(null) // { tipo: 'ok'|'error', mensaje: string }

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
      // El ID del documento en "Estudiantes" es el Firebase Auth UID.
      // Si venía de un re-login forzado (?reauth=1), siempre va a cambiar-clave.
      const searchParams  = new URLSearchParams(window.location.search)
      const vieneDeReauth = searchParams.get('reauth') === '1'

      const estudianteSnap = await getDoc(doc(db, 'Estudiantes', uid))
      const requiereCambio = estudianteSnap.exists() && estudianteSnap.data().requiere_cambio_clave === true

      if (vieneDeReauth || requiereCambio) {
        router.push('/cambiar-clave')
      } else {
        router.push('/dashboard')
      }

    } catch (err) {
      // ── 3. Mensajes de error descriptivos ────────────────────────────────────
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          // Firebase v9+ unifica estos errores en auth/invalid-credential
          setError('RUT del estudiante no registrado o contraseña incorrecta.')
          setIntentosFallidos(prev => prev + 1)
          break
        case 'auth/too-many-requests':
          setError('Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta más tarde.')
          setIntentosFallidos(prev => prev + 1)
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

  const mostrarToast = (tipo, mensaje) => {
    setToast({ tipo, mensaje })
    setTimeout(() => setToast(null), 4000)
  }

  const handleRecuperar = async () => {
    if (!rutValido) {
      mostrarToast('error', 'Ingresa un RUT válido antes de recuperar la contraseña.')
      return
    }
    setLoadingRecuperar(true)
    try {
      const res = await fetch('/api/recuperar-clave', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rut }),
      })
      if (!res.ok) throw new Error('server_error')
      // La API siempre responde { ok: true } (anti-enumeración),
      // así que mostramos éxito sin revelar si el RUT existe o no.
      mostrarToast('ok', 'Si el RUT está registrado, el apoderado recibirá un correo con el enlace de recuperación.')
    } catch {
      mostrarToast('error', 'No se pudo enviar el correo. Intenta nuevamente o contacta a secretaría.')
    } finally {
      setLoadingRecuperar(false)
    }
  }

  // Indicador visual: verde si el RUT es válido y tiene al menos 8 chars
  const rutValido = rut.length >= 9 && validarRut(rut)
  const rutInvalido = rut.length >= 9 && !validarRut(rut)

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center p-4"
      style={{ backgroundImage: "url('/fondo1.webp?v=2')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
    >

      {/* Overlay oscuro sobre la imagen de fondo */}
      <div className="absolute inset-0 bg-black/65" />

      {/* Contenido principal — por encima del overlay */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">

        {/* Logo sobre la tarjeta */}
        <div className="mb-6">
          <img
            src="/Logo3.jpg"
            alt="Colegio Diego Thomson"
            className="max-w-[200px] w-auto h-auto drop-shadow-lg"
          />
        </div>

        {/* Tarjeta Glassmorphism */}
        <div className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8">

          {/* Título */}
          <div className="flex items-center gap-3 mb-8">
            <div>
              <p className="text-white font-semibold leading-tight">Portal Escolar</p>
              <p className="text-gray-300 text-xs">Colegio Diego Thomson</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">

            {/* Campo RUT */}
            <div>
              <label className="block text-gray-200 text-xs font-semibold mb-1.5 uppercase tracking-wide">
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
                  className={`w-full bg-white/20 border-2 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none transition-all placeholder:text-white/40 pr-8
                    ${rutValido   ? 'border-green-400 focus:border-green-400 focus:ring-2 focus:ring-green-400/30'     : ''}
                    ${rutInvalido ? 'border-red-400   focus:border-red-400   focus:ring-2 focus:ring-red-400/30'       : ''}
                    ${!rutValido && !rutInvalido ? 'border-white/30 focus:border-accent focus:ring-2 focus:ring-accent/30' : ''}
                  `}
                  placeholder="12.345.678-9"
                />
                {/* Indicador de validez */}
                {rutValido && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">✓</span>
                )}
                {rutInvalido && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 text-sm">✗</span>
                )}
              </div>
              {rutInvalido && (
                <p className="text-red-300 text-xs mt-1">Dígito verificador incorrecto</p>
              )}
            </div>

            {/* Campo contraseña */}
            <div>
              <label className="block text-gray-200 text-xs font-semibold mb-1.5 uppercase tracking-wide">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null) }}
                className="w-full bg-white/20 border-2 border-white/30 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all placeholder:text-white/40"
                placeholder="••••••••"
              />
            </div>

            {/* Error general */}
            {error && (
              <div className="text-red-300 text-xs bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2.5 leading-relaxed">
                {error}
              </div>
            )}

            {/* Bloque de recuperación — aparece tras el primer intento fallido */}
            {intentosFallidos >= 1 && (
              <div className="bg-white/5 border border-white/15 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-gray-300 text-xs">¿Olvidaste tu contraseña?</p>
                <button
                  type="button"
                  onClick={handleRecuperar}
                  disabled={loadingRecuperar}
                  className="shrink-0 text-xs font-semibold text-accent hover:text-accent-hover disabled:opacity-50 transition-colors duration-150 underline underline-offset-2"
                >
                  {loadingRecuperar ? 'Enviando...' : 'Recuperar contraseña'}
                </button>
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading || rutInvalido}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-glow-blue active:scale-[0.98]"
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

        </div>
      </div>

      {/* Toast flotante */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all duration-300
          ${toast.tipo === 'ok'
            ? 'bg-green-900/80 border-green-500/40 text-green-200 backdrop-blur-md'
            : 'bg-red-900/80   border-red-500/40   text-red-200   backdrop-blur-md'
          }`}
        >
          <span>{toast.tipo === 'ok' ? '✓' : '✕'}</span>
          <span>{toast.mensaje}</span>
        </div>
      )}
    </div>
  )
}
