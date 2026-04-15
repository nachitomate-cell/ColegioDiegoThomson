'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  collection, query, where, onSnapshot, getDocs, addDoc,
  doc, updateDoc, getDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { signOut, createUserWithEmailAndPassword } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { db, auth } from '../../firebase/firebaseConfig'
import { useAuth }   from '../../hooks/useAuth'
import { exportarCuotasExcel, exportarApoderadosExcel } from '../../lib/exportarExcel'
import { LOGO_SRC } from '../../lib/logo'


// ─── HELPERS ──────────────────────────────────────────────────────────────────

const formatCLP = (monto) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(monto)

const formatFecha = (date) => {
  if (!date) return '—'
  return date.toLocaleDateString('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const formatHora = (date) => {
  if (!date) return ''
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

// ── Valor base mensual (fácil de cambiar) ─────────────────────────────────────
const MONTO_BASE_CUOTA = 87_000

const MESES = [
  'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const estadoLabel = {
  pendiente:   'Pendiente',
  atrasado:    'Atrasado',
  en_revision: 'En revisión',
  pagado:      'Pagado',
}

const estadoColor = {
  pendiente:   'bg-pending-bg text-pending border-pending-border',
  atrasado:    'bg-overdue-bg text-overdue border-overdue-border',
  en_revision: 'bg-review-bg text-review border-review-border',
  pagado:      'bg-paid-bg text-paid border-paid-border',
}


// ─── SKELETON ─────────────────────────────────────────────────────────────────

function Sk({ className = '' }) {
  return <div className={`bg-surface-600 rounded-lg animate-pulse ${className}`} />
}


// ─── STAT CARD ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color = 'text-ink-primary', icon, subtext }) {
  return (
    <div className="bg-white border border-surface-500 rounded-xl px-5 py-4 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`${color} text-2xl font-bold leading-none`}>{value}</p>
      {subtext && <p className="text-ink-muted text-xs mt-1.5">{subtext}</p>}
    </div>
  )
}


// ─── ESTADO BADGE ─────────────────────────────────────────────────────────────

function EstadoBadge({ estado }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${estadoColor[estado] ?? ''}`}>
      {estadoLabel[estado] ?? estado}
    </span>
  )
}


// ─── TABS ─────────────────────────────────────────────────────────────────────

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-surface-800 border border-surface-500 rounded-lg p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative px-4 py-2 rounded-md text-sm font-medium transition-all
            ${active === tab.id
              ? 'bg-white text-ink-primary shadow-sm'
              : 'text-ink-muted hover:text-ink-secondary'
            }`}
        >
          {tab.label}
          {tab.count != null && (
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold
              ${active === tab.id ? 'bg-accent/20 text-accent-hover' : 'bg-surface-500 text-ink-muted'}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}


// ─── SEARCH BAR ───────────────────────────────────────────────────────────────

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-surface-400 rounded-lg pl-10 pr-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-disabled focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
      />
    </div>
  )
}


// ─── MODAL COMPROBANTE ────────────────────────────────────────────────────────

function ModalComprobante({ url, onClose }) {
  const [cargando, setCargando] = useState(true)
  const esImagen = /\.(jpg|jpeg|png|gif|webp|jfif)/i.test(url) || /image%2F/.test(url) || (/alt=media/.test(url) && !/pdf/.test(url))
  const esPDF = /\.pdf/i.test(url) || /pdf/.test(decodeURIComponent(url))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white border border-surface-400 rounded-2xl shadow-card-lg w-full max-w-2xl max-h-[92vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-500 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-review" />
            <h2 className="text-ink-primary font-semibold text-sm">Comprobante de pago</h2>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs bg-surface-600 hover:bg-surface-500 text-ink-secondary px-3 py-1.5 rounded-md border border-surface-400 transition-colors">
              Abrir ↗
            </a>
            <button onClick={onClose} className="text-ink-muted hover:text-ink-primary text-xl leading-none transition-colors w-7 h-7 flex items-center justify-center">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[320px]">
          {esImagen ? (
            <div className="relative w-full flex items-center justify-center">
              {cargando && <div className="absolute inset-0 flex items-center justify-center bg-surface-800 rounded-lg"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}
              <img src={url} alt="Comprobante" onLoad={() => setCargando(false)} className="max-w-full max-h-[72vh] object-contain rounded-lg" />
            </div>
          ) : esPDF ? (
            <iframe src={url} title="Comprobante PDF" className="w-full rounded-lg border border-surface-500" style={{ height: '72vh' }} onLoad={() => setCargando(false)} />
          ) : (
            <div className="text-center space-y-4 py-8">
              <p className="text-ink-secondary text-sm">No se puede previsualizar este archivo.</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-sm">Descargar comprobante</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ─── MODAL REGISTRAR APODERADO ────────────────────────────────────────────────

function ModalRegistrarApoderado({ onClose, onSuccess }) {
  const [form, setForm] = useState({ nombre: '', rut: '', email: '', telefono: '', password: '', curso: '', nombreEstudiante: '' })
  const [tieneBeca, setTieneBeca] = useState(false)
  const [montoBeca, setMontoBeca] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(false)

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)

    try {
      // Validar monto beca si aplica
      const montoFinal = tieneBeca
        ? parseInt(montoBeca, 10)
        : MONTO_BASE_CUOTA
      if (tieneBeca && (isNaN(montoFinal) || montoFinal <= 0)) {
        setError('Ingresa un valor de cuota válido para la beca.')
        setGuardando(false)
        return
      }

      // 1. Crear el usuario en Firebase Auth con email basado en RUT
      // Mismo formato que usa el login: eliminar puntos, mantener guión, minúsculas
      const rutLimpio = form.rut.replace(/\./g, '').trim().toLowerCase()
      const emailInterno = `${rutLimpio}@portal.cdt`

      // Guardar el auth actual del admin para no desloguearnos
      const adminUser = auth.currentUser

      const { user: nuevoUser } = await createUserWithEmailAndPassword(auth, emailInterno, form.password)

      // 2. Crear doc del Apoderado en Firestore
      await updateDoc(doc(db, 'Apoderados', nuevoUser.uid), {}).catch(() => {})
      const apoderadoRef = doc(db, 'Apoderados', nuevoUser.uid)
      await import('firebase/firestore').then(({ setDoc }) =>
        setDoc(apoderadoRef, {
          nombre:          form.nombre,
          email:           form.email || null,
          telefono:        form.telefono || null,
          rut:             form.rut,
          estudiantes_ids: [],
          created_at:      serverTimestamp(),
        })
      )

      // 3. Crear doc del Estudiante (guarda si tiene beca y el monto acordado)
      const estRef = await addDoc(collection(db, 'Estudiantes'), {
        nombre:        form.nombreEstudiante,
        curso:         form.curso,
        apoderado_uid: nuevoUser.uid,
        beca:          tieneBeca,
        monto_cuota:   montoFinal,
        created_at:    serverTimestamp(),
      })

      // 4. Vincular estudiante al apoderado
      await updateDoc(apoderadoRef, {
        estudiantes_ids: [estRef.id],
      })

      // 5. Generar las 10 cuotas Marzo–Diciembre con el monto correspondiente
      const anio = new Date().getFullYear()
      for (let i = 0; i < MESES.length; i++) {
        const mesIdx = i + 2 // Marzo = índice 2 (0-based), Diciembre = 11
        await addDoc(collection(db, 'Cuotas'), {
          estudiante_id:    estRef.id,
          mes:              MESES[i],
          anio:             anio,
          monto:            montoFinal,
          estado:           'pendiente',
          fecha_vencimiento: Timestamp.fromDate(new Date(anio, mesIdx, 5)),
          comprobante_url:  null,
          fecha_envio:      null,
          fecha_pago:       null,
          created_at:       serverTimestamp(),
        })
      }

      setExito(true)
      setTimeout(() => { onSuccess?.(); onClose() }, 1500)

    } catch (err) {
      console.error('[ModalRegistrar] Error:', err)
      if (err.code === 'auth/email-already-in-use') {
        setError('Ya existe un apoderado registrado con ese RUT.')
      } else {
        setError(err.message)
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={(e) => e.target === e.currentTarget && !guardando && onClose()}>
      <div className="bg-white border border-surface-400 rounded-2xl shadow-card-lg w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-500">
          <h2 className="text-ink-primary font-semibold text-base">Registrar nuevo apoderado</h2>
          <button onClick={onClose} disabled={guardando} className="text-ink-muted hover:text-ink-primary text-xl leading-none">×</button>
        </div>

        {exito ? (
          <div className="px-6 py-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-paid-bg border-2 border-paid flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-paid" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-ink-primary font-semibold">¡Apoderado registrado!</p>
            <p className="text-ink-muted text-sm">Se crearon las 10 cuotas del año automáticamente.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <p className="text-ink-muted text-xs mb-2">Esto creará una cuenta de login + un estudiante vinculado con sus 10 cuotas anuales.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Nombre apoderado</label>
                <input required value={form.nombre} onChange={(e) => handleChange('nombre', e.target.value)} className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" placeholder="Carlos Fuentes" />
              </div>
              <div>
                <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">RUT</label>
                <input required value={form.rut} onChange={(e) => handleChange('rut', e.target.value)} className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" placeholder="12.345.678-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Email (opcional)</label>
                <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" placeholder="correo@gmail.com" />
              </div>
              <div>
                <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Teléfono</label>
                <input value={form.telefono} onChange={(e) => handleChange('telefono', e.target.value)} className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" placeholder="+56 9 1234 5678" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Contraseña</label>
                <input required type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} minLength={6} className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" placeholder="Mín. 6 caracteres" />
              </div>
            </div>

            <hr className="border-surface-500" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Nombre estudiante</label>
                <input required value={form.nombreEstudiante} onChange={(e) => handleChange('nombreEstudiante', e.target.value)} className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" placeholder="Sofía Fuentes" />
              </div>
              <div>
                <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Curso</label>
                <input required value={form.curso} onChange={(e) => handleChange('curso', e.target.value)} className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" placeholder="7° Básico A" />
              </div>
            </div>

            {/* ── Beca / Arancel Diferenciado ─────────────────────────────── */}
            <div className={`rounded-xl border-2 transition-colors px-4 py-3 ${tieneBeca ? 'border-amber-300 bg-amber-50' : 'border-surface-400 bg-surface-700'}`}>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => { setTieneBeca(v => !v); setMontoBeca('') }}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${tieneBeca ? 'bg-amber-400' : 'bg-surface-400'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tieneBeca ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <div>
                  <p className="text-ink-primary text-sm font-semibold">Beca / Arancel diferenciado</p>
                  <p className="text-ink-muted text-xs">El valor estándar es {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(MONTO_BASE_CUOTA)}/mes</p>
                </div>
              </label>

              {tieneBeca && (
                <div className="mt-3">
                  <label className="block text-amber-700 text-xs font-semibold mb-1 uppercase tracking-wide">Nuevo valor de cuota mensual ($)</label>
                  <input
                    required={tieneBeca}
                    type="number"
                    min={1}
                    value={montoBeca}
                    onChange={(e) => setMontoBeca(e.target.value)}
                    className="w-full bg-white border-2 border-amber-300 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition-all"
                    placeholder="Ej: 50000"
                  />
                  {montoBeca && !isNaN(parseInt(montoBeca)) && (
                    <p className="text-amber-700 text-xs mt-1">
                      Se generarán 10 cuotas de {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(parseInt(montoBeca))} c/u · Total año: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(parseInt(montoBeca) * 10)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="text-overdue text-xs bg-overdue-bg border border-overdue-border rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-ink-secondary bg-surface-600 hover:bg-surface-500 border border-surface-400 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-900 bg-accent hover:bg-accent-hover disabled:opacity-50 transition-all">
                {guardando ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    Registrando...
                  </span>
                ) : 'Registrar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}


// ─── FILA DE CUOTA (REVISIÓN) ─────────────────────────────────────────────────

function FilaCuotaRevision({ cuota, nombreEstudiante, onVerComprobante, onAprobar, onRechazar }) {
  const [confirmando, setConfirmando] = useState(null)
  const [procesando, setProcesando]   = useState(false)

  const handleAccion = async (accion) => {
    if (confirmando !== accion) { setConfirmando(accion); return }
    setProcesando(true)
    try {
      accion === 'aprobar' ? await onAprobar(cuota.id) : await onRechazar(cuota.id)
    } finally { setProcesando(false); setConfirmando(null) }
  }

  return (
    <tr className="border-b border-surface-500 hover:bg-surface-600/50 transition-colors">
      <td className="px-4 py-3.5">
        <p className="text-ink-primary text-sm font-medium">{cuota.mes} {cuota.anio}</p>
      </td>
      <td className="px-4 py-3.5">
        {nombreEstudiante ? <p className="text-ink-primary text-sm">{nombreEstudiante}</p> : <Sk className="w-28 h-4" />}
      </td>
      <td className="px-4 py-3.5 text-ink-secondary text-sm font-mono whitespace-nowrap">{formatCLP(cuota.monto)}</td>
      <td className="px-4 py-3.5 text-ink-secondary text-sm hidden md:table-cell">{formatFecha(cuota.fechaVencimiento)}</td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        {cuota.fechaEnvio ? (
          <><p className="text-ink-secondary text-sm">{formatFecha(cuota.fechaEnvio)}</p><p className="text-ink-muted text-xs">{formatHora(cuota.fechaEnvio)}</p></>
        ) : <span className="text-ink-muted text-sm">—</span>}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => onVerComprobante(cuota.comprobanteUrl)} disabled={!cuota.comprobanteUrl || procesando} className="text-xs bg-surface-600 hover:bg-surface-500 text-ink-secondary px-2.5 py-1.5 rounded-md border border-surface-400 transition-colors disabled:opacity-40">Ver</button>
          {confirmando === 'aprobar' ? (
            <div className="flex items-center gap-1">
              <button onClick={() => handleAccion('aprobar')} disabled={procesando} className="text-xs bg-paid text-white px-2.5 py-1.5 rounded-md font-semibold">{procesando ? '…' : '¿Aprobar?'}</button>
              <button onClick={() => setConfirmando(null)} className="text-xs bg-surface-600 text-ink-muted px-2 py-1.5 rounded-md border border-surface-400">✕</button>
            </div>
          ) : (
            <button onClick={() => handleAccion('aprobar')} disabled={procesando} className="text-xs bg-paid-bg hover:bg-paid text-paid hover:text-white px-2.5 py-1.5 rounded-md border border-paid-border font-medium transition-all disabled:opacity-40">Aprobar</button>
          )}
          {confirmando === 'rechazar' ? (
            <div className="flex items-center gap-1">
              <button onClick={() => handleAccion('rechazar')} disabled={procesando} className="text-xs bg-overdue text-white px-2.5 py-1.5 rounded-md font-semibold">{procesando ? '…' : '¿Rechazar?'}</button>
              <button onClick={() => setConfirmando(null)} className="text-xs bg-surface-600 text-ink-muted px-2 py-1.5 rounded-md border border-surface-400">✕</button>
            </div>
          ) : (
            <button onClick={() => handleAccion('rechazar')} disabled={procesando} className="text-xs bg-overdue-bg hover:bg-overdue text-overdue hover:text-white px-2.5 py-1.5 rounded-md border border-overdue-border font-medium transition-all disabled:opacity-40">Rechazar</button>
          )}
        </div>
      </td>
    </tr>
  )
}


// ═════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL DEL ADMIN
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [esAdmin, setEsAdmin]           = useState(false)
  const [adminChecked, setAdminChecked] = useState(false)

  // ── Estado global ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState('revision')
  const [busqueda, setBusqueda]             = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('todos')

  // ── Data: comprobantes en revisión ──────────────────────────────────────────
  const [cuotasRevision, setCuotasRevision] = useState([])
  const [loadingRevision, setLoadingRevision] = useState(true)

  // ── Data: TODAS las cuotas ──────────────────────────────────────────────────
  const [todasCuotas, setTodasCuotas]       = useState([])
  const [loadingTodas, setLoadingTodas]     = useState(true)

  // ── Data: apoderados ──────────────────────────────────────────────────────
  const [apoderados, setApoderados]         = useState([])
  const [loadingApoderados, setLoadingApoderados] = useState(true)

  // ── Mapas auxiliares ──────────────────────────────────────────────────────
  const [estudiantesMap, setEstudiantesMap] = useState({})
  const fetchedIdsRef = useRef(new Set())

  // ── Modales ────────────────────────────────────────────────────────────────
  const [modalUrl, setModalUrl]               = useState(null)
  const [modalRegistrar, setModalRegistrar]   = useState(false)
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState(false)
  const [recordatorioEnviado, setRecordatorioEnviado]   = useState(false)

  // ── Mapa de admins (para auditoría) ────────────────────────────────────────
  const [adminsMap, setAdminsMap] = useState({})

  const [error, setError] = useState(null)

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    getDoc(doc(db, 'Admins', user.uid)).then((snap) => {
      setEsAdmin(snap.exists())
      setAdminChecked(true)
    })
  }, [user, authLoading, router])

  // ── Batch fetch student names ──────────────────────────────────────────────
  const fetchEstudiantes = async (ids) => {
    const nuevos = ids.filter((id) => !fetchedIdsRef.current.has(id))
    if (nuevos.length === 0) return
    nuevos.forEach((id) => fetchedIdsRef.current.add(id))
    try {
      const entries = {}
      for (let i = 0; i < nuevos.length; i += 30) {
        const chunk = nuevos.slice(i, i + 30)
        const q = query(collection(db, 'Estudiantes'), where('__name__', 'in', chunk))
        const snapshot = await getDocs(q)
        snapshot.forEach((snap) => { entries[snap.id] = snap.data().nombre })
      }
      setEstudiantesMap((prev) => ({ ...prev, ...entries }))
    } catch (e) {
      console.error('[AdminPage] Error al cargar estudiantes:', e)
    }
  }

  // ── Listener: cuotas en revisión ────────────────────────────────────────────
  useEffect(() => {
    if (!esAdmin) return
    const q = query(collection(db, 'Cuotas'), where('estado', '==', 'en_revision'))
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const f = d.data()
        return {
          id: d.id, estudianteId: f.estudiante_id, mes: f.mes, anio: f.anio, monto: f.monto,
          fechaVencimiento: f.fecha_vencimiento?.toDate(), fechaEnvio: f.fecha_envio?.toDate(),
          comprobanteUrl: f.comprobante_url ?? null, estado: f.estado,
        }
      }).sort((a, b) => (b.fechaEnvio ?? 0) - (a.fechaEnvio ?? 0))
      setCuotasRevision(data)
      setLoadingRevision(false)
      fetchEstudiantes([...new Set(data.map(c => c.estudianteId))])
    }, (err) => { setError(err.message); setLoadingRevision(false) })
    return () => unsub()
  }, [esAdmin])

  // ── Listener: TODAS las cuotas ──────────────────────────────────────────────
  useEffect(() => {
    if (!esAdmin) return
    const unsub = onSnapshot(collection(db, 'Cuotas'), (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const f = d.data()
        return {
          id: d.id, estudianteId: f.estudiante_id, mes: f.mes, anio: f.anio, monto: f.monto,
          fechaVencimiento: f.fecha_vencimiento?.toDate(), fechaEnvio: f.fecha_envio?.toDate(),
          fechaPago: f.fecha_pago?.toDate(), comprobanteUrl: f.comprobante_url ?? null, estado: f.estado,
          aprobadoPor: f.aprobado_por ?? null,
        }
      }).sort((a, b) => (a.fechaVencimiento ?? 0) - (b.fechaVencimiento ?? 0))
      setTodasCuotas(data)
      setLoadingTodas(false)
      fetchEstudiantes([...new Set(data.map(c => c.estudianteId))])
    })
    return () => unsub()
  }, [esAdmin])

  // ── Fetch: apoderados ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!esAdmin) return
    const unsub = onSnapshot(collection(db, 'Apoderados'), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setApoderados(data)
      setLoadingApoderados(false)
    })
    return () => unsub()
  }, [esAdmin])

  // ── Acciones ───────────────────────────────────────────────────────────────
  const handleAprobar = async (cuotaId) => {
    await updateDoc(doc(db, 'Cuotas', cuotaId), {
      estado: 'pagado', fecha_pago: serverTimestamp(),
      aprobado_por: user.uid, aprobado_nombre: user.email?.split('@')[0] ?? 'admin',
    })
  }
  const handleRechazar = async (cuotaId) => {
    await updateDoc(doc(db, 'Cuotas', cuotaId), {
      estado: 'pendiente', comprobante_url: null, fecha_envio: null,
    })
  }

  // ── Recordatorio masivo ────────────────────────────────────────────────────
  const handleRecordatorioMasivo = async () => {
    setEnviandoRecordatorio(true)
    try {
      // Obtener cuotas atrasadas con sus estudiantes y apoderados
      const cuotasAtrasadas = todasCuotas.filter(c => c.estado === 'atrasado')
      const estudianteIds = [...new Set(cuotasAtrasadas.map(c => c.estudianteId))]

      // Buscar apoderados que tengan teléfono
      const apoderadosConTel = apoderados.filter(a => a.telefono)
      const mensajesGenerados = []

      for (const a of apoderadosConTel) {
        const estIds = a.estudiantes_ids ?? []
        const cuotasDeEste = cuotasAtrasadas.filter(c => estIds.includes(c.estudianteId))
        if (cuotasDeEste.length > 0) {
          const nombres = cuotasDeEste.map(c => `${c.mes} ${c.anio}`).join(', ')
          mensajesGenerados.push({ telefono: a.telefono, nombre: a.nombre, cuotas: nombres, total: cuotasDeEste.length })
        }
      }

      // Simular el envío (en producción se conectaría a una API de WhatsApp Business)
      console.log('[Recordatorio] Mensajes generados:', mensajesGenerados)

      // Registrar la acción
      await addDoc(collection(db, 'Logs'), {
        accion: 'recordatorio_masivo',
        admin_uid: user.uid,
        total_notificados: mensajesGenerados.length,
        fecha: serverTimestamp(),
      }).catch(() => {}) // Si la colección Logs no existe, ignoramos

      setRecordatorioEnviado(true)
      setTimeout(() => setRecordatorioEnviado(false), 4000)
    } catch (err) {
      console.error('[Recordatorio] Error:', err)
    } finally {
      setEnviandoRecordatorio(false)
    }
  }

  // ── WhatsApp helper ────────────────────────────────────────────────────────
  const abrirWhatsApp = (telefono, nombre, cuotasPendientes = '') => {
    const tel = telefono.replace(/[^\d+]/g, '')
    const msg = encodeURIComponent(
      `Hola ${nombre.split(' ')[0]}, te escribimos del *Colegio Diego Thomson* 🏫.\n\n` +
      `Hemos notado que tienes cuotas pendientes de pago${cuotasPendientes ? `: ${cuotasPendientes}` : ''}.\n\n` +
      `Te recordamos que puedes pagar directamente desde el Portal Escolar:\n` +
      `👉 ${typeof window !== 'undefined' ? window.location.origin : ''}/login\n\n` +
      `Si ya realizaste el pago, por favor sube tu comprobante al portal. ¡Gracias! 🙏`
    )
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank')
  }

  // ── Stats calculados ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = todasCuotas.length
    const pagadas    = todasCuotas.filter(c => c.estado === 'pagado').length
    const pendientes = todasCuotas.filter(c => c.estado === 'pendiente').length
    const atrasadas  = todasCuotas.filter(c => c.estado === 'atrasado').length
    const enRevision = cuotasRevision.length
    const montoPagado   = todasCuotas.filter(c => c.estado === 'pagado').reduce((a, c) => a + c.monto, 0)
    const montoPendiente = todasCuotas.filter(c => c.estado !== 'pagado').reduce((a, c) => a + c.monto, 0)
    const pctCobrado = total > 0 ? Math.round((pagadas / total) * 100) : 0
    return { total, pagadas, pendientes, atrasadas, enRevision, montoPagado, montoPendiente, pctCobrado }
  }, [todasCuotas, cuotasRevision])

  // ── Filtro de cuotas para la pestaña "Todas" ───────────────────────────────
  const cuotasFiltradas = useMemo(() => {
    let lista = todasCuotas
    if (filtroEstado !== 'todos') lista = lista.filter(c => c.estado === filtroEstado)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(c => {
        const nombre = estudiantesMap[c.estudianteId]?.toLowerCase() ?? ''
        return nombre.includes(q) || c.mes.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      })
    }
    return lista
  }, [todasCuotas, filtroEstado, busqueda, estudiantesMap])

  // ── Filtro de apoderados ───────────────────────────────────────────────────
  const apoderadosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return apoderados
    const q = busqueda.toLowerCase()
    return apoderados.filter(a => a.nombre?.toLowerCase().includes(q) || a.rut?.toLowerCase().includes(q))
  }, [apoderados, busqueda])


  // ── Guards ─────────────────────────────────────────────────────────────────
  if (authLoading || !adminChecked) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-ink-muted text-sm">Verificando permisos...</p>
      </div>
    )
  }

  if (!esAdmin) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="bg-white border border-overdue-border rounded-2xl p-10 max-w-sm w-full text-center space-y-4 shadow-card-lg">
          <div className="w-12 h-12 rounded-full bg-overdue-bg border border-overdue-border flex items-center justify-center mx-auto">
            <span className="text-overdue text-xl font-bold">✕</span>
          </div>
          <p className="text-ink-primary font-semibold">Acceso no autorizado</p>
          <p className="text-ink-muted text-sm">Tu cuenta no tiene permisos de administrador.</p>
          <button onClick={() => signOut(auth).then(() => router.push('/login'))} className="text-sm text-accent hover:underline">Cerrar sesión</button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════

  const tabItems = [
    { id: 'revision', label: 'Comprobantes', count: stats.enRevision },
    { id: 'todas',    label: 'Todas las cuotas', count: stats.total },
    { id: 'apoderados', label: 'Apoderados', count: apoderados.length },
    { id: 'resumen',  label: 'Resumen financiero' },
  ]

  return (
    <div className="min-h-screen bg-surface-900 text-ink-primary font-sans">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-surface-500 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7 rounded-lg overflow-hidden ring-1 ring-surface-400 flex-shrink-0">
              <img src={LOGO_SRC} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-primary font-semibold text-sm">Portal Escolar</span>
              <span className="text-surface-400 text-sm">·</span>
              <span className="text-ink-muted text-sm">Administración</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-accent-bg text-accent-hover border border-accent-border px-2.5 py-1 rounded-full font-medium">Admin</span>
            <button
              onClick={() => signOut(auth).then(() => router.push('/login'))}
              title="Cerrar sesión"
              className="w-8 h-8 rounded-full bg-surface-600 border border-surface-400 text-ink-muted hover:text-ink-primary text-xs transition-colors"
            >↩</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">

        {/* ── STATS CARDS ────────────────────────────────────────────────── */}
        {!loadingTodas && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Recaudación" value={`${stats.pctCobrado}%`} color="text-paid" icon="📊" subtext={`${stats.pagadas} de ${stats.total} cuotas`} />
            <StatCard label="Monto cobrado" value={formatCLP(stats.montoPagado)} color="text-paid" icon="💰" />
            <StatCard label="Pendiente" value={formatCLP(stats.montoPendiente)} color="text-pending" icon="⏳" subtext={`${stats.pendientes} pendientes · ${stats.atrasadas} atrasadas`} />
            <StatCard label="En revisión" value={stats.enRevision} color="text-review" icon="📋" subtext="Comprobantes por validar" />
            {/* Quick Win #4: Recordatorio masivo */}
            <div className="bg-white border border-surface-500 rounded-xl px-5 py-4 shadow-card flex flex-col justify-between">
              <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Morosidad</span>
              <p className="text-overdue text-2xl font-bold leading-none mt-2">{stats.atrasadas}</p>
              <button
                onClick={handleRecordatorioMasivo}
                disabled={enviandoRecordatorio || stats.atrasadas === 0}
                className={`mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-[0.98] ${
                  recordatorioEnviado
                    ? 'bg-paid-bg text-paid border border-paid-border'
                    : 'bg-pending-bg hover:bg-pending text-pending hover:text-white border border-pending-border'
                } disabled:opacity-40`}
              >
                {enviandoRecordatorio ? (
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />Enviando...</span>
                ) : recordatorioEnviado ? '✓ Recordatorio enviado'
                  : `⚠ Recordar (${stats.atrasadas})`}
              </button>
            </div>
          </div>
        )}

        {/* ── TABS + SEARCH ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Tabs tabs={tabItems} active={activeTab} onChange={setActiveTab} />
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex-1 sm:w-64">
              <SearchBar
                value={busqueda}
                onChange={setBusqueda}
                placeholder={activeTab === 'apoderados' ? 'Buscar por nombre o RUT...' : 'Buscar estudiante o mes...'}
              />
            </div>
            {/* Quick Win #1: Botones de exportación */}
            {activeTab === 'todas' && todasCuotas.length > 0 && (
              <button
                onClick={() => exportarCuotasExcel(cuotasFiltradas, estudiantesMap)}
                className="flex items-center gap-2 bg-paid-bg hover:bg-paid text-paid hover:text-white text-sm font-semibold px-4 py-2.5 rounded-lg border border-paid-border transition-all active:scale-[0.98] whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Exportar Excel
              </button>
            )}
            {activeTab === 'apoderados' && (
              <div className="flex items-center gap-2">
                {apoderados.length > 0 && (
                  <button
                    onClick={() => exportarApoderadosExcel(apoderadosFiltrados, estudiantesMap)}
                    className="flex items-center gap-2 bg-paid-bg hover:bg-paid text-paid hover:text-white text-sm font-medium px-3 py-2.5 rounded-lg border border-paid-border transition-all active:scale-[0.98] whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Excel
                  </button>
                )}
                <button onClick={() => setModalRegistrar(true)} className="bg-accent hover:bg-accent-hover text-gray-900 text-sm font-semibold px-4 py-2.5 rounded-lg transition-all shadow-glow-blue active:scale-[0.98] whitespace-nowrap">
                  + Nuevo
                </button>
              </div>
            )}
            {activeTab === 'resumen' && todasCuotas.length > 0 && (
              <button
                onClick={() => exportarCuotasExcel(todasCuotas, estudiantesMap, 'Reporte_Financiero_CDT')}
                className="flex items-center gap-2 bg-paid-bg hover:bg-paid text-paid hover:text-white text-sm font-semibold px-4 py-2.5 rounded-lg border border-paid-border transition-all active:scale-[0.98] whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Exportar Reporte
              </button>
            )}
          </div>
        </div>


        {/* ── TAB: COMPROBANTES EN REVISIÓN ───────────────────────────────── */}
        {activeTab === 'revision' && (
          <>
            {loadingRevision ? (
              <div className="bg-white border border-surface-500 rounded-xl p-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : cuotasRevision.length === 0 ? (
              <div className="bg-white border border-surface-500 rounded-xl p-16 flex flex-col items-center gap-4 shadow-card">
                <div className="w-16 h-16 rounded-full bg-paid-bg border border-paid-border flex items-center justify-center"><span className="text-paid text-3xl">✓</span></div>
                <p className="text-ink-primary font-semibold">Sin comprobantes pendientes</p>
                <p className="text-ink-muted text-sm">Todos los comprobantes han sido procesados.</p>
              </div>
            ) : (
              <div className="bg-white border border-surface-500 rounded-xl overflow-hidden shadow-card">
                <div className="px-5 py-4 border-b border-surface-500 flex items-center justify-between">
                  <div>
                    <h2 className="text-ink-primary font-semibold text-base">Pagos por verificar</h2>
                    <p className="text-ink-muted text-xs mt-0.5">{cuotasRevision.length} comprobante{cuotasRevision.length !== 1 ? 's' : ''} · doble clic para confirmar</p>
                  </div>
                  <div className="flex items-center gap-2 bg-review-bg border border-review-border rounded-full px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-review animate-pulse" />
                    <span className="text-review text-xs font-medium">En tiempo real</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-500 bg-surface-800">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Cuota</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Estudiante</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Monto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden md:table-cell">Vencimiento</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden lg:table-cell">Enviado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuotasRevision.map((cuota) => (
                        <FilaCuotaRevision key={cuota.id} cuota={cuota} nombreEstudiante={estudiantesMap[cuota.estudianteId]} onVerComprobante={setModalUrl} onAprobar={handleAprobar} onRechazar={handleRechazar} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}


        {/* ── TAB: TODAS LAS CUOTAS ──────────────────────────────────────── */}
        {activeTab === 'todas' && (
          <>
            {/* Filtro de estados */}
            <div className="flex gap-2 flex-wrap">
              {['todos', 'pendiente', 'atrasado', 'en_revision', 'pagado'].map((est) => (
                <button key={est} onClick={() => setFiltroEstado(est)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all
                    ${filtroEstado === est ? 'bg-accent text-gray-900 border-accent shadow-sm' : 'bg-white text-ink-muted border-surface-400 hover:border-ink-muted'}`}>
                  {est === 'todos' ? 'Todos' : estadoLabel[est]}
                  <span className="ml-1 opacity-70">
                    ({est === 'todos' ? todasCuotas.length : todasCuotas.filter(c => c.estado === est).length})
                  </span>
                </button>
              ))}
            </div>

            {loadingTodas ? (
              <div className="bg-white border border-surface-500 rounded-xl p-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="bg-white border border-surface-500 rounded-xl overflow-hidden shadow-card">
                <div className="px-5 py-3 border-b border-surface-500 flex items-center justify-between">
                  <p className="text-ink-muted text-xs">{cuotasFiltradas.length} cuota{cuotasFiltradas.length !== 1 ? 's' : ''} encontrada{cuotasFiltradas.length !== 1 ? 's' : ''}</p>
                  <p className="text-ink-disabled text-xs">Quick Win #5: hover sobre 'Pagado' para ver quién aprobó</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-500 bg-surface-800">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Cuota</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Estudiante</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Monto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden md:table-cell">Vencimiento</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden lg:table-cell">Fecha pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuotasFiltradas.map((c) => (
                        <tr key={c.id} className="border-b border-surface-500 hover:bg-surface-600/50 transition-colors">
                          <td className="px-4 py-3 text-ink-primary text-sm font-medium">{c.mes} {c.anio}</td>
                          <td className="px-4 py-3 text-ink-primary text-sm">{estudiantesMap[c.estudianteId] ?? <Sk className="w-24 h-4 inline-block" />}</td>
                          <td className="px-4 py-3 text-ink-secondary text-sm font-mono">{formatCLP(c.monto)}</td>
                          <td className="px-4 py-3 text-ink-secondary text-sm hidden md:table-cell">{formatFecha(c.fechaVencimiento)}</td>
                          <td className="px-4 py-3">
                            <div className="group relative">
                              <EstadoBadge estado={c.estado} />
                              {/* Quick Win #5: Auditoría — quién aprobó */}
                              {c.estado === 'pagado' && c.aprobadoPor && (
                                <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20">
                                  <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap">
                                    ✓ Aprobado por: <span className="font-semibold">{c.aprobadoPor === 'online' ? 'Pago Online' : (c.aprobadoPor?.slice(0, 10) + '…')}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-ink-secondary text-sm hidden lg:table-cell">{c.fechaPago ? formatFecha(c.fechaPago) : '—'}</td>
                        </tr>
                      ))}
                      {cuotasFiltradas.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-muted text-sm">No se encontraron cuotas con los filtros aplicados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}


        {/* ── TAB: APODERADOS ────────────────────────────────────────────── */}
        {activeTab === 'apoderados' && (
          <>
            {loadingApoderados ? (
              <div className="bg-white border border-surface-500 rounded-xl p-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="bg-white border border-surface-500 rounded-xl overflow-hidden shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-500 bg-surface-800">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Nombre</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">RUT</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Contacto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Estudiantes</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden md:table-cell">Registro</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apoderadosFiltrados.map((a) => {
                        // Calcular cuotas atrasadas de este apoderado para el botón WhatsApp
                        const estIds = a.estudiantes_ids ?? []
                        const cuotasAtrasadasApoderado = todasCuotas.filter(c => estIds.includes(c.estudianteId) && (c.estado === 'atrasado' || c.estado === 'pendiente'))
                        const cuotasStr = cuotasAtrasadasApoderado.map(c => `${c.mes}`).join(', ')

                        return (
                          <tr key={a.id} className="border-b border-surface-500 hover:bg-surface-600/50 transition-colors">
                            <td className="px-4 py-3.5 text-ink-primary text-sm font-medium">{a.nombre ?? '—'}</td>
                            <td className="px-4 py-3.5 text-ink-secondary text-sm font-mono">{a.rut ?? '—'}</td>
                            <td className="px-4 py-3.5">
                              <div className="space-y-0.5">
                                <p className="text-ink-secondary text-sm">{a.email ?? <span className="text-ink-disabled italic">Sin correo</span>}</p>
                                {a.telefono && <p className="text-ink-muted text-xs font-mono">📱 {a.telefono}</p>}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap gap-1">
                                {estIds.map((estId) => (
                                  <span key={estId} className="text-xs bg-accent-bg text-accent-hover border border-accent-border px-2 py-0.5 rounded-full font-medium">
                                    {estudiantesMap[estId] ?? estId.slice(0, 8) + '…'}
                                  </span>
                                ))}
                                {estIds.length === 0 && <span className="text-ink-disabled text-xs italic">Sin estudiantes</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-ink-muted text-sm hidden md:table-cell">{a.created_at ? formatFecha(a.created_at.toDate()) : '—'}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5">
                                {/* Quick Win #3: Botón WhatsApp */}
                                {a.telefono ? (
                                  <button
                                    onClick={() => abrirWhatsApp(a.telefono, a.nombre ?? 'Apoderado', cuotasStr)}
                                    title="Enviar WhatsApp"
                                    className="flex items-center gap-1 text-xs bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white px-2.5 py-1.5 rounded-md font-medium border border-[#25D366]/30 transition-all"
                                  >
                                    💬 WhatsApp
                                  </button>
                                ) : (
                                  <span className="text-ink-disabled text-xs italic">Sin tel.</span>
                                )}
                                {cuotasAtrasadasApoderado.length > 0 && (
                                  <span className="text-xs bg-overdue-bg text-overdue border border-overdue-border px-2 py-0.5 rounded-full font-medium">
                                    {cuotasAtrasadasApoderado.length} pend.
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {apoderadosFiltrados.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-muted text-sm">No se encontraron apoderados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}


        {/* ── TAB: RESUMEN FINANCIERO ─────────────────────────────────────── */}
        {activeTab === 'resumen' && (
          <div className="space-y-6">
            {/* Barra de progresión global */}
            <div className="bg-white border border-surface-500 rounded-xl p-6 shadow-card">
              <h3 className="text-ink-primary font-semibold text-base mb-4">Progreso de recaudación anual</h3>
              <div className="w-full bg-surface-500 rounded-full h-4 overflow-hidden mb-3">
                <div className="bg-accent h-4 rounded-full transition-all duration-700" style={{ width: `${stats.pctCobrado}%` }} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-paid font-semibold">{formatCLP(stats.montoPagado)} cobrado</span>
                <span className="text-ink-muted">{formatCLP(stats.montoPendiente)} pendiente</span>
              </div>
            </div>

            {/* Desglose por mes */}
            <div className="bg-white border border-surface-500 rounded-xl overflow-hidden shadow-card">
              <div className="px-5 py-4 border-b border-surface-500">
                <h3 className="text-ink-primary font-semibold text-base">Desglose por mes</h3>
                <p className="text-ink-muted text-xs mt-0.5">Resumen de cuotas agrupadas por mes del año lectivo</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-500 bg-surface-800">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Mes</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-ink-muted uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-ink-muted uppercase tracking-wider">Pagadas</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-ink-muted uppercase tracking-wider">Pendientes</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-ink-muted uppercase tracking-wider">Atrasadas</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-ink-muted uppercase tracking-wider">% cobrado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MESES.map((mes) => {
                      const del   = todasCuotas.filter(c => c.mes === mes)
                      const pag   = del.filter(c => c.estado === 'pagado').length
                      const pend  = del.filter(c => c.estado === 'pendiente').length
                      const atr   = del.filter(c => c.estado === 'atrasado').length
                      const pct   = del.length > 0 ? Math.round((pag / del.length) * 100) : 0
                      return (
                        <tr key={mes} className="border-b border-surface-500 hover:bg-surface-600/50 transition-colors">
                          <td className="px-4 py-3 text-ink-primary text-sm font-medium">{mes}</td>
                          <td className="px-4 py-3 text-ink-secondary text-sm text-center">{del.length}</td>
                          <td className="px-4 py-3 text-paid text-sm font-semibold text-center">{pag}</td>
                          <td className="px-4 py-3 text-pending text-sm text-center">{pend}</td>
                          <td className="px-4 py-3 text-overdue text-sm text-center">{atr}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-surface-500 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-paid h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-ink-secondary text-xs font-mono w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── MODALES ────────────────────────────────────────────────────────── */}
      {modalUrl && <ModalComprobante url={modalUrl} onClose={() => setModalUrl(null)} />}
      {modalRegistrar && <ModalRegistrarApoderado onClose={() => setModalRegistrar(false)} onSuccess={() => {}} />}

    </div>
  )
}
