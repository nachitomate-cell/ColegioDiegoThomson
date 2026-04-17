'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/StudentRegistrationForm.jsx
//
// Formulario para matricular estudiantes y vincularlos a su apoderado.
//
// Decisiones de base de datos:
//   • Apoderados/{rutLimpio}: Colección propia indexada por RUT.
//     Permite buscar apoderados existentes y reutilizar sus datos en
//     matrículas futuras sin re-ingresarlos. setDoc con merge:true
//     actualiza sin destruir campos previos.
//   • Estudiantes/{uid}: El ID ES el UID de Firebase Auth para que el
//     login pueda obtener el perfil con un solo getDoc(uid).
//     Guarda apoderado_rut_limpio para cross-reference bidireccional.
//   • writeBatch garantiza que Apoderado + Estudiante se crean juntos.
//     Si el batch falla, la cuenta Auth queda huérfana — en producción
//     se manejaría con Cloud Functions, aquí es aceptable para MVP.
//   • Cuotas se crean fuera del batch porque son 10 docs y el batch
//     tiene límite de 500 operaciones (no se llega, pero es buena práctica
//     separar la lógica principal de los datos derivados).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  collection, doc, getDoc, addDoc, getDocs,
  query, where, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { toast } from 'sonner'
import app, { db, auth } from '../firebase/firebaseConfig'

// ── Constantes ────────────────────────────────────────────────────────────────

const MONTO_BASE = 97_500

const MESES = [
  'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Cursos que imparte el colegio: Kinder → 8° Básico
const CURSOS = [
  'Kinder',
  '1° Básico', '2° Básico', '3° Básico', '4° Básico',
  '5° Básico', '6° Básico', '7° Básico', '8° Básico',
]

// ── Utilidades RUT chileno ────────────────────────────────────────────────────

// Algoritmo módulo 11 del SII — valida dígito verificador.
function validarRut(rut) {
  if (!rut) return false
  const clean = rut.replace(/[.\-\s]/g, '').toUpperCase()
  if (clean.length < 2 || !/^\d+[0-9K]$/.test(clean)) return false
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1)
  let sum = 0, mult = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mult
    mult = mult === 7 ? 2 : mult + 1
  }
  const rem = 11 - (sum % 11)
  const expected = rem === 11 ? '0' : rem === 10 ? 'K' : String(rem)
  return dv === expected
}

// Auto-formatea mientras escribe: "123456789" → "12.345.678-9"
function formatRut(value) {
  const clean = value.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length === 0) return ''
  const body      = clean.slice(0, -1)
  const dv        = clean.slice(-1)
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dv ? `${formatted}-${dv}` : formatted
}

// ID de Firestore: "12.345.678-9" → "123456789"
function limpiarRut(rut) {
  return rut.replace(/[.\-\s]/g, '').toLowerCase()
}

const formatCLP = (n) =>
  Number(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

// ─────────────────────────────────────────────────────────────────────────────
// FORMULARIO (exportación nombrada — úsalo embebido si lo necesitas)
// ─────────────────────────────────────────────────────────────────────────────

export function StudentRegistrationForm({ onSuccess, onCancel }) {

  // ── Estado: apoderado ─────────────────────────────────────────────────────
  const [apoderadoRut,       setApoderadoRut]       = useState('')
  const [apoderadoStatus,    setApoderadoStatus]    = useState(null) // null | 'found' | 'new'
  const [apoderadoData,      setApoderadoData]      = useState({ nombre: '', email: '', telefono: '' })
  const [buscando,           setBuscando]           = useState(false)

  // ── Estado: estudiante ────────────────────────────────────────────────────
  const [rutEstudiante,    setRutEstudiante]    = useState('')
  const [nombreEstudiante, setNombreEstudiante] = useState('')
  const [curso,            setCurso]            = useState('')
  const [tieneBeca,        setTieneBeca]        = useState(false)
  const [montoBeca,        setMontoBeca]        = useState('')

  // ── Estado: CGPA ─────────────────────────────────────────────────────────
  const [tieneCGPA, setTieneCGPA] = useState(false)

  // ── Estado: UI ────────────────────────────────────────────────────────────
  const [errores,   setErrores]   = useState({})
  const [guardando, setGuardando] = useState(false)
  const [exito,     setExito]     = useState(null) // { clave, nombre }

  // ── Buscar apoderado por RUT ──────────────────────────────────────────────
  // Disparado automáticamente por onBlur en el input de RUT.
  // Limpia puntos y guión antes de consultar, asegurando que el ID del
  // documento en Firestore (ej: "123456785") coincida siempre.
  const buscarApoderado = async () => {
    const rut = apoderadoRut.trim()
    if (!rut || buscando) return          // evita disparos dobles

    if (!validarRut(rut)) {
      setErrores(e => ({ ...e, apoderadoRut: 'RUT inválido — revisa el dígito verificador' }))
      return
    }

    setErrores(e => ({ ...e, apoderadoRut: null }))
    setBuscando(true)

    try {
      // Doc ID = RUT limpio en minúsculas sin puntos ni guión
      // Ejemplo: "12.345.678-9" → "123456789"
      const rutLimpio = limpiarRut(rut)
      const snap      = await getDoc(doc(db, 'Apoderados', rutLimpio))

      if (snap.exists()) {
        const d = snap.data()
        setApoderadoData({
          nombre:   d.nombre   ?? '',
          email:    d.email    ?? '',
          telefono: d.telefono ?? '',
        })
        setApoderadoStatus('found')
      } else {
        setApoderadoData({ nombre: '', email: '', telefono: '' })
        setApoderadoStatus('new')
      }
    } catch (err) {
      console.error('[buscarApoderado]', err)
      const msg = err.code === 'unavailable'
        ? 'Sin conexión. Verifica tu red e intenta de nuevo.'
        : 'Error al consultar Firestore. Intenta nuevamente.'
      setErrores(e => ({ ...e, apoderadoRut: msg }))
      toast.error('Error de búsqueda', { description: msg })
    } finally {
      setBuscando(false)
    }
  }

  // ── Validación completa del formulario ────────────────────────────────────
  const validar = () => {
    const errs = {}
    if (!apoderadoStatus)
      errs.apoderadoRut = 'Busca el RUT del apoderado antes de continuar'
    else if (!validarRut(apoderadoRut))
      errs.apoderadoRut = 'RUT de apoderado inválido'

    if (!apoderadoData.nombre.trim())
      errs.apoderadoNombre = 'Nombre del apoderado requerido'

    if (!validarRut(rutEstudiante))
      errs.rutEstudiante = 'RUT de estudiante inválido'

    if (!nombreEstudiante.trim())
      errs.nombreEstudiante = 'Nombre del estudiante requerido'

    if (!curso)
      errs.curso = 'Selecciona un curso'

    if (tieneBeca) {
      const m = parseInt(montoBeca, 10)
      if (isNaN(m) || m <= 0 || m >= MONTO_BASE)
        errs.montoBeca = `Debe ser un monto válido menor a ${formatCLP(MONTO_BASE)}`
    }

    return errs
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validar()
    if (Object.keys(errs).length > 0) { setErrores(errs); return }

    setGuardando(true)
    setErrores({})

    try {
      const rutLimpioEst = limpiarRut(rutEstudiante)
      const rutLimpioApo = limpiarRut(apoderadoRut)
      const emailInterno = `${rutLimpioEst}@colegiodiegothompson.cl`
      const clave        = rutLimpioEst.replace(/[^0-9]/g, '').slice(0, 6)

      if (clave.length < 6) {
        setErrores({ rutEstudiante: 'El RUT debe tener al menos 6 dígitos numéricos.' })
        return
      }

      // ── HITO 1: Prevención de duplicados ──────────────────────────────────
      // Consulta Firestore por rut_limpio ANTES de crear cualquier cuenta.
      // Esto detecta el duplicado con un mensaje claro sin tocar Firebase Auth.
      const dupSnap = await getDocs(
        query(collection(db, 'Estudiantes'), where('rut_limpio', '==', rutLimpioEst))
      )
      if (!dupSnap.empty) {
        setErrores({ rutEstudiante: 'Este RUT ya está matriculado en el sistema.' })
        toast.error('RUT duplicado', {
          description: `El RUT ${rutEstudiante} ya tiene una matrícula activa.`,
        })
        return
      }

      const montoFinal = tieneBeca ? parseInt(montoBeca, 10) : MONTO_BASE

      // ── Crear cuenta Firebase Auth en app secundaria temporal ─────────────
      // Usar app secundaria evita que el admin pierda su sesión activa:
      // createUserWithEmailAndPassword en la app principal loguea al nuevo
      // usuario automáticamente. La app temporal se descarta al terminar.
      const tempAppName = `student-create-${Date.now()}`
      const tempApp     = initializeApp(app.options, tempAppName)
      const tempAuth    = getAuth(tempApp)
      let uid
      try {
        const { user } = await createUserWithEmailAndPassword(tempAuth, emailInterno, clave)
        uid = user.uid
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          // Auth tiene la cuenta pero Firestore no → estado inconsistente.
          // Mostramos error al usuario; en producción esto se investiga con logs.
          setErrores({ rutEstudiante: 'Este RUT ya tiene cuenta pero no está en Firestore. Contacta soporte.' })
          toast.error('Estado inconsistente', {
            description: 'La cuenta existe en Auth pero no en Firestore.',
          })
          return
        }
        throw authErr // re-lanza para el catch externo
      } finally {
        await deleteApp(tempApp)
      }

      // ── writeBatch: Apoderados + Estudiantes de forma atómica ─────────────
      const batch = writeBatch(db)

      batch.set(
        doc(db, 'Apoderados', rutLimpioApo),
        {
          nombre:     apoderadoData.nombre.trim(),
          email:      apoderadoData.email.trim()    || null,
          telefono:   apoderadoData.telefono.trim() || null,
          rut:        apoderadoRut.trim(),
          updated_at: serverTimestamp(),
        },
        { merge: true }
      )

      batch.set(doc(db, 'Estudiantes', uid), {
        nombre:                nombreEstudiante.trim(),
        rut:                   rutEstudiante.trim(),
        rut_limpio:            rutLimpioEst,
        curso,
        apoderado_nombre:      apoderadoData.nombre.trim(),
        apoderado_email:       apoderadoData.email.trim() || null,
        apoderado_rut:         apoderadoRut.trim(),
        apoderado_rut_limpio:  rutLimpioApo,
        telefono:              apoderadoData.telefono.trim() || null,
        es_becado:             tieneBeca,
        monto_cuota:           montoFinal,
        requiere_cambio_clave: true,
        created_at:            serverTimestamp(),
      }, { merge: true })

      await batch.commit()

      // ── Generar 10 cuotas Marzo–Diciembre ─────────────────────────────────
      const anio = new Date().getFullYear()
      const cuotasPromises = MESES.map((mes, i) =>
        addDoc(collection(db, 'Cuotas'), {
          estudiante_id:     uid,
          mes,
          anio,
          monto:             montoFinal,
          estado:            'pendiente',
          fecha_vencimiento: Timestamp.fromDate(new Date(anio, i + 2, 5)),
          comprobante_url:   null,
          fecha_envio:       null,
          fecha_pago:        null,
          created_at:        serverTimestamp(),
        })
      )
      await Promise.all(cuotasPromises)

      // ── Cuota voluntaria CGPA (por familia, una sola vez por año) ────────
      if (tieneCGPA) {
        const conceptoCGPA = `Cuota CGPA ${anio}`
        const cgpaSnap = await getDocs(
          query(collection(db, 'Cuotas'), where('apoderado_id', '==', rutLimpioApo))
        )
        const yaExiste = cgpaSnap.docs.some(d => d.data().concepto === conceptoCGPA)
        if (!yaExiste) {
          await addDoc(collection(db, 'Cuotas'), {
            concepto:      conceptoCGPA,
            monto:         10000,
            estado:        'pendiente',
            es_voluntaria: true,
            apoderado_id:  rutLimpioApo,
            estudiante_id: null,
            anio,
            created_at:    serverTimestamp(),
          })
        }
      }

      toast.success('Alumno matriculado', {
        description: `${nombreEstudiante.trim()} registrado correctamente con ${MESES.length} cuotas.`,
      })
      setExito({ clave, nombre: nombreEstudiante.trim() })
      setTimeout(() => onSuccess?.(), 4000)

    } catch (err) {
      // ── HITO 2: Manejo de errores robusto ─────────────────────────────────
      console.error('[StudentRegistrationForm] handleSubmit:', err)

      const mensajes = {
        'auth/network-request-failed': 'Sin conexión a internet. Verifica tu red e intenta de nuevo.',
        'permission-denied':           'Sin permisos. Recarga la página y vuelve a ingresar.',
        'unavailable':                 'Firestore no disponible. Intenta en unos segundos.',
      }
      const msg = mensajes[err.code] ?? err.message ?? 'Error inesperado al matricular.'

      setErrores({ general: msg })
      toast.error('Error al matricular', { description: msg })
    } finally {
      setGuardando(false)
    }
  }

  const clavePreview = limpiarRut(rutEstudiante).replace(/[^0-9]/g, '').slice(0, 6)

  // ── Pantalla de éxito ─────────────────────────────────────────────────────
  if (exito) {
    return (
      <div className="px-6 py-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-paid-bg border-2 border-paid flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-paid" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-ink-primary font-semibold text-base">¡Alumno matriculado y vinculado exitosamente!</p>
        <p className="text-ink-muted text-sm">
          {exito.nombre} fue registrado y asociado al apoderado.<br />
          Se generaron 10 cuotas (Marzo–Diciembre) automáticamente.
        </p>
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-left">
          <p className="text-amber-800 text-xs font-semibold uppercase tracking-wider mb-2">Credenciales de primer acceso</p>
          <p className="text-ink-secondary text-sm">RUT: <span className="font-mono font-bold">{rutEstudiante}</span></p>
          <p className="text-ink-secondary text-sm">Contraseña temporal: <span className="font-mono font-bold text-amber-700">{exito.clave}</span></p>
          <p className="text-ink-muted text-xs mt-2">El estudiante deberá cambiar su contraseña al primer ingreso.</p>
        </div>
      </div>
    )
  }

  // ── Formulario ────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-5">

      {/* ── APODERADO ──────────────────────────────────────────────────────── */}
      <section>
        <p className="text-ink-muted text-xs font-semibold uppercase tracking-wide mb-3">1. Apoderado</p>

        {/* ── Campo RUT con indicador de búsqueda inline ───────────────────── */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-ink-muted text-xs font-semibold uppercase tracking-wide">
              RUT del apoderado
            </label>
            {/* Pill de estado — aparece solo cuando hay resultado */}
            {buscando && (
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span className="w-3 h-3 border-2 border-ink-muted border-t-transparent rounded-full animate-spin" />
                Buscando...
              </span>
            )}
            {!buscando && apoderadoStatus === 'found' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Apoderado encontrado ✓
              </span>
            )}
            {!buscando && apoderadoStatus === 'new' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nuevo apoderado +
              </span>
            )}
          </div>

          {/* Input RUT + botón respaldo en una fila */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={apoderadoRut}
                onChange={e => {
                  setApoderadoRut(formatRut(e.target.value))
                  setApoderadoStatus(null)
                  setApoderadoData({ nombre: '', email: '', telefono: '' })
                  setErrores(er => ({ ...er, apoderadoRut: null }))
                }}
                onBlur={buscarApoderado}
                placeholder="12.345.678-9"
                maxLength={12}
                className={`w-full bg-white border-2 rounded-lg px-3 py-2 text-sm text-ink-primary
                  focus:outline-none focus:ring-2 transition-all pr-8
                  ${errores.apoderadoRut
                    ? 'border-overdue focus:border-overdue focus:ring-overdue/20'
                    : apoderadoStatus === 'found'
                      ? 'border-green-400 focus:border-green-500 focus:ring-green-200'
                      : apoderadoStatus === 'new'
                        ? 'border-orange-400 focus:border-orange-500 focus:ring-orange-200'
                        : 'border-surface-400 focus:border-accent focus:ring-accent/20'
                  }`}
              />
              {/* Ícono de estado dentro del input (lado derecho) */}
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                {buscando && (
                  <span className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin block" />
                )}
                {!buscando && apoderadoStatus === 'found' && (
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {!buscando && apoderadoStatus === 'new' && (
                  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </div>
            </div>

            {/* Botón de respaldo — útil si el usuario pega el RUT sin hacer blur */}
            <button
              type="button"
              onClick={buscarApoderado}
              disabled={buscando || !apoderadoRut || !validarRut(apoderadoRut)}
              title="Buscar apoderado manualmente"
              className="h-[38px] px-3 bg-surface-600 hover:bg-surface-500 border border-surface-400
                text-ink-secondary text-xs font-medium rounded-lg transition-colors disabled:opacity-40
                flex items-center gap-1.5 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar
            </button>
          </div>

          {errores.apoderadoRut && (
            <p className="text-overdue text-xs mt-1.5">{errores.apoderadoRut}</p>
          )}
        </div>

        {/* Campos del apoderado — visibles solo tras la búsqueda */}
        {apoderadoStatus && (
          <div className="space-y-3">
            <div>
              <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">
                Nombre completo
              </label>
              <input
                required
                value={apoderadoData.nombre}
                onChange={e => setApoderadoData(d => ({ ...d, nombre: e.target.value }))}
                placeholder="Carlos Fuentes Morales"
                className={`w-full bg-white border-2 rounded-lg px-3 py-2 text-sm text-ink-primary
                  focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent/20 transition-all
                  ${errores.apoderadoNombre ? 'border-overdue' : 'border-surface-400'}`}
              />
              {errores.apoderadoNombre && (
                <p className="text-overdue text-xs mt-1">{errores.apoderadoNombre}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={apoderadoData.email}
                  onChange={e => setApoderadoData(d => ({ ...d, email: e.target.value }))}
                  placeholder="correo@gmail.com"
                  className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm
                    text-ink-primary focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">
                  Teléfono
                </label>
                <input
                  value={apoderadoData.telefono}
                  onChange={e => setApoderadoData(d => ({ ...d, telefono: e.target.value }))}
                  placeholder="+56 9 1234 5678"
                  className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm
                    text-ink-primary focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent/20 transition-all"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <hr className="border-surface-500" />

      {/* ── ESTUDIANTE ─────────────────────────────────────────────────────── */}
      <section>
        <p className="text-ink-muted text-xs font-semibold uppercase tracking-wide mb-3">2. Estudiante</p>

        <div className="space-y-3">
          <div>
            <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">
              Nombre completo
            </label>
            <input
              required
              value={nombreEstudiante}
              onChange={e => setNombreEstudiante(e.target.value)}
              placeholder="Sofía Fuentes Rojas"
              className={`w-full bg-white border-2 rounded-lg px-3 py-2 text-sm text-ink-primary
                focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent/20 transition-all
                ${errores.nombreEstudiante ? 'border-overdue' : 'border-surface-400'}`}
            />
            {errores.nombreEstudiante && (
              <p className="text-overdue text-xs mt-1">{errores.nombreEstudiante}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">
                RUT del estudiante
              </label>
              <input
                required
                value={rutEstudiante}
                onChange={e => setRutEstudiante(formatRut(e.target.value))}
                placeholder="20.123.456-5"
                className={`w-full bg-white border-2 rounded-lg px-3 py-2 text-sm text-ink-primary
                  focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent/20 transition-all
                  ${errores.rutEstudiante ? 'border-overdue' : 'border-surface-400'}`}
              />
              {errores.rutEstudiante
                ? <p className="text-overdue text-xs mt-1">{errores.rutEstudiante}</p>
                : clavePreview.length >= 6 && (
                    <p className="text-ink-muted text-xs mt-1">
                      Clave temporal: <span className="font-mono font-bold text-ink-secondary">{clavePreview}</span>
                    </p>
                  )
              }
            </div>

            <div>
              <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">
                Curso
              </label>
              <select
                required
                value={curso}
                onChange={e => setCurso(e.target.value)}
                className={`w-full bg-white border-2 rounded-lg px-3 py-2 text-sm text-ink-primary
                  focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent/20 transition-all
                  ${errores.curso ? 'border-overdue' : 'border-surface-400'}`}
              >
                <option value="">Seleccionar...</option>
                {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errores.curso && (
                <p className="text-overdue text-xs mt-1">{errores.curso}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <hr className="border-surface-500" />

      {/* ── BECA ───────────────────────────────────────────────────────────── */}
      <section>
        <div className={`rounded-xl border-2 transition-colors px-4 py-3
          ${tieneBeca ? 'border-amber-300 bg-amber-50' : 'border-surface-400 bg-surface-700'}`}
        >
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={tieneBeca}
              onClick={() => {
                setTieneBeca(v => {
                  if (!v) setMontoBeca('70000') // valor sugerido al activar
                  else    setMontoBeca('')
                  return !v
                })
              }}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0
                ${tieneBeca ? 'bg-amber-400' : 'bg-surface-400'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                ${tieneBeca ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
            <div>
              <p className="text-ink-primary text-sm font-semibold">Beca / Arancel diferenciado</p>
              <p className="text-ink-muted text-xs">
                Valor estándar: <span className="font-mono">{formatCLP(MONTO_BASE)}</span>/mes
              </p>
            </div>
          </label>

          {tieneBeca && (
            <div className="mt-3">
              <label className="block text-amber-700 text-xs font-semibold mb-1 uppercase tracking-wide">
                Valor de cuota mensual ($)
              </label>
              <input
                required
                type="number"
                min={1}
                max={MONTO_BASE - 1}
                value={montoBeca}
                onChange={e => setMontoBeca(e.target.value)}
                placeholder="Ej: 75000"
                className="w-full bg-white border-2 border-amber-300 rounded-lg px-3 py-2 text-sm
                  text-ink-primary focus:outline-none focus:border-amber-400 focus:ring-2
                  focus:ring-amber-200 transition-all"
              />
              {errores.montoBeca && (
                <p className="text-overdue text-xs mt-1">{errores.montoBeca}</p>
              )}
              {montoBeca && !isNaN(parseInt(montoBeca)) && (() => {
                const monto      = parseInt(montoBeca)
                const descuento  = MONTO_BASE - monto
                const porcentaje = Math.round((descuento / MONTO_BASE) * 100)
                const valido     = monto > 0 && monto < MONTO_BASE
                return valido ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                        ↓ {porcentaje}% menos que la mensualidad estándar
                      </span>
                      <span className="text-amber-600 text-xs">
                        Descuento: <span className="font-semibold">{formatCLP(descuento)}/mes</span>
                      </span>
                    </div>
                    <p className="text-amber-700 text-xs">
                      10 cuotas · Total año: <span className="font-semibold">{formatCLP(monto * 10)}</span>
                      <span className="text-amber-500 ml-1.5">(ahorro anual: {formatCLP(descuento * 10)})</span>
                    </p>
                  </div>
                ) : null
              })()}
            </div>
          )}
        </div>
      </section>

      {/* ── CUOTA CGPA ─────────────────────────────────────────────────────── */}
      <section>
        <div className={`rounded-xl border-2 transition-colors px-4 py-3
          ${tieneCGPA ? 'border-blue-300 bg-blue-50' : 'border-surface-400 bg-surface-700'}`}
        >
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={tieneCGPA}
              onClick={() => setTieneCGPA(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0
                ${tieneCGPA ? 'bg-blue-500' : 'bg-surface-400'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                ${tieneCGPA ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
            <div>
              <p className="text-ink-primary text-sm font-semibold">Cuota Voluntaria CGPA</p>
              <p className="text-ink-muted text-xs">
                Aporte familiar · <span className="font-mono">$10.000</span> — una vez por familia al año
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* ── Error general ──────────────────────────────────────────────────── */}
      {errores.general && (
        <div className="text-overdue text-xs bg-overdue-bg border border-overdue-border rounded-lg px-3 py-2">
          {errores.general}
        </div>
      )}

      {/* ── Botones ────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={guardando}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium text-ink-secondary
            bg-surface-600 hover:bg-surface-500 border border-surface-400 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando || !apoderadoStatus}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-900
            bg-accent hover:bg-accent-hover disabled:opacity-40 transition-all active:scale-[0.98]"
        >
          {guardando ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
              Procesando...
            </span>
          ) : 'Matricular estudiante'}
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL WRAPPER (exportación default — usado por admin/page.jsx)
// ─────────────────────────────────────────────────────────────────────────────

export default function ModalRegistrarEstudiante({ onClose, onSuccess }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white border border-surface-400 rounded-2xl shadow-card-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-500 sticky top-0 bg-white z-10">
          <h2 className="text-ink-primary font-semibold text-base">Matricular nuevo estudiante</h2>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink-primary text-xl leading-none w-7 h-7 flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>
        <StudentRegistrationForm
          onSuccess={() => { onSuccess?.(); onClose() }}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
