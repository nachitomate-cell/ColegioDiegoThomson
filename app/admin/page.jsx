'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  collection, query, where, onSnapshot, getDocs, addDoc,
  doc, updateDoc, getDoc, setDoc, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore'
import { signOut, createUserWithEmailAndPassword } from 'firebase/auth'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { useRouter } from 'next/navigation'
import { db, auth, storage } from '../../firebase/firebaseConfig'
import { useAuth }            from '../../hooks/useAuth'
import { exportarCuotasExcel, exportarApoderadosExcel } from '../../lib/exportarExcel'
import { generarReciboPDF }  from '../../lib/generarReciboPDF'
import { LOGO_SRC }          from '../../lib/logo'
import { normalizar }        from '../../lib/utils'
import { toast }             from 'sonner'
import ModalRegistrarEstudiante from '../../components/StudentRegistrationForm'
import { BotonFlotanteAyuda }  from '../../components/ayuda/BotonFlotanteAyuda'


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
const MONTO_BASE_CUOTA = 97_500

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
  pendiente:   'bg-orange-100 text-orange-800',
  atrasado:    'bg-red-600 text-white font-bold',
  en_revision: 'bg-blue-100 text-blue-700',
  pagado:      'bg-green-600 text-white',
}

const ITEMS_PER_PAGE = 50

const CURSOS = [
  'Kinder',
  '1° Básico', '2° Básico', '3° Básico', '4° Básico',
  '5° Básico', '6° Básico', '7° Básico', '8° Básico',
]


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
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${estadoColor[estado] ?? 'bg-gray-100 text-gray-600'}`}>
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




// ─── FILA DE CUOTA (REVISIÓN) ─────────────────────────────────────────────────

function FilaCuotaRevision({ cuota, nombreEstudiante, onVerComprobante, onAprobar, onRechazar }) {
  const [confirmando,       setConfirmando]       = useState(null)
  const [procesando,        setProcesando]        = useState(false)
  const [motivoRechazo,     setMotivoRechazo]     = useState('')
  const [errorFila,         setErrorFila]         = useState(null)

  const handleAccion = async (accion) => {
    // Primer clic: pedir confirmación (y motivo si es rechazo)
    if (confirmando !== accion) { setConfirmando(accion); setMotivoRechazo(''); setErrorFila(null); return }
    // Segundo clic: ejecutar
    setProcesando(true)
    setErrorFila(null)
    try {
      if (accion === 'aprobar') {
        await onAprobar(cuota.id)
      } else {
        await onRechazar(cuota.id, motivoRechazo)
      }
    } catch (err) {
      setErrorFila(err.message || 'Error al procesar')
    } finally {
      setProcesando(false)
      setConfirmando(null)
    }
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
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => onVerComprobante(cuota.comprobanteUrl)} disabled={!cuota.comprobanteUrl || procesando} className="text-xs bg-surface-600 hover:bg-surface-500 text-ink-secondary px-2.5 py-1.5 rounded-md border border-surface-400 transition-colors disabled:opacity-40">Ver</button>

            {/* Aprobar */}
            {confirmando === 'aprobar' ? (
              <div className="flex items-center gap-1">
                <button onClick={() => handleAccion('aprobar')} disabled={procesando} className="text-xs bg-paid text-white px-2.5 py-1.5 rounded-md font-semibold">
                  {procesando ? '…' : '¿Confirmar?'}
                </button>
                <button onClick={() => setConfirmando(null)} disabled={procesando} className="text-xs bg-surface-600 text-ink-muted px-2 py-1.5 rounded-md border border-surface-400">✕</button>
              </div>
            ) : (
              <button onClick={() => handleAccion('aprobar')} disabled={procesando || confirmando === 'rechazar'} className="text-xs bg-paid-bg hover:bg-paid text-paid hover:text-white px-2.5 py-1.5 rounded-md border border-paid-border font-medium transition-all disabled:opacity-40">Aprobar</button>
            )}

            {/* Rechazar */}
            {confirmando === 'rechazar' ? (
              <div className="flex items-center gap-1">
                <button onClick={() => handleAccion('rechazar')} disabled={procesando} className="text-xs bg-overdue text-white px-2.5 py-1.5 rounded-md font-semibold">
                  {procesando ? '…' : '¿Confirmar?'}
                </button>
                <button onClick={() => setConfirmando(null)} disabled={procesando} className="text-xs bg-surface-600 text-ink-muted px-2 py-1.5 rounded-md border border-surface-400">✕</button>
              </div>
            ) : (
              <button onClick={() => handleAccion('rechazar')} disabled={procesando || confirmando === 'aprobar'} className="text-xs bg-overdue-bg hover:bg-overdue text-overdue hover:text-white px-2.5 py-1.5 rounded-md border border-overdue-border font-medium transition-all disabled:opacity-40">Rechazar</button>
            )}
          </div>

          {/* Textarea de motivo de rechazo */}
          {confirmando === 'rechazar' && (
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Motivo del rechazo (opcional)..."
              rows={2}
              className="w-full text-xs border border-surface-400 rounded-md px-2 py-1.5 text-ink-primary placeholder:text-ink-disabled focus:outline-none focus:border-overdue resize-none"
            />
          )}

          {/* Error inline */}
          {errorFila && <p className="text-overdue text-xs">{errorFila}</p>}
        </div>
      </td>
    </tr>
  )
}


// ─── SECCIÓN CONFIGURACIÓN ────────────────────────────────────────────────────

function SeccionConfiguracion() {
  const [config,             setConfig]             = useState(null)
  const [loadingConfig,      setLoadingConfig]      = useState(true)
  const [confirmandoActivar, setConfirmandoActivar] = useState(false)
  const [guardando,          setGuardando]          = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'configuracion', 'periodo_escolar'),
      (snap) => {
        setConfig(snap.exists() ? snap.data() : { admite_matricula_2027: false })
        setLoadingConfig(false)
      },
      (err) => { console.error('[SeccionConfiguracion]', err); setLoadingConfig(false) }
    )
    return () => unsub()
  }, [])

  const aplicarToggle = async (activar) => {
    setConfirmandoActivar(false)
    setGuardando(true)
    try {
      await setDoc(
        doc(db, 'configuracion', 'periodo_escolar'),
        { admite_matricula_2027: activar },
        { merge: true }
      )
    } catch (err) {
      console.error('[SeccionConfiguracion] Error al guardar:', err)
    } finally {
      setGuardando(false)
    }
  }

  const handleToggle = (nuevoValor) => {
    // Activar requiere confirmación; desactivar es inmediato
    if (nuevoValor) { setConfirmandoActivar(true); return }
    aplicarToggle(false)
  }

  const activo = config?.admite_matricula_2027 ?? false

  return (
    <div className="space-y-5 max-w-xl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-accent-hover" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-ink-primary font-semibold text-base">Control de Período Escolar</h3>
          <p className="text-ink-muted text-xs">Administra la visibilidad de procesos para apoderados</p>
        </div>
      </div>

      {/* ── Toggle: Matrícula 2027 ── */}
      <div className={`rounded-xl border-2 px-5 py-4 flex items-center justify-between gap-4 transition-colors duration-300
        ${activo ? 'border-accent/40 bg-accent/5' : 'border-surface-400 bg-surface-700'}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-ink-primary text-sm font-semibold">Matrícula 2027</p>
            {!loadingConfig && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full
                ${activo
                  ? 'bg-paid-bg text-paid border border-paid-border'
                  : 'bg-surface-600 text-ink-muted border border-surface-400'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activo ? 'bg-paid animate-pulse' : 'bg-ink-disabled'}`} />
                {activo ? 'Activo' : 'Inactivo'}
              </span>
            )}
          </div>
          <p className="text-ink-muted text-xs mt-1">
            {activo
              ? 'El proceso de matrícula 2027 es visible para todos los apoderados.'
              : 'Oculto — los apoderados no verán la sección de matrícula 2027.'}
          </p>
        </div>

        {/* Toggle switch */}
        {loadingConfig ? (
          <Sk className="w-12 h-6 rounded-full flex-shrink-0" />
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={activo}
            onClick={() => handleToggle(!activo)}
            disabled={guardando}
            title={activo ? 'Desactivar matrícula 2027' : 'Activar matrícula 2027'}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-700
              ${activo ? 'bg-accent' : 'bg-surface-400'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200
              ${activo ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>
        )}
      </div>

      {/* ── Diálogo de confirmación ── */}
      {confirmandoActivar && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-amber-800 text-sm font-semibold">Confirmar habilitación</p>
              <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                ¿Está segura de habilitar el cobro de matrícula 2027 para todos los apoderados?
                Esta acción será visible de <span className="font-semibold">inmediato</span> en el portal de cada familia.
              </p>
            </div>
          </div>
          <div className="flex gap-2 pl-11">
            <button
              onClick={() => aplicarToggle(true)}
              disabled={guardando}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Habilitando...' : 'Sí, habilitar ahora'}
            </button>
            <button
              onClick={() => setConfirmandoActivar(false)}
              className="flex-1 py-2 rounded-lg text-xs font-medium text-amber-700 bg-white hover:bg-amber-50 border border-amber-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Nota informativa ── */}
      <p className="text-ink-disabled text-xs">
        Los cambios se propagan en tiempo real. No requieren reiniciar el sistema.
      </p>
    </div>
  )
}


// ─── MODAL EDITAR ESTUDIANTE ──────────────────────────────────────────────────

function ModalEditarEstudiante({ estudiante, onClose, onSaved }) {
  const [nombre,          setNombre]          = useState(estudiante.nombre          ?? '')
  const [curso,           setCurso]           = useState(estudiante.curso           ?? '')
  const [apoderadoNombre, setApoderadoNombre] = useState(estudiante.apoderado_nombre ?? '')
  const [apoderadoEmail,  setApoderadoEmail]  = useState(estudiante.apoderado_email ?? estudiante.email ?? '')
  const [telefono,        setTelefono]        = useState(estudiante.telefono        ?? '')
  const [esBecado,        setEsBecado]        = useState(estudiante.es_becado       ?? false)
  const [montoCuota,      setMontoCuota]      = useState(String(estudiante.monto_cuota ?? MONTO_BASE_CUOTA))
  const [guardando,       setGuardando]       = useState(false)
  const [error,           setError]           = useState(null)

  const handleGuardar = async () => {
    if (!nombre.trim())  { setError('El nombre es requerido'); return }
    if (!curso)          { setError('El curso es requerido'); return }
    if (esBecado) {
      const m = parseInt(montoCuota, 10)
      if (isNaN(m) || m <= 0 || m >= MONTO_BASE_CUOTA) {
        setError(`El monto debe ser un valor válido menor a ${formatCLP(MONTO_BASE_CUOTA)}`)
        return
      }
    }
    setGuardando(true)
    setError(null)
    try {
      const montoFinal   = esBecado ? parseInt(montoCuota, 10) : MONTO_BASE_CUOTA
      const rutLimpioApo = estudiante.apoderado_rut_limpio
      const batch = writeBatch(db)

      batch.update(doc(db, 'Estudiantes', estudiante.id), {
        nombre:           nombre.trim(),
        curso,
        apoderado_nombre: apoderadoNombre.trim() || null,
        apoderado_email:  apoderadoEmail.trim()  || null,
        telefono:         telefono.trim()        || null,
        es_becado:        esBecado,
        monto_cuota:      montoFinal,
      })

      if (rutLimpioApo) {
        batch.update(doc(db, 'Apoderados', rutLimpioApo), {
          nombre:   apoderadoNombre.trim() || null,
          email:    apoderadoEmail.trim()  || null,
          telefono: telefono.trim()        || null,
        })
      }

      await batch.commit()
      onSaved?.()
      onClose()
    } catch (err) {
      console.error('[ModalEditarEstudiante]', err)
      setError(err.message ?? 'Error al guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white border border-surface-400 rounded-2xl shadow-card-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-500 sticky top-0 bg-white z-10">
          <h2 className="text-ink-primary font-semibold text-base">Editar estudiante</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary text-xl leading-none w-7 h-7 flex items-center justify-center transition-colors">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">

          {/* RUT — solo lectura */}
          <div>
            <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">RUT (no editable)</label>
            <input
              disabled
              value={estudiante.rut ?? '—'}
              className="w-full bg-surface-700 border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-muted cursor-not-allowed"
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Nombre completo</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          {/* Curso */}
          <div>
            <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Curso</label>
            <select
              value={curso}
              onChange={e => setCurso(e.target.value)}
              className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            >
              <option value="">Seleccionar...</option>
              {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <hr className="border-surface-500" />
          <p className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Apoderado</p>

          {/* Nombre apoderado */}
          <div>
            <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Nombre</label>
            <input
              value={apoderadoNombre}
              onChange={e => setApoderadoNombre(e.target.value)}
              className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={apoderadoEmail}
                onChange={e => setApoderadoEmail(e.target.value)}
                className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-ink-muted text-xs font-semibold mb-1 uppercase tracking-wide">Teléfono</label>
              <input
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="+56 9 1234 5678"
                className="w-full bg-white border-2 border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
          </div>

          <hr className="border-surface-500" />

          {/* Beca */}
          <div className={`rounded-xl border-2 transition-colors px-4 py-3 ${esBecado ? 'border-amber-300 bg-amber-50' : 'border-surface-400 bg-surface-700'}`}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <button
                type="button"
                role="switch"
                aria-checked={esBecado}
                onClick={() => setEsBecado(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${esBecado ? 'bg-amber-400' : 'bg-surface-400'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${esBecado ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <div>
                <p className="text-ink-primary text-sm font-semibold">Beca / Arancel diferenciado</p>
                <p className="text-ink-muted text-xs">Valor estándar: <span className="font-mono">{formatCLP(MONTO_BASE_CUOTA)}</span>/mes</p>
              </div>
            </label>
            {esBecado && (
              <div className="mt-3">
                <label className="block text-amber-700 text-xs font-semibold mb-1 uppercase tracking-wide">Valor de cuota mensual ($)</label>
                <input
                  type="number"
                  min={1}
                  max={MONTO_BASE_CUOTA - 1}
                  value={montoCuota}
                  onChange={e => setMontoCuota(e.target.value)}
                  placeholder="Ej: 75000"
                  className="w-full bg-white border-2 border-amber-300 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition-all"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-overdue text-xs bg-overdue-bg border border-overdue-border rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-surface-500">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-ink-secondary bg-surface-600 hover:bg-surface-500 border border-surface-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-900 bg-accent hover:bg-accent-hover disabled:opacity-40 transition-all active:scale-[0.98]"
          >
            {guardando ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                Guardando...
              </span>
            ) : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── MODAL CONFIRMAR PAGO MANUAL ─────────────────────────────────────────────

const MEDIOS_PAGO = [
  { value: 'transferencia',   label: 'Transferencia bancaria' },
  { value: 'efectivo',        label: 'Efectivo' },
  { value: 'cheque',          label: 'Cheque' },
  { value: 'webpay_diferido', label: 'Webpay (confirmación diferida)' },
  { value: 'khipu_diferido',  label: 'Khipu (confirmación diferida)' },
  { value: 'otro',            label: 'Otro' },
]

function ModalConfirmarPagoManual({ cuota, nombreEstudiante, estudianteData, onClose, onConfirmado }) {
  const [medioPago,          setMedioPago]          = useState('')
  const [fechaPago,          setFechaPago]          = useState(new Date().toISOString().split('T')[0])
  const [numeroComprobante,  setNumeroComprobante]  = useState('')
  const [observacion,        setObservacion]        = useState('')
  const [archivo,            setArchivo]            = useState(null)
  const [archivoError,       setArchivoError]       = useState(null)
  const [progreso,           setProgreso]           = useState(0)
  const [enviando,           setEnviando]           = useState(false)
  const [errorLocal,         setErrorLocal]         = useState(null)

  const requiereComprobante = medioPago && medioPago !== 'efectivo'
  const observacionOk       = observacion.trim().length >= 10
  const formValido = (
    medioPago &&
    fechaPago &&
    observacionOk &&
    (!requiereComprobante || numeroComprobante.trim())
  )

  const handleArchivo = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { setArchivoError('Máx. 5 MB'); return }
    if (!f.type.match(/image\/.*|application\/pdf/)) { setArchivoError('Solo imagen o PDF'); return }
    setArchivoError(null)
    setArchivo(f)
  }

  const handleSubmit = async () => {
    if (!formValido || enviando) return
    setEnviando(true)
    setErrorLocal(null)
    try {
      // 1. Subir comprobante si se adjuntó
      let comprobanteUrl = null
      if (archivo) {
        const timestamp  = Date.now()
        const storageRef = ref(storage, `comprobantes-manuales/${cuota.id}/${timestamp}-${archivo.name}`)
        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, archivo, { contentType: archivo.type })
          task.on(
            'state_changed',
            (snap) => setProgreso(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            () => resolve(task.snapshot),
          )
        })
        comprobanteUrl = await getDownloadURL(storageRef)
      }

      // 2. Llamar API route
      const token = await auth.currentUser.getIdToken()
      const res   = await fetch('/api/admin/confirmar-pago-manual', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cuota_id:               cuota.id,
          medio_pago:             medioPago,
          fecha_pago:             fechaPago,
          numero_comprobante:     numeroComprobante.trim() || null,
          observacion:            observacion.trim(),
          comprobante_manual_url: comprobanteUrl,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Error al confirmar el pago')
      }

      // 3. Generar recibo PDF en el navegador
      try {
        generarReciboPDF({
          nombreEstudiante: nombreEstudiante ?? '—',
          curso:            estudianteData?.curso            ?? '—',
          nombreApoderado:  estudianteData?.apoderado_nombre ?? '—',
          rutApoderado:     estudianteData?.apoderado_rut    ?? estudianteData?.rut ?? '—',
          mes:              cuota.mes,
          anio:             cuota.anio,
          monto:            cuota.monto,
          fechaPago:        new Date(fechaPago + 'T12:00:00'),
          codigoAutorizacion: numeroComprobante.trim() || null,
          cuotaId:          cuota.id,
        })
      } catch (pdfErr) {
        console.warn('[ModalConfirmarPago] Error generando PDF (no crítico):', pdfErr)
      }

      toast.success('Pago confirmado', {
        description: 'La cuota fue marcada como pagada y se descargó el recibo.',
      })
      onConfirmado(cuota.id)
      onClose()
    } catch (err) {
      setErrorLocal(err.message || 'Error al procesar')
    } finally {
      setEnviando(false)
      setProgreso(0)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && !enviando && onClose()}
    >
      <div className="bg-white border border-surface-400 rounded-2xl shadow-card-lg w-full max-w-lg max-h-[92vh] flex flex-col animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-500 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-paid" />
            <h2 className="text-ink-primary font-semibold text-sm">Confirmar pago manual</h2>
          </div>
          <button
            onClick={onClose}
            disabled={enviando}
            className="text-ink-muted hover:text-ink-primary text-xl leading-none w-7 h-7 flex items-center justify-center"
          >×</button>
        </div>

        {/* Datos de la cuota */}
        <div className="px-6 py-3 bg-surface-800 border-b border-surface-500 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-ink-primary text-sm font-semibold">{cuota.mes} {cuota.anio}</p>
              <p className="text-ink-muted text-xs">{nombreEstudiante ?? '—'}</p>
            </div>
            <p className="text-ink-primary text-base font-bold font-mono">{formatCLP(cuota.monto)}</p>
          </div>
        </div>

        {/* Formulario */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Medio de pago */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Medio de pago <span className="text-overdue">*</span>
            </label>
            <select
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
              disabled={enviando}
              className="w-full bg-white border border-surface-400 rounded-lg px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-50"
            >
              <option value="">Seleccionar medio de pago...</option>
              {MEDIOS_PAGO.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Fecha de pago */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Fecha de pago real <span className="text-overdue">*</span>
            </label>
            <input
              type="date"
              value={fechaPago}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFechaPago(e.target.value)}
              disabled={enviando}
              className="w-full bg-white border border-surface-400 rounded-lg px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-50"
            />
          </div>

          {/* N° comprobante (obligatorio excepto efectivo) */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              N° de comprobante / referencia
              {requiereComprobante && <span className="text-overdue"> *</span>}
              {!requiereComprobante && medioPago === 'efectivo' && (
                <span className="ml-1 text-ink-disabled font-normal">(no requerido para efectivo)</span>
              )}
            </label>
            <input
              type="text"
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
              disabled={enviando}
              placeholder={medioPago === 'transferencia' ? 'Ej: 12345678' : medioPago === 'cheque' ? 'Folio del cheque' : 'Referencia / código'}
              className="w-full bg-white border border-surface-400 rounded-lg px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-50"
            />
          </div>

          {/* Observación */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Observación <span className="text-overdue">*</span>
              <span className={`ml-1 font-normal ${observacion.trim().length < 10 ? 'text-ink-disabled' : 'text-paid'}`}>
                ({observacion.trim().length}/10 mín.)
              </span>
            </label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              disabled={enviando}
              rows={3}
              placeholder="Ej: Apoderado pagó en efectivo el 15-abr en secretaría. Recibido por Daniela Rojas."
              className="w-full bg-white border border-surface-400 rounded-lg px-3 py-2.5 text-sm text-ink-primary placeholder:text-ink-disabled focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none disabled:opacity-50"
            />
          </div>

          {/* Comprobante adjunto (opcional) */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Adjuntar comprobante <span className="text-ink-disabled font-normal">(opcional · imagen o PDF · max 5 MB)</span>
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleArchivo}
              disabled={enviando}
              className="w-full text-xs text-ink-secondary file:mr-3 file:text-xs file:font-medium file:bg-surface-600 file:border file:border-surface-400 file:rounded-md file:px-3 file:py-1.5 file:text-ink-secondary hover:file:bg-surface-500 file:cursor-pointer cursor-pointer disabled:opacity-50"
            />
            {archivoError && <p className="text-overdue text-xs mt-1">{archivoError}</p>}
            {archivo && !archivoError && (
              <p className="text-paid text-xs mt-1">✓ {archivo.name} ({(archivo.size / 1024).toFixed(0)} KB)</p>
            )}
          </div>

          {/* Barra de progreso upload */}
          {enviando && archivo && progreso > 0 && progreso < 100 && (
            <div>
              <p className="text-ink-muted text-xs mb-1">Subiendo comprobante... {progreso}%</p>
              <div className="w-full bg-surface-500 rounded-full h-1.5">
                <div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}

          {/* Error */}
          {errorLocal && (
            <div className="bg-overdue-bg border border-overdue-border rounded-lg px-4 py-3">
              <p className="text-overdue text-sm font-medium">{errorLocal}</p>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3 px-6 py-4 border-t border-surface-500 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={enviando}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-ink-secondary bg-surface-700 hover:bg-surface-600 border border-surface-400 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formValido || enviando}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-paid hover:bg-paid/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {enviando ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Confirmando...
              </span>
            ) : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
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
  const [rolEfectivo, setRolEfectivo]   = useState(null) // 'admin' | 'secretaria'

  // ── Estado global ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState('revision')
  const [busqueda, setBusqueda]             = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('todos')
  const [currentPage, setCurrentPage]       = useState(1)

  // ── Data: comprobantes en revisión ──────────────────────────────────────────
  const [cuotasRevision, setCuotasRevision] = useState([])
  const [loadingRevision, setLoadingRevision] = useState(true)

  // ── Data: TODAS las cuotas ──────────────────────────────────────────────────
  const [todasCuotas, setTodasCuotas]       = useState([])
  const [loadingTodas, setLoadingTodas]     = useState(true)

  // ── Data: estudiantes ──────────────────────────────────────────────────────
  const [apoderados, setApoderados]         = useState([])  // legado, para WhatsApp recordatorio
  const [listaEstudiantes, setListaEstudiantes] = useState([])
  const [loadingApoderados, setLoadingApoderados] = useState(true)

  // ── Mapas auxiliares ──────────────────────────────────────────────────────
  const [estudiantesMap, setEstudiantesMap] = useState({})
  const fetchedIdsRef = useRef(new Set())

  // ── Modales ────────────────────────────────────────────────────────────────
  const [modalUrl, setModalUrl]               = useState(null)
  const [modalRegistrar, setModalRegistrar]   = useState(false)
  const [estudianteEditando, setEstudianteEditando] = useState(null)
  // Modal de confirmación manual de pago
  const [cuotaConfirmando, setCuotaConfirmando] = useState(null)

  // ── Filtros del tab Pagos Manuales ────────────────────────────────────────
  const [busquedaManual,    setBusquedaManual]    = useState('')
  const [filtroMesManual,   setFiltroMesManual]   = useState('')
  const [currentPageManual, setCurrentPageManual] = useState(1)
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState(false)
  const [recordatorioEnviado, setRecordatorioEnviado]   = useState(false)

  // ── Mapa de admins (para auditoría) ────────────────────────────────────────
  const [adminsMap, setAdminsMap] = useState({})

  const [error, setError] = useState(null)

  // ── Auth check ──────────────────────────────────────────────────────────────
  // Acepta: doc en /Admins/{uid} (admin legacy) O custom claim role='admin'/'secretaria'
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    Promise.all([
      getDoc(doc(db, 'Admins', user.uid)),
      user.getIdTokenResult(),
    ]).then(([adminSnap, tokenResult]) => {
      const claim = tokenResult.claims?.role
      let rol = null
      if (adminSnap.exists() || claim === 'admin') rol = 'admin'
      else if (claim === 'secretaria')              rol = 'secretaria'

      setRolEfectivo(rol)
      setEsAdmin(rol !== null)   // cualquier rol válido habilita el panel
      setAdminChecked(true)
    }).catch(() => {
      // fallback: solo chequeo de Admins
      getDoc(doc(db, 'Admins', user.uid)).then((snap) => {
        const rol = snap.exists() ? 'admin' : null
        setRolEfectivo(rol)
        setEsAdmin(rol !== null)
        setAdminChecked(true)
      })
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
      // Los nombres ya vienen del listener de Estudiantes — no se necesita fetch extra
    }, (err) => { setError(err.message); setLoadingRevision(false) })
    return () => unsub()
  }, [esAdmin])

  // ── Fetch puntual: TODAS las cuotas ────────────────────────────────────────
  // Usamos getDocs en lugar de onSnapshot para evitar mantener un WebSocket
  // abierto sobre toda la colección. Los cambios de estado (aprobar/rechazar)
  // se reflejan inmediatamente en el listener de "en_revision"; aquí basta
  // con leer una vez y ofrecer un botón de actualización manual.
  const cargarTodasCuotas = useCallback(async () => {
    if (!esAdmin) return
    setLoadingTodas(true)
    try {
      const snapshot = await getDocs(collection(db, 'Cuotas'))
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
    } catch (err) {
      console.error('[AdminPage] Error al cargar cuotas:', err)
    } finally {
      setLoadingTodas(false)
    }
  }, [esAdmin])

  useEffect(() => { cargarTodasCuotas() }, [cargarTodasCuotas])

  // ── Fetch: estudiantes ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!esAdmin) return
    const unsub = onSnapshot(collection(db, 'Estudiantes'), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setListaEstudiantes(data)
      setLoadingApoderados(false)
      // actualizar mapa de nombres también
      const entries = {}
      data.forEach(e => { entries[e.id] = e.nombre })
      setEstudiantesMap(prev => ({ ...prev, ...entries }))
    })
    return () => unsub()
  }, [esAdmin])

  // ── Mapa completo de estudiantes (id → doc completo) para pagos manuales ──
  const estudiantesFullMap = useMemo(() => {
    const map = {}
    listaEstudiantes.forEach((e) => { map[e.id] = e })
    return map
  }, [listaEstudiantes])

  // ── Acciones: Aprobar / Rechazar comprobantes en revisión (vía API) ────────
  const handleAprobar = async (cuotaId) => {
    const token = await auth.currentUser.getIdToken()
    const res   = await fetch('/api/admin/procesar-revision', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ cuota_id: cuotaId, accion: 'aprobar' }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Error al aprobar')
    }
  }

  const handleRechazar = async (cuotaId, observacion = '') => {
    const token = await auth.currentUser.getIdToken()
    const res   = await fetch('/api/admin/procesar-revision', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ cuota_id: cuotaId, accion: 'rechazar', observacion }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Error al rechazar')
    }
  }

  // ── Acción: Confirmar pago manual (callback del modal) ────────────────────
  const handlePagoManualConfirmado = useCallback((cuotaId) => {
    // Forzar recarga de todas las cuotas para reflejar el nuevo estado
    cargarTodasCuotas()
    setCuotaConfirmando(null)
  }, [cargarTodasCuotas])

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
      const q = normalizar(busqueda)
      lista = lista.filter(c => {
        const nombre = normalizar(estudiantesMap[c.estudianteId])
        return nombre.includes(q) || normalizar(c.mes).includes(q) || c.id.toLowerCase().includes(q)
      })
    }
    return lista
  }, [todasCuotas, filtroEstado, busqueda, estudiantesMap])

  // ── Reset de página al cambiar filtros ─────────────────────────────────────
  useEffect(() => { setCurrentPage(1) }, [filtroEstado, busqueda])

  // ── Filtro de cuotas para el tab "Pagos manuales" ─────────────────────────
  // Solo pendiente + atrasado, EXCLUYE en_revision y pagado.
  const cuotasManualesFiltradas = useMemo(() => {
    let lista = todasCuotas.filter((c) => ['pendiente', 'atrasado'].includes(c.estado))
    if (filtroMesManual) {
      lista = lista.filter((c) => c.mes === filtroMesManual)
    }
    if (busquedaManual.trim()) {
      const q = normalizar(busquedaManual)
      lista = lista.filter((c) => {
        const nombre      = normalizar(estudiantesMap[c.estudianteId])
        const apoderado   = normalizar(estudiantesFullMap[c.estudianteId]?.apoderado_nombre)
        const rutApo      = normalizar(estudiantesFullMap[c.estudianteId]?.apoderado_rut_limpio
                                      ?? estudiantesFullMap[c.estudianteId]?.apoderado_rut)
        return nombre.includes(q) || apoderado.includes(q) || rutApo.includes(q)
      })
    }
    // Más atrasadas primero (vencimiento ascendente)
    lista.sort((a, b) => (a.fechaVencimiento ?? 0) - (b.fechaVencimiento ?? 0))
    return lista
  }, [todasCuotas, filtroMesManual, busquedaManual, estudiantesMap, estudiantesFullMap])

  const totalPagesManual     = Math.max(1, Math.ceil(cuotasManualesFiltradas.length / ITEMS_PER_PAGE))
  const cuotasManualesPagina = cuotasManualesFiltradas.slice(
    (currentPageManual - 1) * ITEMS_PER_PAGE,
    currentPageManual * ITEMS_PER_PAGE,
  )
  useEffect(() => { setCurrentPageManual(1) }, [filtroMesManual, busquedaManual])

  // ── Paginación ─────────────────────────────────────────────────────────────
  const totalPages       = Math.max(1, Math.ceil(cuotasFiltradas.length / ITEMS_PER_PAGE))
  const cuotasPaginadas  = cuotasFiltradas.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  // ── Filtro de estudiantes ─────────────────────────────────────────────────
  const apoderadosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return listaEstudiantes
    const q = normalizar(busqueda)
    return listaEstudiantes.filter(e =>
      normalizar(e.nombre).includes(q) ||
      normalizar(e.rut).includes(q) ||
      normalizar(e.curso).includes(q) ||
      normalizar(e.apoderado_nombre).includes(q)
    )
  }, [listaEstudiantes, busqueda])


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

  // Secretaria solo ve: Pagos manuales + Comprobantes + (sin Estudiantes, sin KPIs globales)
  const tabItems = [
    { id: 'revision',        label: 'Comprobantes',      count: stats.enRevision },
    { id: 'pagos_manuales',  label: 'Pagos manuales',    count: cuotasManualesFiltradas.length },
    ...(rolEfectivo === 'admin' ? [
      { id: 'todas',         label: 'Todas las cuotas',  count: stats.total },
      { id: 'apoderados',    label: 'Estudiantes',       count: listaEstudiantes.length },
      { id: 'resumen',       label: 'Resumen financiero' },
      { id: 'configuracion', label: 'Configuración' },
    ] : []),
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
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border
              ${rolEfectivo === 'secretaria'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-accent-bg text-accent-hover border-accent-border'}`}>
              {rolEfectivo === 'secretaria' ? 'Secretaría' : 'Admin'}
            </span>
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
                placeholder={activeTab === 'apoderados' ? 'Buscar por nombre, RUT o curso...' : 'Buscar estudiante o mes...'}
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


        {/* ── TAB: PAGOS MANUALES ───────────────────────────────────────── */}
        {activeTab === 'pagos_manuales' && (
          <>
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
              {/* Filtro por mes */}
              <select
                value={filtroMesManual}
                onChange={(e) => setFiltroMesManual(e.target.value)}
                className="bg-white border border-surface-400 rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent transition-all"
              >
                <option value="">Todos los meses</option>
                {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>

              {/* Búsqueda */}
              <div className="flex-1 min-w-[200px]">
                <SearchBar
                  value={busquedaManual}
                  onChange={setBusquedaManual}
                  placeholder="Buscar por estudiante, apoderado o RUT..."
                />
              </div>

              {/* Botón refrescar */}
              <button
                onClick={cargarTodasCuotas}
                disabled={loadingTodas}
                title="Actualizar lista"
                className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-primary bg-white border border-surface-400 px-3 py-2 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
              >
                <svg className={`w-3.5 h-3.5 ${loadingTodas ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualizar
              </button>
            </div>

            {loadingTodas ? (
              <div className="bg-white border border-surface-500 rounded-xl p-12 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : cuotasManualesFiltradas.length === 0 ? (
              <div className="bg-white border border-surface-500 rounded-xl p-16 flex flex-col items-center gap-4 shadow-card">
                <div className="w-16 h-16 rounded-full bg-paid-bg border border-paid-border flex items-center justify-center">
                  <span className="text-paid text-3xl">✓</span>
                </div>
                <p className="text-ink-primary font-semibold">Sin cuotas pendientes</p>
                <p className="text-ink-muted text-sm">No hay cuotas pendientes o atrasadas{filtroMesManual ? ` en ${filtroMesManual}` : ''}.</p>
              </div>
            ) : (
              <div className="bg-white border border-surface-500 rounded-xl overflow-hidden shadow-card">
                <div className="px-5 py-4 border-b border-surface-500 flex items-center justify-between">
                  <div>
                    <h2 className="text-ink-primary font-semibold text-base">Cuotas pendientes de pago</h2>
                    <p className="text-ink-muted text-xs mt-0.5">
                      {cuotasManualesFiltradas.length} cuota{cuotasManualesFiltradas.length !== 1 ? 's' : ''} ·
                      solo estados <span className="font-medium">pendiente</span> y <span className="font-medium text-overdue">atrasado</span>
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-500 bg-surface-800">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Cuota</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Estudiante</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden lg:table-cell">Apoderado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Monto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden md:table-cell">Vencimiento</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden md:table-cell">Atraso</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuotasManualesPagina.map((c) => {
                        const estData    = estudiantesFullMap[c.estudianteId]
                        const diasAtraso = c.fechaVencimiento
                          ? Math.max(0, Math.floor((new Date() - c.fechaVencimiento) / 86400000))
                          : null
                        return (
                          <tr key={c.id} className="border-b border-surface-500 hover:bg-surface-600/50 transition-colors">
                            <td className="px-4 py-3.5 text-ink-primary text-sm font-medium whitespace-nowrap">{c.mes} {c.anio}</td>
                            <td className="px-4 py-3.5 text-ink-primary text-sm">
                              {estudiantesMap[c.estudianteId] ?? <Sk className="w-24 h-4 inline-block" />}
                              {estData?.curso && <p className="text-ink-muted text-xs">{estData.curso}</p>}
                            </td>
                            <td className="px-4 py-3.5 hidden lg:table-cell">
                              <p className="text-ink-secondary text-sm">{estData?.apoderado_nombre ?? '—'}</p>
                              <p className="text-ink-muted text-xs font-mono">{estData?.apoderado_rut ?? estData?.apoderado_rut_limpio ?? '—'}</p>
                            </td>
                            <td className="px-4 py-3.5 text-ink-secondary text-sm font-mono whitespace-nowrap">{formatCLP(c.monto)}</td>
                            <td className="px-4 py-3.5 text-ink-secondary text-sm hidden md:table-cell whitespace-nowrap">{formatFecha(c.fechaVencimiento)}</td>
                            <td className="px-4 py-3.5 hidden md:table-cell">
                              {diasAtraso !== null && diasAtraso > 0
                                ? <span className="text-overdue text-sm font-semibold">{diasAtraso}d</span>
                                : <span className="text-ink-disabled text-sm">—</span>
                              }
                            </td>
                            <td className="px-4 py-3.5"><EstadoBadge estado={c.estado} /></td>
                            <td className="px-4 py-3.5">
                              <button
                                onClick={() => setCuotaConfirmando(c)}
                                className="text-xs bg-paid-bg hover:bg-paid text-paid hover:text-white px-3 py-1.5 rounded-md border border-paid-border font-medium transition-all whitespace-nowrap"
                              >
                                Confirmar pago
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Paginación */}
                {totalPagesManual > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-surface-500 bg-surface-800/40">
                    <button
                      onClick={() => setCurrentPageManual((p) => Math.max(1, p - 1))}
                      disabled={currentPageManual === 1}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-surface-400 bg-white text-ink-secondary hover:bg-surface-600 transition-colors disabled:opacity-40"
                    >← Anterior</button>
                    <span className="text-xs text-ink-muted">
                      Página <span className="font-semibold text-ink-primary">{currentPageManual}</span> de <span className="font-semibold text-ink-primary">{totalPagesManual}</span>
                    </span>
                    <button
                      onClick={() => setCurrentPageManual((p) => Math.min(totalPagesManual, p + 1))}
                      disabled={currentPageManual === totalPagesManual}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-surface-400 bg-white text-ink-secondary hover:bg-surface-600 transition-colors disabled:opacity-40"
                    >Siguiente →</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}


        {/* ── TAB: TODAS LAS CUOTAS ──────────────────────────────────────── */}
        {activeTab === 'todas' && (
          <>
            {/* Filtro de estados + botón de refresh */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
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
              <button
                onClick={cargarTodasCuotas}
                disabled={loadingTodas}
                title="Actualizar lista de cuotas"
                className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-primary bg-white border border-surface-400 hover:border-ink-muted px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
              >
                <svg className={`w-3.5 h-3.5 ${loadingTodas ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualizar
              </button>
            </div>

            {loadingTodas ? (
              <div className="bg-white border border-surface-500 rounded-xl p-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="bg-white border border-surface-500 rounded-xl overflow-hidden shadow-card">
                <div className="px-5 py-3 border-b border-surface-500 flex items-center justify-between">
                  <p className="text-ink-muted text-xs">{cuotasFiltradas.length} cuota{cuotasFiltradas.length !== 1 ? 's' : ''} encontrada{cuotasFiltradas.length !== 1 ? 's' : ''}</p>
                  <p className="text-ink-disabled text-xs">Hover sobre 'Pagado' para ver quién aprobó</p>
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
                      {cuotasPaginadas.map((c) => (
                        <tr key={c.id} className="border-b border-surface-500 hover:bg-surface-600/50 transition-colors">
                          <td className="px-4 py-3 text-ink-primary text-sm font-medium">{c.mes} {c.anio}</td>
                          <td className="px-4 py-3 text-ink-primary text-sm">{estudiantesMap[c.estudianteId] ?? <Sk className="w-24 h-4 inline-block" />}</td>
                          <td className="px-4 py-3 text-ink-secondary text-sm font-mono">{formatCLP(c.monto)}</td>
                          <td className="px-4 py-3 text-ink-secondary text-sm hidden md:table-cell">{formatFecha(c.fechaVencimiento)}</td>
                          <td className="px-4 py-3">
                            <div className="group relative">
                              <EstadoBadge estado={c.estado} />
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
                {/* ── Controles de paginación ── */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-surface-500 bg-surface-800/40">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-surface-400 bg-white text-ink-secondary hover:bg-surface-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ← Anterior
                    </button>
                    <span className="text-xs text-ink-muted">
                      Página <span className="font-semibold text-ink-primary">{currentPage}</span> de <span className="font-semibold text-ink-primary">{totalPages}</span>
                      <span className="ml-2 text-ink-disabled">({cuotasFiltradas.length} resultados)</span>
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-surface-400 bg-white text-ink-secondary hover:bg-surface-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}


        {/* ── TAB: ESTUDIANTES ───────────────────────────────────────────── */}
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Estudiante</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">RUT</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Curso</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden md:table-cell">Apoderado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden md:table-cell">Contacto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Estado cuotas</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apoderadosFiltrados.map((e) => {
                        const cuotasEst = todasCuotas.filter(c => c.estudianteId === e.id)
                        const atrasadas = cuotasEst.filter(c => c.estado === 'atrasado').length
                        const pagadas   = cuotasEst.filter(c => c.estado === 'pagado').length
                        const revision  = cuotasEst.filter(c => c.estado === 'en_revision').length

                        return (
                          <tr key={e.id} className="border-b border-surface-500 hover:bg-surface-600/50 transition-colors">
                            <td className="px-4 py-3.5 text-ink-primary text-sm font-medium">
                              {e.nombre ?? '—'}
                              {(e.es_becado || e.beca) && <span className="ml-2 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">Beca</span>}
                            </td>
                            <td className="px-4 py-3.5 text-ink-secondary text-sm font-mono">{e.rut ?? '—'}</td>
                            <td className="px-4 py-3.5 text-ink-secondary text-sm">{e.curso ?? '—'}</td>
                            <td className="px-4 py-3.5 text-ink-secondary text-sm hidden md:table-cell">{e.apoderado_nombre ?? <span className="text-ink-disabled italic">—</span>}</td>
                            <td className="px-4 py-3.5 hidden md:table-cell">
                              <div className="space-y-0.5">
                                {(e.apoderado_email || e.email) && <p className="text-ink-secondary text-xs">{e.apoderado_email || e.email}</p>}
                                {e.telefono && (
                                  <button
                                    onClick={() => {
                                      const cuotasStr = cuotasEst.filter(c => c.estado === 'atrasado' || c.estado === 'pendiente').map(c => c.mes).join(', ')
                                      abrirWhatsApp(e.telefono, e.apoderado_nombre ?? e.nombre, cuotasStr)
                                    }}
                                    className="flex items-center gap-1 text-xs bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white px-2 py-1 rounded font-medium border border-[#25D366]/30 transition-all"
                                  >
                                    💬 {e.telefono}
                                  </button>
                                )}
                                {!e.apoderado_email && !e.email && !e.telefono && <span className="text-ink-disabled text-xs italic">Sin contacto</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {pagadas > 0   && <span className="text-xs bg-paid-bg text-paid border border-paid-border px-2 py-0.5 rounded-full">✓ {pagadas}</span>}
                                {revision > 0  && <span className="text-xs bg-review-bg text-review border border-review-border px-2 py-0.5 rounded-full">⏳ {revision}</span>}
                                {atrasadas > 0 && <span className="text-xs bg-overdue-bg text-overdue border border-overdue-border px-2 py-0.5 rounded-full font-semibold">⚠ {atrasadas}</span>}
                                {cuotasEst.length === 0 && <span className="text-ink-disabled text-xs italic">Sin cuotas</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <button
                                onClick={() => setEstudianteEditando(e)}
                                className="text-xs bg-surface-600 hover:bg-surface-500 text-ink-secondary px-2.5 py-1.5 rounded-md border border-surface-400 transition-colors whitespace-nowrap"
                              >
                                Editar
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {apoderadosFiltrados.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-ink-muted text-sm">No se encontraron estudiantes.</td></tr>
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

        {/* ── TAB: CONFIGURACIÓN ─────────────────────────────────────────── */}
        {activeTab === 'configuracion' && (
          <SeccionConfiguracion />
        )}

        {/* ── SOPORTE TÉCNICO ─────────────────────────────────────────────── */}
        <div className="pt-2">

          {/* Soporte Técnico */}
          <div className="bg-white border border-surface-500 rounded-xl px-5 py-4 shadow-card max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-ink-primary text-sm font-semibold">Soporte Técnico</p>
                <p className="text-ink-muted text-xs">SynapTech Spa</p>
              </div>
            </div>
            <div className="space-y-2">
              <a
                href="https://wa.me/56983568212"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[#25D366] hover:text-white hover:bg-[#25D366] px-2 py-1 rounded-md border border-[#25D366]/30 bg-[#25D366]/5 transition-all w-fit font-medium"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                +56 9 8356 8212
              </a>
              <a
                href="mailto:ignaciiio.mate@gmail.com"
                className="flex items-center gap-2 text-xs text-ink-secondary hover:text-blue-600 transition-colors group"
              >
                <svg className="w-3.5 h-3.5 text-ink-muted group-hover:text-blue-600 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                ignaciiio.mate@gmail.com
              </a>
            </div>
          </div>

        </div>

      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-surface-600 mt-4 py-4">
        <p className="text-center text-ink-disabled text-xs tracking-wide">
          Desarrollado por: <span className="font-medium text-ink-muted">SynapTech Spa</span>
        </p>
      </footer>

      {/* ── MODALES ────────────────────────────────────────────────────────── */}
      {modalUrl && <ModalComprobante url={modalUrl} onClose={() => setModalUrl(null)} />}
      {modalRegistrar && <ModalRegistrarEstudiante onClose={() => setModalRegistrar(false)} onSuccess={() => {}} />}
      {estudianteEditando && (
        <ModalEditarEstudiante
          estudiante={estudianteEditando}
          onClose={() => setEstudianteEditando(null)}
          onSaved={() => setEstudianteEditando(null)}
        />
      )}
      {cuotaConfirmando && (
        <ModalConfirmarPagoManual
          cuota={cuotaConfirmando}
          nombreEstudiante={estudiantesMap[cuotaConfirmando.estudianteId]}
          estudianteData={estudiantesFullMap[cuotaConfirmando.estudianteId]}
          onClose={() => setCuotaConfirmando(null)}
          onConfirmado={handlePagoManualConfirmado}
        />
      )}

      {/* ── CENTRO DE AYUDA ─────────────────────────────────────────────── */}
      <BotonFlotanteAyuda rol={rolEfectivo} />

    </div>
  )
}
