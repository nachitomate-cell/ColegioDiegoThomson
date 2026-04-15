'use client'

import { useState, useRef } from 'react'
import Image             from 'next/image'
import { signOut }       from 'firebase/auth'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { useRouter }     from 'next/navigation'

import { auth, db, storage } from '../firebase/firebaseConfig'
import { useAuth }        from '../hooks/useAuth'
import { useEstudiante }  from '../hooks/useEstudiante'
import { useCuotas }      from '../hooks/useCuotas'
import { generarReciboPDF } from '../lib/generarReciboPDF'
import { LOGO_SRC }         from '../lib/logo'


// ─── HELPERS ─────────────────────────────────────────────────────────────────

const formatCLP = (monto) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0
  }).format(monto)

const formatFecha = (date) => {
  if (!date) return '—'
  return date.toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

const estadoConfig = {
  pagado:      { label: 'Pagado',      dot: 'bg-paid',    badge: 'bg-paid-bg text-paid border border-paid-border',         rowAccent: '' },
  en_revision: { label: 'En Revisión', dot: 'bg-review',  badge: 'bg-review-bg text-review border border-review-border',   rowAccent: '' },
  pendiente:   { label: 'Pendiente',   dot: 'bg-pending', badge: 'bg-pending-bg text-pending border border-pending-border', rowAccent: '' },
  atrasado:    { label: 'Atrasado',    dot: 'bg-overdue', badge: 'bg-overdue-bg text-overdue border border-overdue-border', rowAccent: 'border-l-2 border-overdue' },
}


// ─── PANTALLA DE CARGA CON LOGO ───────────────────────────────────────────────

function PantallaLoading({ mensaje = 'Cargando...' }) {
  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center gap-10">

      {/* Logo */}
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-28 h-28 rounded-2xl overflow-hidden shadow-card-lg ring-1 ring-surface-500">
          <img
            src={LOGO_SRC}
            alt="Colegio Diego Thomson"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="text-center">
          <p className="text-ink-primary font-semibold text-base">Colegio Diego Thomson</p>
          <p className="text-ink-muted text-xs mt-0.5">Portal de Pagos Escolares</p>
        </div>
      </div>

      {/* Barra de progreso deslizante */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-48 h-0.5 bg-surface-700 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-accent rounded-full animate-bar-slide" />
        </div>
        <p className="text-ink-muted text-xs tracking-wide">{mensaje}</p>
      </div>

    </div>
  )
}


// ─── SKELETON HELPERS ─────────────────────────────────────────────────────────

/** Bloque shimmer reutilizable */
function Sk({ className = '' }) {
  return (
    <div className={`bg-surface-600 rounded-lg animate-pulse ${className}`} />
  )
}


// ─── SKELETON COMPLETO DEL DASHBOARD ─────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-900 animate-fade-in">

      {/* ── Header skeleton ──────────────────────────────────────────────────── */}
      <header className="bg-surface-800 border-b border-surface-500 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sk className="w-7 h-7 rounded-lg" />
            <Sk className="w-32 h-3.5" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end gap-2">
              <Sk className="w-36 h-3" />
              <Sk className="w-28 h-3" />
            </div>
            <Sk className="w-8 h-8 rounded-full" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Saludo ───────────────────────────────────────────────────────── */}
        <div className="space-y-2.5">
          <Sk className="w-52 h-6" />
          <Sk className="w-80 h-4" />
        </div>

        {/* ── Grid: tarjeta próxima + estadísticas ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Tarjeta próxima cuota */}
          <div className="lg:col-span-1 bg-surface-700 border border-surface-500 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Sk className="w-24 h-3" />
                <Sk className="w-36 h-7" />
              </div>
              <Sk className="w-22 h-6 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Sk className="h-[60px] rounded-lg" />
              <Sk className="h-[60px] rounded-lg" />
            </div>
            <div className="flex gap-3 pt-1">
              <Sk className="flex-1 h-10 rounded-lg" />
              <Sk className="flex-1 h-10 rounded-lg" />
            </div>
          </div>

          {/* Estadísticas anuales (2×2) */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface-700 border border-surface-500 rounded-xl p-4 space-y-2.5">
                <Sk className="w-28 h-3" />
                <Sk className="w-20 h-6" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabla skeleton ───────────────────────────────────────────────── */}
        <div className="bg-surface-700 border border-surface-500 rounded-xl overflow-hidden">

          {/* Cabecera de la tarjeta */}
          <div className="px-5 py-4 border-b border-surface-500 space-y-2">
            <Sk className="w-44 h-4" />
            <Sk className="w-64 h-3" />
          </div>

          {/* Cabecera de la tabla */}
          <div className="px-4 py-3 bg-surface-800 border-b border-surface-500 flex gap-6">
            {['w-16','w-20','w-24','w-14','w-16'].map((w, i) => (
              <Sk key={i} className={`${w} h-3`} />
            ))}
          </div>

          {/* Filas */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="px-4 py-3.5 flex items-center gap-4 border-b border-surface-500 last:border-0"
              style={{ opacity: 1 - i * 0.07 }}
            >
              <Sk className="w-24 h-4" />
              <Sk className="w-20 h-4" />
              <Sk className="w-28 h-4 hidden sm:block" />
              <Sk className="w-20 h-5 rounded-full" />
              <Sk className="w-16 h-7 rounded-md ml-auto" />
            </div>
          ))}
        </div>

      </main>
    </div>
  )
}


// ─── PANTALLA DE ERROR ────────────────────────────────────────────────────────

function PantallaError({ mensaje }) {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="bg-surface-700 border border-overdue-border rounded-xl p-8 max-w-sm w-full text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-overdue-bg border border-overdue-border flex items-center justify-center mx-auto">
          <span className="text-overdue text-lg font-bold">!</span>
        </div>
        <p className="text-overdue font-semibold">Error al cargar</p>
        <p className="text-ink-muted text-sm">{mensaje}</p>
      </div>
    </div>
  )
}


// ─── SUBCOMPONENTES ───────────────────────────────────────────────────────────

function EstadoBadge({ estado }) {
  const cfg = estadoConfig[estado] ?? estadoConfig.pendiente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function SelectorEstudiante({ estudiantes, seleccionado, onChange }) {
  if (estudiantes.length <= 1) return null
  return (
    <div className="flex gap-2 flex-wrap">
      {estudiantes.map((est) => (
        <button
          key={est.id}
          onClick={() => onChange(est.id)}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${seleccionado === est.id
              ? 'bg-accent text-gray-900 shadow-glow-blue'
              : 'bg-surface-600 text-ink-secondary hover:bg-surface-500 hover:text-ink-primary'
            }
          `}
        >
          {est.nombre}
          <span className="ml-1.5 text-xs opacity-70">{est.curso}</span>
        </button>
      ))}
    </div>
  )
}

function TarjetaProximaCuota({ cuotas, estudiante, onPagar, pagoEnProceso, onAvisarTransferencia }) {
  const proxima = cuotas.find((c) => c.estado === 'pendiente' || c.estado === 'atrasado')
  if (!proxima) {
    return (
      <div className="bg-surface-700 border border-surface-500 rounded-xl p-6 shadow-card">
        <p className="text-paid font-semibold text-lg">Sin cuotas pendientes</p>
        <p className="text-ink-muted text-sm mt-1">{estudiante.nombre} está al día.</p>
      </div>
    )
  }
  const esAtrasada = proxima.estado === 'atrasado'
  const pagando   = pagoEnProceso === proxima.id
  return (
    <div className={`bg-surface-700 border rounded-xl p-6 shadow-card-lg transition-all
      ${esAtrasada ? 'border-overdue-border shadow-glow-red' : 'border-pending-border shadow-glow-orange'}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-ink-muted text-xs uppercase tracking-widest mb-1">Próxima cuota</p>
          <h2 className="text-ink-primary text-2xl font-bold">{formatCLP(proxima.monto)}</h2>
        </div>
        <EstadoBadge estado={proxima.estado} />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-surface-800 rounded-lg p-3">
          <p className="text-ink-muted text-xs mb-0.5">Mes</p>
          <p className="text-ink-primary text-sm font-medium">{proxima.mes}</p>
        </div>
        <div className="bg-surface-800 rounded-lg p-3">
          <p className="text-ink-muted text-xs mb-0.5">Vence</p>
          <p className={`text-sm font-medium ${esAtrasada ? 'text-overdue' : 'text-ink-primary'}`}>
            {formatFecha(proxima.fechaVencimiento)}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => onPagar(proxima)}
          disabled={!!pagoEnProceso}
          className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-gray-900 text-sm font-semibold py-2.5 px-4 rounded-lg transition-all shadow-glow-blue active:scale-[0.98]"
        >
          {pagando ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
              Conectando...
            </span>
          ) : 'Pagar Online'}
        </button>
        <button
          onClick={() => onAvisarTransferencia(proxima)}
          disabled={!!pagoEnProceso}
          className="flex-1 bg-white hover:bg-surface-600 disabled:opacity-50 text-ink-primary text-sm font-semibold py-2.5 px-4 rounded-lg border border-surface-400 transition-all"
        >
          Avisar Transferencia
        </button>
      </div>
    </div>
  )
}

function ResumenAnual({ cuotas }) {
  const total          = cuotas.length
  const pagadas        = cuotas.filter((c) => c.estado === 'pagado').length
  const revision       = cuotas.filter((c) => c.estado === 'en_revision').length
  const atrasadas      = cuotas.filter((c) => c.estado === 'atrasado').length
  const montoPendiente = cuotas
    .filter((c) => c.estado === 'pendiente' || c.estado === 'atrasado')
    .reduce((acc, c) => acc + c.monto, 0)

  const stats = [
    { label: 'Cuotas pagadas',  value: `${pagadas} / ${total}`, color: 'text-paid'    },
    { label: 'En revisión',     value: revision,                 color: 'text-review'  },
    { label: 'Atrasadas',       value: atrasadas,                color: 'text-overdue' },
    { label: 'Saldo pendiente', value: formatCLP(montoPendiente),color: 'text-pending' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface-700 border border-surface-500 rounded-xl p-4 shadow-card">
          <p className="text-ink-muted text-xs uppercase tracking-wider mb-2">{s.label}</p>
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  )
}

function FilaCuota({ cuota, pagoEnProceso, onPagar, onAvisarTransferencia, onDescargarRecibo }) {
  const cfg      = estadoConfig[cuota.estado] ?? estadoConfig.pendiente
  const accionable = cuota.estado === 'pendiente' || cuota.estado === 'atrasado'
  const pagando  = pagoEnProceso === cuota.id
  return (
    <tr className={`border-b border-surface-500 hover:bg-surface-600 transition-colors group ${cfg.rowAccent}`}>
      <td className="px-4 py-3.5 text-ink-primary text-sm font-medium">{cuota.mes} {cuota.anio}</td>
      <td className="px-4 py-3.5 text-ink-secondary text-sm font-mono">{formatCLP(cuota.monto)}</td>
      <td className="px-4 py-3.5 text-ink-secondary text-sm hidden sm:table-cell">{formatFecha(cuota.fechaVencimiento)}</td>
      <td className="px-4 py-3.5"><EstadoBadge estado={cuota.estado} /></td>
      <td className="px-4 py-3.5">
        {accionable ? (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onPagar(cuota)}
              disabled={!!pagoEnProceso}
              className="text-xs bg-accent hover:bg-accent-hover disabled:opacity-50 text-gray-900 px-3 py-1.5 rounded-md font-semibold transition-all active:scale-[0.98]"
            >
              {pagando ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                  ...
                </span>
              ) : 'Pagar'}
            </button>
            <button onClick={() => onAvisarTransferencia(cuota)} disabled={!!pagoEnProceso} className="text-xs bg-surface-500 hover:bg-surface-400 disabled:opacity-50 text-ink-secondary px-3 py-1.5 rounded-md font-medium border border-surface-400 transition-colors">
              Transferencia
            </button>
          </div>
        ) : cuota.estado === 'en_revision' ? (
          <span className="text-xs text-ink-muted">Comprobante enviado</span>
        ) : cuota.estado === 'pagado' ? (
          <button
            onClick={() => onDescargarRecibo(cuota)}
            className="flex items-center gap-1.5 text-xs bg-paid-bg hover:bg-paid text-paid hover:text-white px-3 py-1.5 rounded-md font-medium border border-paid-border transition-all active:scale-[0.98] opacity-0 group-hover:opacity-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Recibo PDF
          </button>
        ) : null}
      </td>
    </tr>
  )
}

function TablaCuotas({ cuotas, loading, error, onPagar, onAvisarTransferencia, pagoEnProceso, onDescargarRecibo }) {
  return (
    <div className="bg-surface-700 border border-surface-500 rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-500">
        <h3 className="text-ink-primary font-semibold text-base">Plan de pagos anual</h3>
        <p className="text-ink-muted text-xs mt-0.5">Todas las cuotas del año escolar</p>
      </div>
      {loading ? (
        <div className="divide-y divide-surface-500">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-4" style={{ opacity: 1 - i * 0.08 }}>
              <Sk className="w-24 h-4" />
              <Sk className="w-20 h-4" />
              <Sk className="w-28 h-4 hidden sm:block" />
              <Sk className="w-20 h-5 rounded-full" />
              <Sk className="w-16 h-7 rounded-md ml-auto" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-overdue text-sm font-medium">Error al cargar las cuotas</p>
          <p className="text-ink-muted text-xs">{error.message}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-500 bg-surface-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Mes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider hidden sm:table-cell">Vencimiento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cuotas.map((c) => (
                <FilaCuota key={c.id} cuota={c} pagoEnProceso={pagoEnProceso} onPagar={onPagar} onAvisarTransferencia={onAvisarTransferencia} onDescargarRecibo={onDescargarRecibo} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ─── MODAL TRANSFERENCIA ──────────────────────────────────────────────────────

function ModalTransferencia({ cuota, onClose }) {
  const [archivo, setArchivo]         = useState(null)
  const [enviando, setEnviando]       = useState(false)
  const [progreso, setProgreso]       = useState(0)
  const [errorUpload, setErrorUpload] = useState(null)
  const uploadTaskRef                 = useRef(null)

  const handleCancel = () => {
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel()
    }
    onClose()
  }

  const handleSubmit = async () => {
    if (!archivo) return
    setEnviando(true)
    setProgreso(0)
    setErrorUpload(null)

    try {
      const timestamp  = Date.now()
      const storageRef = ref(storage, `comprobantes/${cuota.id}/${timestamp}_${archivo.name}`)

      await new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, archivo, {
          contentType: archivo.type,
          customMetadata: {
            cuotaId:      cuota.id,
            estudianteId: cuota.estudianteId,
            subidoPor:    auth.currentUser?.uid ?? 'desconocido',
          },
        })
        uploadTaskRef.current = uploadTask
        uploadTask.on(
          'state_changed',
          (snapshot) => setProgreso(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
          (err) => reject(err),
          () => resolve(uploadTask.snapshot)
        )
      })

      const downloadURL = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'Cuotas', cuota.id), {
        estado:          'en_revision',
        comprobante_url: downloadURL,
        fecha_envio:     serverTimestamp(),
      })
      onClose()
    } catch (err) {
      if (err.code === 'storage/canceled') return

      setErrorUpload(
        err.code === 'storage/unauthorized'
          ? 'Sin permisos para subir archivos. Contacta al colegio.'
          : 'Ocurrió un error al enviar el comprobante. Intenta nuevamente.'
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <div className="bg-surface-700 border border-surface-400 rounded-2xl shadow-card-lg w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-500">
          <h2 className="text-ink-primary font-semibold text-base">Avisar transferencia</h2>
          <button onClick={handleCancel} className="text-ink-muted hover:text-ink-primary transition-colors text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-surface-800 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-ink-muted text-xs">Cuota correspondiente</p>
              <p className="text-ink-primary font-semibold">{cuota.mes} {cuota.anio}</p>
            </div>
            <p className="text-pending font-bold text-lg">{formatCLP(cuota.monto)}</p>
          </div>
          <div className="bg-surface-800 rounded-xl p-4 space-y-1.5">
            <p className="text-ink-muted text-xs uppercase tracking-wider mb-2">Datos para transferencia</p>
            {[
              ['Banco',  'Banco Estado'],
              ['Cuenta', '123-456-789'],
              ['RUT',    '76.123.456-7'],
              ['Nombre', 'Colegio Diego Thomson'],
            ].map(([k, v]) => (
              <p key={k} className="text-ink-secondary text-sm">
                <span className="text-ink-muted">{k}: </span>{v}
              </p>
            ))}
          </div>
          <div>
            <label className="block text-ink-secondary text-sm font-medium mb-2">
              Adjuntar comprobante <span className="text-overdue">*</span>
            </label>
            <label className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors
              ${enviando ? 'border-surface-400 cursor-not-allowed' : 'border-surface-400 hover:border-accent'}`}
            >
              {archivo ? (
                <span className="text-paid text-sm font-medium">{archivo.name}</span>
              ) : (
                <>
                  <span className="text-ink-secondary text-sm">Haz clic o arrastra tu comprobante</span>
                  <span className="text-ink-muted text-xs mt-1">PDF, JPG o PNG (máx. 5 MB)</span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={enviando}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f && f.size > 5 * 1024 * 1024) { setErrorUpload('El archivo supera el límite de 5 MB.'); return }
                  setArchivo(f ?? null)
                  setErrorUpload(null)
                }}
              />
            </label>
          </div>
          {enviando && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-ink-muted">
                <span>{progreso < 100 ? 'Subiendo comprobante...' : 'Actualizando estado...'}</span>
                <span>{progreso}%</span>
              </div>
              <div className="w-full bg-surface-500 rounded-full h-1.5 overflow-hidden">
                <div className="bg-accent h-1.5 rounded-full transition-all duration-300" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}
          {errorUpload && (
            <p className="text-overdue text-xs bg-overdue-bg border border-overdue-border rounded-lg px-3 py-2">{errorUpload}</p>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-surface-500">
          <button onClick={handleCancel} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-ink-secondary bg-surface-600 hover:bg-surface-500 border border-surface-400 transition-colors disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!archivo || enviando} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-900 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {enviando ? 'Enviando...' : 'Enviar comprobante'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()

  const { user, loading: authLoading }                                         = useAuth()
  const { estudiante, loading: estudianteLoading, error: estudianteError }     = useEstudiante(user?.uid)

  // El estudiante logueado tiene Auth UID = ID del doc Estudiantes = ID para cuotas
  const { cuotas, loading: cuotasLoading, error: cuotasError } = useCuotas(user?.uid ?? null)

  const [modalCuota, setModalCuota] = useState(null)

  const [pagoEnProceso, setPagoEnProceso] = useState(null) // cuotaId en proceso

  const handlePagar = async (cuota) => {
    if (pagoEnProceso) return
    setPagoEnProceso(cuota.id)

    try {
      const res = await fetch('/api/pago/iniciar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cuotaId: cuota.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? 'Error al iniciar el pago. Intenta nuevamente.')
        return
      }

      // Redirigir al formulario de pago de Transbank
      // data.url y data.token son los entregados por Transbank
      // Transbank requiere un form POST con el token, no una redirección GET simple
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.url

      const input = document.createElement('input')
      input.type  = 'hidden'
      input.name  = 'token_ws'
      input.value = data.token

      form.appendChild(input)
      document.body.appendChild(form)
      form.submit()

    } catch (err) {
      console.error('[Dashboard] Error al iniciar pago:', err)
      alert('Error de conexión. Verifica tu red e intenta nuevamente.')
    } finally {
      setPagoEnProceso(null)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/login')
  }

  // Quick Win #2: Descargar recibo PDF
  const handleDescargarRecibo = (cuota) => {
    generarReciboPDF({
      nombreEstudiante: estudiante?.nombre         ?? '',
      curso:            estudiante?.curso          ?? '',
      nombreApoderado:  estudiante?.apoderado_nombre ?? '',
      rutApoderado:     estudiante?.apoderado_rut    ?? '',
      mes:              cuota.mes,
      anio:             cuota.anio,
      monto:            cuota.monto,
      fechaPago:        cuota.fechaPago ?? null,
      codigoAutorizacion: cuota.transbank_auth_code ?? null,
      cuotaId:          cuota.id,
    })
  }

  // ── Pantalla inicial mientras Firebase Auth resuelve el estado ─────────────
  if (authLoading) return <PantallaLoading mensaje="Verificando sesión..." />

  // ── Sin sesión → redirigir a login ─────────────────────────────────────────
  if (!user) {
    router.push('/login')
    return <PantallaLoading mensaje="Redirigiendo..." />
  }

  // ── Cargando datos del estudiante → skeleton completo del dashboard ────────
  if (estudianteLoading) return <DashboardSkeleton />

  // ── Error o perfil no encontrado ───────────────────────────────────────────
  if (estudianteError) return <PantallaError mensaje={estudianteError.message} />
  if (!estudiante)     return <PantallaError mensaje="No se encontró tu perfil de estudiante. Contacta al colegio." />

  return (
    <div className="min-h-screen bg-surface-900 text-ink-primary font-sans">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="bg-surface-800 border-b border-surface-500 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

          {/* Logo + nombre */}
          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7 rounded-lg overflow-hidden ring-1 ring-surface-400 flex-shrink-0">
              <img
                src={LOGO_SRC}
                alt="Colegio Diego Thomson"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-ink-primary font-semibold text-sm">Portal Escolar</span>
          </div>

          {/* Info estudiante + logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-ink-primary text-xs font-medium leading-tight">{estudiante.nombre}</p>
              <p className="text-ink-muted text-xs leading-tight">{estudiante.rut} · {estudiante.curso}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="w-8 h-8 rounded-full bg-surface-600 border border-surface-400 text-ink-muted hover:text-ink-primary text-xs transition-colors"
            >
              ↩
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTENIDO ───────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">

        <div className="space-y-3">
          <div>
            <h1 className="text-ink-primary text-xl font-bold">
              Hola, {estudiante.nombre.split(' ')[0]}
            </h1>
            <p className="text-ink-muted text-sm mt-0.5">
              Portal del Estudiante ·{' '}
              <span className="text-ink-secondary">{estudiante.curso}</span>
              {estudiante.beca && (
                <span className="ml-2 text-amber-500 text-xs font-semibold">★ Beca</span>
              )}
            </p>
          </div>
        </div>

        {!cuotasLoading && !cuotasError && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1">
              <TarjetaProximaCuota
                cuotas={cuotas}
                estudiante={estudiante}
                onPagar={handlePagar}
                pagoEnProceso={pagoEnProceso}
                onAvisarTransferencia={(cuota) => setModalCuota(cuota)}
              />
            </div>
            <div className="lg:col-span-2">
              <ResumenAnual cuotas={cuotas} />
            </div>
          </div>
        )}

        <TablaCuotas
          cuotas={cuotas}
          loading={cuotasLoading}
          error={cuotasError}
          pagoEnProceso={pagoEnProceso}
          onPagar={handlePagar}
          onAvisarTransferencia={(cuota) => setModalCuota(cuota)}
          onDescargarRecibo={handleDescargarRecibo}
        />

        <p className="text-center text-ink-muted text-xs pb-4">
          Portal de Pagos Escolar · Año lectivo 2025
        </p>
      </main>

      {modalCuota && (
        <ModalTransferencia
          cuota={modalCuota}
          onClose={() => setModalCuota(null)}
        />
      )}
    </div>
  )
}
