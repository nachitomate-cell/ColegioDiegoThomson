'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut }       from 'firebase/auth'
import {
  collection, doc, getDocs, onSnapshot, query, updateDoc, where, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { useRouter }     from 'next/navigation'

import { auth, db, storage } from '../firebase/firebaseConfig'
import { useAuth }        from '../hooks/useAuth'
import { useEstudiante }  from '../hooks/useEstudiante'
import { useCuotas }      from '../hooks/useCuotas'
import { useCuotasCGPA }  from '../hooks/useCuotasCGPA'
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


// ─── CASCADA DE PAGOS ────────────────────────────────────────────────────────
// Cuotas deben llegar ordenadas cronológicamente (fecha_vencimiento ASC).
// Solo la primera cuota pendiente/atrasada queda habilitada para pagar.
// Las siguientes pendientes/atrasadas quedan bloqueadas con candado.

function calcularCascada(cuotas) {
  const primerIdx = cuotas.findIndex(
    c => c.estado === 'pendiente' || c.estado === 'atrasado'
  )
  return cuotas.map((cuota, idx) => {
    const necesitaPago = cuota.estado === 'pendiente' || cuota.estado === 'atrasado'
    return {
      ...cuota,
      habilitada: primerIdx !== -1 && idx === primerIdx,
      bloqueada:  primerIdx !== -1 && idx > primerIdx && necesitaPago,
    }
  })
}


// ─── PANTALLA DE CARGA CON LOGO ───────────────────────────────────────────────

function PantallaLoading({ mensaje = 'Cargando...' }) {
  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center gap-10">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-28 h-28 rounded-2xl overflow-hidden shadow-card-lg ring-1 ring-surface-500">
          <img src={LOGO_SRC} alt="Colegio Diego Thomson" className="w-full h-full object-cover" />
        </div>
        <div className="text-center">
          <p className="text-ink-primary font-semibold text-base">Colegio Diego Thomson</p>
          <p className="text-ink-muted text-xs mt-0.5">Portal de Pagos Escolares</p>
        </div>
      </div>
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

function Sk({ className = '' }) {
  return <div className={`bg-surface-600 rounded-lg animate-pulse ${className}`} />
}


// ─── SKELETON COMPLETO DEL DASHBOARD ─────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-900 animate-fade-in">
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
        <div className="space-y-2.5">
          <Sk className="w-52 h-6" />
          <Sk className="w-80 h-4" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
          <div className="lg:col-span-2 grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface-700 border border-surface-500 rounded-xl p-4 space-y-2.5">
                <Sk className="w-28 h-3" />
                <Sk className="w-20 h-6" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface-700 border border-surface-500 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-500 space-y-2">
            <Sk className="w-44 h-4" />
            <Sk className="w-64 h-3" />
          </div>
          <div className="px-4 py-3 bg-surface-800 border-b border-surface-500 flex gap-6">
            {['w-16','w-20','w-24','w-14','w-16'].map((w, i) => <Sk key={i} className={`${w} h-3`} />)}
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-4 border-b border-surface-500 last:border-0" style={{ opacity: 1 - i * 0.07 }}>
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


// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────

function EstadoBadge({ estado }) {
  const cfg = estadoConfig[estado] ?? estadoConfig.pendiente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Ícono candado ─────────────────────────────────────────────────────────────
function IconoCandado({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

// ── Selector de hijo activo ───────────────────────────────────────────────────
function SelectorHijo({ hijos, alumnoActivo, onChange }) {
  if (hijos.length <= 1) return null
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide flex-shrink-0">
        Hijo/a:
      </span>
      <div className="flex gap-2 flex-wrap">
        {hijos.map((hijo) => (
          <button
            key={hijo.id}
            onClick={() => onChange(hijo.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
              ${alumnoActivo === hijo.id
                ? 'bg-accent text-gray-900 shadow-glow-blue'
                : 'bg-surface-600 text-ink-secondary hover:bg-surface-500 hover:text-ink-primary border border-surface-400'
              }`}
          >
            {hijo.nombre.split(' ').slice(0, 2).join(' ')}
            <span className="ml-1.5 text-xs opacity-70">{hijo.curso}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TarjetaProximaCuota({ cuotas, estudiante, onPagar, pagoEnProceso, onAvisarTransferencia }) {
  // La primera cuota habilitada por la cascada es la que se puede pagar
  const proxima = cuotas.find(c => c.habilitada)
  if (!proxima) {
    return (
      <div className="bg-surface-700 border border-surface-500 rounded-xl p-6 shadow-card">
        <p className="text-paid font-semibold text-lg">Sin cuotas pendientes</p>
        <p className="text-ink-muted text-sm mt-1">{estudiante?.nombre} está al día.</p>
      </div>
    )
  }
  const esAtrasada = proxima.estado === 'atrasado'
  const pagando    = pagoEnProceso === proxima.id
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
          className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-gray-900 text-sm font-semibold py-2.5 px-4 rounded-lg transition-all shadow-glow-blue active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {pagando ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              Pagar Online
            </>
          )}
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
  const pagadas        = cuotas.filter(c => c.estado === 'pagado').length
  const revision       = cuotas.filter(c => c.estado === 'en_revision').length
  const atrasadas      = cuotas.filter(c => c.estado === 'atrasado').length
  const montoPendiente = cuotas
    .filter(c => c.estado === 'pendiente' || c.estado === 'atrasado')
    .reduce((acc, c) => acc + c.monto, 0)

  const stats = [
    { label: 'Cuotas pagadas',  value: `${pagadas} / ${total}`, color: 'text-paid'    },
    { label: 'En revisión',     value: revision,                 color: 'text-review'  },
    { label: 'Atrasadas',       value: atrasadas,                color: 'text-overdue' },
    { label: 'Saldo pendiente', value: formatCLP(montoPendiente),color: 'text-pending' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-surface-700 border border-surface-500 rounded-xl p-4 shadow-card">
          <p className="text-ink-muted text-xs uppercase tracking-wider mb-2">{s.label}</p>
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Fila de cuota con lógica de cascada ───────────────────────────────────────
// cuota.habilitada → botones activos
// cuota.bloqueada  → candado con tooltip
// resto            → recibo PDF o "Comprobante enviado"

function FilaCuota({ cuota, pagoEnProceso, onPagar, onAvisarTransferencia, onDescargarRecibo }) {
  const cfg     = estadoConfig[cuota.estado] ?? estadoConfig.pendiente
  const pagando = pagoEnProceso === cuota.id

  return (
    <tr className={`border-b border-surface-500 hover:bg-surface-600 transition-colors group ${cfg.rowAccent}`}>
      <td className="px-4 py-3.5 text-ink-primary text-sm font-medium">{cuota.mes} {cuota.anio}</td>
      <td className="px-4 py-3.5 text-ink-secondary text-sm font-mono">{formatCLP(cuota.monto)}</td>
      <td className="px-4 py-3.5 text-ink-secondary text-sm hidden sm:table-cell">{formatFecha(cuota.fechaVencimiento)}</td>
      <td className="px-4 py-3.5"><EstadoBadge estado={cuota.estado} /></td>
      <td className="px-4 py-3.5">

        {/* ── Cuota bloqueada por cascada ── */}
        {cuota.bloqueada && (
          <div
            title="Debe pagar cuotas anteriores primero"
            className="flex items-center gap-1.5 text-ink-disabled cursor-not-allowed select-none"
          >
            <IconoCandado className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs">Bloqueada</span>
          </div>
        )}

        {/* ── Cuota habilitada para pago ── */}
        {cuota.habilitada && (
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
            <button
              onClick={() => onAvisarTransferencia(cuota)}
              disabled={!!pagoEnProceso}
              className="text-xs bg-surface-500 hover:bg-surface-400 disabled:opacity-50 text-ink-secondary px-3 py-1.5 rounded-md font-medium border border-surface-400 transition-colors"
            >
              Transferencia
            </button>
          </div>
        )}

        {/* ── Comprobante en revisión ── */}
        {cuota.estado === 'en_revision' && !cuota.habilitada && !cuota.bloqueada && (
          <span className="text-xs text-ink-muted">Comprobante enviado</span>
        )}

        {/* ── Recibo de cuota pagada ── */}
        {cuota.estado === 'pagado' && (
          <button
            onClick={() => onDescargarRecibo(cuota)}
            className="flex items-center gap-1.5 text-xs bg-paid-bg hover:bg-paid text-paid hover:text-white px-3 py-1.5 rounded-md font-medium border border-paid-border transition-all active:scale-[0.98] opacity-0 group-hover:opacity-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Recibo PDF
          </button>
        )}

      </td>
    </tr>
  )
}

function TablaCuotas({ cuotas, loading, error, onPagar, onAvisarTransferencia, pagoEnProceso, onDescargarRecibo }) {
  // Las cuotas ya llegan con la cascada calculada desde el componente padre
  const cuotasConCascada = cuotas

  return (
    <div className="bg-surface-700 border border-surface-500 rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-500">
        <h3 className="text-ink-primary font-semibold text-base">Plan de pagos anual</h3>
        <p className="text-ink-muted text-xs mt-0.5">
          Solo la cuota más antigua pendiente puede pagarse — las siguientes se desbloquean en cascada
        </p>
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
              {cuotasConCascada.map(c => (
                <FilaCuota
                  key={c.id}
                  cuota={c}
                  pagoEnProceso={pagoEnProceso}
                  onPagar={onPagar}
                  onAvisarTransferencia={onAvisarTransferencia}
                  onDescargarRecibo={onDescargarRecibo}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ─── MODAL PAGO OPCIONES ─────────────────────────────────────────────────────
// Paso 1: elegir método (Khipu / Transbank)
// Paso 2: si Khipu, elegir banco — se salta la pantalla de banco en khipu.com

function ModalPagoOpciones({ cuota, onClose, onSelectMetodo }) {
  const [paso,          setPaso]          = useState('metodo') // 'metodo' | 'banco'
  const [bancos,        setBancos]        = useState([])
  const [loadingBancos, setLoadingBancos] = useState(false)
  const [errorBancos,   setErrorBancos]   = useState(null)
  const [filtro,        setFiltro]        = useState('')

  const cargarBancos = async () => {
    setLoadingBancos(true)
    setErrorBancos(null)
    try {
      const res  = await fetch('/api/khipu/bancos')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar bancos')
      // Mostrar solo bancos de tipo "Persona", ordenados por nombre
      const lista = (data.banks ?? [])
        .filter(b => b.type === 'Persona')
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      setBancos(lista)
    } catch (err) {
      setErrorBancos(err.message)
    } finally {
      setLoadingBancos(false)
    }
  }

  const irABancos = () => {
    setPaso('banco')
    cargarBancos()
  }

  const bancosFiltrados = filtro.trim()
    ? bancos.filter(b => b.name.toLowerCase().includes(filtro.toLowerCase()))
    : bancos

  // ── Resumen de cuota (shared) ─────────────────────────────────────────────
  const ResumenCuota = () => (
    <div className="bg-surface-800 rounded-xl p-4 flex justify-between items-center">
      <div>
        <p className="text-ink-muted text-xs">Cuota a pagar</p>
        <p className="text-ink-primary font-semibold text-sm">
          {cuota.mes ?? cuota.concepto} {cuota.anio ?? ''}
        </p>
      </div>
      <p className="text-pending font-bold text-lg">{formatCLP(cuota.monto)}</p>
    </div>
  )

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-700 border border-surface-400 rounded-2xl shadow-card-lg w-full max-w-sm animate-slide-up flex flex-col max-h-[85vh]">

        {/* ── PASO 1: Elegir método ────────────────────────────────────────── */}
        {paso === 'metodo' && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-500 flex-shrink-0">
              <h2 className="text-ink-primary font-semibold text-base">¿Cómo deseas pagar?</h2>
              <button onClick={onClose} className="text-ink-muted hover:text-ink-primary text-xl leading-none w-7 h-7 flex items-center justify-center">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <ResumenCuota />
              <div className="space-y-3">
                {/* Khipu → va a selección de banco */}
                <button
                  onClick={irABancos}
                  className="w-full flex items-center justify-between bg-surface-800 hover:bg-surface-600 border border-surface-400 rounded-xl px-4 py-3.5 transition-all group"
                >
                  <div className="text-left">
                    <p className="text-ink-primary text-sm font-semibold">Khipu</p>
                    <p className="text-ink-muted text-xs">Transferencia bancaria simplificada</p>
                  </div>
                  <svg className="w-4 h-4 text-ink-muted group-hover:text-accent-hover transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {/* Transbank → pago directo */}
                <button
                  onClick={() => onSelectMetodo(cuota, 'transbank', null)}
                  className="w-full flex items-center justify-between bg-surface-800 hover:bg-surface-600 border border-surface-400 rounded-xl px-4 py-3.5 transition-all group"
                >
                  <div className="text-left">
                    <p className="text-ink-primary text-sm font-semibold">Transbank WebPay</p>
                    <p className="text-ink-muted text-xs">Débito o crédito</p>
                  </div>
                  <svg className="w-4 h-4 text-ink-muted group-hover:text-accent-hover transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-surface-500 flex-shrink-0">
              <button onClick={onClose} className="w-full py-2.5 rounded-lg text-sm font-medium text-ink-secondary bg-surface-600 hover:bg-surface-500 border border-surface-400 transition-colors">
                Cancelar
              </button>
            </div>
          </>
        )}

        {/* ── PASO 2: Elegir banco (Khipu) ────────────────────────────────── */}
        {paso === 'banco' && (
          <>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-500 flex-shrink-0">
              <button
                onClick={() => { setPaso('metodo'); setFiltro('') }}
                className="text-ink-muted hover:text-ink-primary transition-colors"
                title="Volver"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1">
                <h2 className="text-ink-primary font-semibold text-base">Selecciona tu banco</h2>
                <p className="text-ink-muted text-xs">Khipu · Transferencia bancaria</p>
              </div>
              <button onClick={onClose} className="text-ink-muted hover:text-ink-primary text-xl leading-none w-7 h-7 flex items-center justify-center">×</button>
            </div>

            <div className="px-6 pt-4 pb-3 flex-shrink-0 space-y-3">
              <ResumenCuota />
              {/* Buscador de banco */}
              {!loadingBancos && !errorBancos && bancos.length > 0 && (
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={filtro}
                    onChange={e => setFiltro(e.target.value)}
                    placeholder="Buscar banco..."
                    className="w-full bg-surface-800 border border-surface-500 rounded-lg pl-9 pr-3 py-2 text-sm text-ink-primary placeholder:text-ink-disabled focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Lista de bancos */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {loadingBancos && (
                <div className="flex items-center justify-center py-10 gap-3">
                  <span className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-ink-muted text-sm">Cargando bancos...</span>
                </div>
              )}

              {errorBancos && (
                <div className="py-6 text-center space-y-3">
                  <p className="text-overdue text-sm">{errorBancos}</p>
                  <button
                    onClick={cargarBancos}
                    className="text-xs text-accent hover:underline"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {!loadingBancos && !errorBancos && (
                <div className="space-y-1.5">
                  {bancosFiltrados.length === 0 && (
                    <p className="text-ink-muted text-sm text-center py-6">
                      {filtro ? 'Sin resultados' : 'No hay bancos disponibles'}
                    </p>
                  )}
                  {bancosFiltrados.map(banco => (
                    <button
                      key={banco.bank_id}
                      onClick={() => onSelectMetodo(cuota, 'khipu', banco.bank_id)}
                      className="w-full flex items-center gap-3 bg-surface-800 hover:bg-surface-600 border border-surface-500 hover:border-accent/50 rounded-xl px-4 py-3 transition-all text-left group"
                    >
                      {banco.logo_url ? (
                        <img
                          src={banco.logo_url}
                          alt={banco.name}
                          className="w-7 h-7 rounded object-contain flex-shrink-0 bg-white p-0.5"
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-7 h-7 rounded bg-surface-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l9-3 9 3M3 6v14a1 1 0 001 1h5v-5h4v5h5a1 1 0 001-1V6M3 6h18" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-ink-primary text-sm font-medium truncate group-hover:text-accent-hover transition-colors">
                          {banco.name}
                        </p>
                        {banco.min_amount > 0 && (
                          <p className="text-ink-disabled text-xs">Mínimo {formatCLP(banco.min_amount)}</p>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-ink-disabled group-hover:text-accent-hover flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}


// ─── APORTES VOLUNTARIOS ──────────────────────────────────────────────────────

function SeccionAportesVoluntarios({ cuotas, loading, onPagar, onAvisarTransferencia, pagoEnProceso }) {
  if (loading || cuotas.length === 0) return null
  return (
    <div className="bg-surface-700 border border-surface-500 rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-500">
        <h3 className="text-ink-primary font-semibold text-base">Aportes Voluntarios — Familia</h3>
        <p className="text-ink-muted text-xs mt-0.5">
          Cuotas opcionales de la familia · no están sujetas a la cascada de pagos
        </p>
      </div>
      <div className="divide-y divide-surface-500">
        {cuotas.map(cuota => (
          <div key={cuota.id} className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-ink-primary text-sm font-medium">{cuota.concepto}</p>
              <p className="text-ink-muted text-xs font-mono">{formatCLP(cuota.monto)}</p>
            </div>
            <EstadoBadge estado={cuota.estado} />
            <div className="flex gap-2 items-center">
              {cuota.estado === 'pagado' && (
                <span className="text-xs text-paid font-semibold">Pagado ✓</span>
              )}
              {cuota.estado === 'en_revision' && (
                <span className="text-xs text-ink-muted">Comprobante enviado</span>
              )}
              {(cuota.estado === 'pendiente') && (
                <>
                  <button
                    onClick={() => onPagar(cuota)}
                    disabled={!!pagoEnProceso}
                    className="text-xs bg-accent hover:bg-accent-hover disabled:opacity-50 text-gray-900 px-3 py-1.5 rounded-md font-semibold transition-all active:scale-[0.98]"
                  >
                    Pagar
                  </button>
                  <button
                    onClick={() => onAvisarTransferencia(cuota)}
                    disabled={!!pagoEnProceso}
                    className="text-xs bg-surface-500 hover:bg-surface-400 disabled:opacity-50 text-ink-secondary px-3 py-1.5 rounded-md font-medium border border-surface-400 transition-colors"
                  >
                    Transferencia
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ─── MATRÍCULA 2027 ───────────────────────────────────────────────────────────

const MONTO_MATRICULA_2027 = 97_500

function ModalMatricula2027({ estudiante, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-700 border border-surface-400 rounded-2xl shadow-card-lg w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-500">
          <div>
            <h2 className="text-ink-primary font-semibold text-base">Matrícula 2027</h2>
            <p className="text-ink-muted text-xs mt-0.5">Colegio Diego Thomson</p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary text-xl leading-none w-7 h-7 flex items-center justify-center transition-colors">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Resumen */}
          <div className="bg-surface-800 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-ink-muted text-xs">Estudiante</p>
              <p className="text-ink-primary font-semibold text-sm">{estudiante?.nombre ?? '—'}</p>
              <p className="text-ink-muted text-xs">{estudiante?.curso ?? ''}</p>
            </div>
            <div className="text-right">
              <p className="text-ink-muted text-xs">Monto</p>
              <p className="text-accent-hover font-bold text-xl">{formatCLP(MONTO_MATRICULA_2027)}</p>
              <p className="text-ink-disabled text-xs">cuota única</p>
            </div>
          </div>

          {/* Datos de transferencia */}
          <div className="bg-surface-800 rounded-xl p-4 space-y-2">
            <p className="text-ink-muted text-xs uppercase tracking-wider mb-3">Datos para transferencia bancaria</p>
            {[
              ['Banco',   'Banco Estado'],
              ['Cuenta',  '123-456-789'],
              ['RUT',     '76.123.456-7'],
              ['Titular', 'Colegio Diego Thomson'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className="text-ink-muted text-xs">{k}</span>
                <span className="text-ink-primary text-sm font-medium font-mono">{v}</span>
              </div>
            ))}
          </div>

          {/* Instrucciones */}
          <div className="bg-surface-800 rounded-xl p-4 space-y-1.5">
            <p className="text-ink-muted text-xs uppercase tracking-wider mb-2">Después de transferir</p>
            <p className="text-ink-secondary text-xs leading-relaxed">
              Envía el comprobante indicando el <span className="font-semibold">nombre del estudiante</span> a la secretaría del colegio para confirmar tu matrícula.
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-surface-500">
          <a
            href="mailto:secretaria@colegiodiegothompson.cl?subject=Comprobante Matrícula 2027"
            className="flex-1 py-2.5 rounded-lg text-xs font-semibold text-ink-primary bg-surface-600 hover:bg-surface-500 border border-surface-400 text-center transition-colors"
          >
            Enviar por Email
          </a>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium text-ink-secondary bg-surface-800 hover:bg-surface-700 border border-surface-500 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function TarjetaMatricula2027({ estudiante, onVerInstrucciones }) {
  return (
    <div className="relative overflow-hidden bg-surface-700 border border-accent/30 rounded-xl p-6 shadow-card-lg">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-8 -right-8 w-36 h-36 bg-accent/5 rounded-full pointer-events-none" />

      <div className="relative space-y-4">
        {/* Badge + título */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-hover bg-accent/10 border border-accent/25 px-2.5 py-1 rounded-full mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Disponible ahora
            </span>
            <h2 className="text-ink-primary text-xl font-bold leading-tight">Matrícula 2027</h2>
            <p className="text-ink-muted text-sm mt-1">
              Asegura el cupo de{' '}
              <span className="text-ink-secondary font-medium">
                {estudiante?.nombre?.split(' ').slice(0, 2).join(' ') ?? 'tu hijo/a'}
              </span>{' '}
              para el año escolar 2027.
            </p>
          </div>
        </div>

        {/* Monto */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-ink-primary">{formatCLP(MONTO_MATRICULA_2027)}</span>
          <span className="text-ink-muted text-sm">· cuota única</span>
        </div>

        {/* CTA */}
        <button
          onClick={onVerInstrucciones}
          className="w-full bg-accent hover:bg-accent-hover text-gray-900 text-sm font-semibold py-2.5 px-4 rounded-lg transition-all shadow-glow-blue active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Ver instrucciones de pago
        </button>
      </div>
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
    if (uploadTaskRef.current) uploadTaskRef.current.cancel()
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
          snap => setProgreso(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          err  => reject(err),
          ()   => resolve(uploadTask.snapshot)
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
      onClick={e => e.target === e.currentTarget && handleCancel()}
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
                onChange={e => {
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
          <button onClick={handleCancel} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-ink-secondary bg-surface-600 hover:bg-surface-500 border border-surface-400 transition-colors">
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

  const { user, loading: authLoading }                                     = useAuth()
  const { estudiante, loading: estudianteLoading, error: estudianteError } = useEstudiante(user?.uid)

  // ── Hijos del apoderado ────────────────────────────────────────────────────
  // Un apoderado puede tener múltiples hijos. Se buscan todos los estudiantes
  // con el mismo apoderado_rut_limpio. Requiere la regla de Firestore actualizada.
  const [listaHijos, setListaHijos] = useState([])
  const [alumnoActivo, setAlumnoActivo] = useState(null)

  useEffect(() => {
    if (!estudiante || !user?.uid) return

    // Inicializar el alumno activo con el estudiante del usuario autenticado
    setAlumnoActivo(prev => prev ?? user.uid)

    const rutLimpio = estudiante.apoderado_rut_limpio

    if (!rutLimpio) {
      // Sin apoderado vinculado: solo mostrar el estudiante actual
      setListaHijos([{ id: user.uid, ...estudiante }])
      return
    }

    // Buscar todos los hijos del apoderado (mismo apoderado_rut_limpio)
    getDocs(
      query(
        collection(db, 'Estudiantes'),
        where('apoderado_rut_limpio', '==', rutLimpio)
      )
    )
      .then(snap => {
        let hijos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // Garantizar que el estudiante logueado siempre aparece
        if (!hijos.find(h => h.id === user.uid)) {
          hijos = [{ id: user.uid, ...estudiante }, ...hijos]
        }
        // Ordenar por nombre para consistencia
        hijos.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''))
        setListaHijos(hijos)
      })
      .catch(() => {
        // Firestore denegó la consulta (regla no actualizada o sin hermanos)
        setListaHijos([{ id: user.uid, ...estudiante }])
      })
  }, [estudiante, user?.uid])

  // Datos del estudiante actualmente seleccionado (para KPIs, recibos, header)
  const estudianteActivo = listaHijos.find(h => h.id === alumnoActivo) ?? estudiante

  // ── Configuración global (master switch) ──────────────────────────────────
  const [admiteMatricula2027,  setAdmiteMatricula2027]  = useState(false)
  const [modalMatricula2027,   setModalMatricula2027]   = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'configuracion', 'periodo_escolar'),
      (snap) => setAdmiteMatricula2027(snap.data()?.admite_matricula_2027 ?? false),
      ()     => {} // silenciar error de permisos en el montaje inicial
    )
    return () => unsub()
  }, [])

  // ── Cuotas — reactivas al alumnoActivo ────────────────────────────────────
  const { cuotas, loading: cuotasLoading, error: cuotasError } = useCuotas(alumnoActivo)

  // ── Cuotas voluntarias (CGPA) — por familia, no por alumno ───────────────
  const { cuotas: cuotasCGPA, loading: cgpaLoading } = useCuotasCGPA(
    estudiante?.apoderado_rut_limpio ?? null
  )

  const [modalCuota, setModalCuota]     = useState(null)
  const [pagoEnProceso, setPagoEnProceso] = useState(null)
  const [modalPagarCuota, setModalPagarCuota] = useState(null)


  const handlePagarSeleccion = (cuota) => {
    if (pagoEnProceso) return
    setModalPagarCuota(cuota)
  }

  const handleProcesarPago = async (cuota, metodo, bankId = null) => {
    setModalPagarCuota(null)
    setPagoEnProceso(cuota.id)

    try {
      const endpoint = metodo === 'khipu' ? '/api/khipu/iniciar' : '/api/pago/iniciar'
      const body     = metodo === 'khipu'
        ? { cuotaId: cuota.id, bankId }
        : { cuotaId: cuota.id }

      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? 'Error al iniciar el pago. Intenta nuevamente.')
        setPagoEnProceso(null)
        return
      }

      if (metodo === 'khipu') {
        // Khipu devuelve un link directo (GET redirigible)
        window.location.href = data.payment_url;
      } else {
        // Transbank requiere form POST
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
      }
    } catch (err) {
      console.error('[Dashboard] Error al iniciar pago:', err)
      alert('Error de conexión. Verifica tu red e intenta nuevamente.')
      setPagoEnProceso(null)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/login')
  }

  const handleDescargarRecibo = (cuota) => {
    generarReciboPDF({
      nombreEstudiante:   estudianteActivo?.nombre         ?? '',
      curso:              estudianteActivo?.curso          ?? '',
      nombreApoderado:    estudianteActivo?.apoderado_nombre ?? '',
      rutApoderado:       estudianteActivo?.apoderado_rut    ?? '',
      mes:                cuota.mes,
      anio:               cuota.anio,
      monto:              cuota.monto,
      fechaPago:          cuota.fechaPago ?? null,
      codigoAutorizacion: cuota.transbank_auth_code ?? null,
      cuotaId:            cuota.id,
    })
  }

  // Cuotas con cascada precalculada (se recalcula en cada render tras cambio de cuotas)
  const cuotasConCascada = calcularCascada(cuotas)

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (authLoading)      return <PantallaLoading mensaje="Verificando sesión..." />
  if (!user)            { router.push('/login'); return <PantallaLoading mensaje="Redirigiendo..." /> }
  if (estudianteLoading) return <DashboardSkeleton />
  if (estudianteError)  return <PantallaError mensaje={estudianteError.message} />
  if (!estudiante)      return <PantallaError mensaje="No se encontró tu perfil. Contacta al colegio." />

  // Nombre de pila del apoderado
  const nombreApoderado = estudianteActivo?.apoderado_nombre?.split(' ')[0] ?? 'Apoderado'

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-surface-900 text-ink-primary font-sans">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="bg-surface-800 border-b border-surface-500 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7 rounded-lg overflow-hidden ring-1 ring-surface-400 flex-shrink-0">
              <img src={LOGO_SRC} alt="Colegio Diego Thomson" className="w-full h-full object-cover" />
            </div>
            <span className="text-ink-primary font-semibold text-sm">Portal Escolar</span>
          </div>

          {/* Apoderado info + logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-ink-primary text-xs font-medium leading-tight">
                {estudianteActivo?.apoderado_nombre ?? estudiante.apoderado_nombre ?? '—'}
              </p>
              <p className="text-ink-muted text-xs leading-tight">
                Apoderado · {estudianteActivo?.apoderado_rut ?? '—'}
              </p>
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

        {/* ── Saludo apoderado ────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <img
              src={LOGO_SRC}
              alt="Colegio Diego Thomson"
              className="w-12 h-auto flex-shrink-0"
            />
            <div>
              <h1 className="text-ink-primary text-xl font-bold">
                Bienvenido/a, {nombreApoderado}
              </h1>
              <p className="text-ink-muted text-sm mt-0.5">Portal del Apoderado · Año lectivo 2026</p>
            </div>
          </div>

          {/* ── Selector de hijo ────────────────────────────────────────── */}
          <SelectorHijo
            hijos={listaHijos}
            alumnoActivo={alumnoActivo}
            onChange={id => { setAlumnoActivo(id); setPagoEnProceso(null) }}
          />

          {/* ── Ficha del estudiante activo ──────────────────────────────── */}
          {estudianteActivo && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted
              bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 w-fit"
            >
              <span className="text-ink-secondary font-medium">{estudianteActivo.nombre}</span>
              <span className="text-surface-400">·</span>
              <span>{estudianteActivo.curso}</span>
              <span className="text-surface-400">·</span>
              <span className="font-mono">{estudianteActivo.rut}</span>
              {(estudianteActivo.es_becado || estudianteActivo.beca) && (
                <span className="text-amber-500 font-semibold">★ Beca</span>
              )}
            </div>
          )}
        </div>

        {/* ── Matrícula 2027 — Hero Section (solo si el master switch está ON) ─ */}
        {admiteMatricula2027 && (
          <TarjetaMatricula2027
            estudiante={estudianteActivo}
            onVerInstrucciones={() => setModalMatricula2027(true)}
          />
        )}

        {/* ── KPIs + Próxima cuota ─────────────────────────────────────────── */}
        {!cuotasLoading && !cuotasError && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1">
              <TarjetaProximaCuota
                cuotas={cuotasConCascada}
                estudiante={estudiante}
                onPagar={handlePagarSeleccion}
                pagoEnProceso={pagoEnProceso}
                onAvisarTransferencia={(cuota) => setModalCuota(cuota)}
              />
            </div>
            <div className="lg:col-span-2">
              <ResumenAnual cuotas={cuotas} />
            </div>
          </div>
        )}

        {/* ── Tabla de cuotas con cascada ─────────────────────────────────── */}
        <TablaCuotas
          cuotas={cuotasConCascada}
          loading={cuotasLoading}
          error={cuotasError}
          pagoEnProceso={pagoEnProceso}
          onPagar={handlePagarSeleccion}
          onAvisarTransferencia={(cuota) => setModalCuota(cuota)}
          onDescargarRecibo={handleDescargarRecibo}
        />

        {/* ── Aportes Voluntarios (CGPA) ──────────────────────────────────── */}
        <SeccionAportesVoluntarios
          cuotas={cuotasCGPA}
          loading={cgpaLoading}
          pagoEnProceso={pagoEnProceso}
          onPagar={handlePagarSeleccion}
          onAvisarTransferencia={(cuota) => setModalCuota(cuota)}
        />

        {/* ── Contacto Institucional ──────────────────────────────────────── */}
        <div className="bg-surface-700 border border-surface-500 rounded-xl px-5 py-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-accent-hover" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-ink-primary text-sm font-semibold">Contacto Institucional</p>
              <p className="text-ink-muted text-xs">¿Tienes dudas? Escríbenos directamente</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="mailto:secretaria@colegiodiegothompson.cl"
              className="flex items-center gap-2 text-xs text-ink-secondary hover:text-accent-hover transition-colors group"
            >
              <svg className="w-3.5 h-3.5 text-ink-muted group-hover:text-accent-hover transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              secretaria@colegiodiegothompson.cl
            </a>
            <span className="hidden sm:block text-surface-500">·</span>
            <a href="mailto:p.torres@colegiodiegothompson.cl"
              className="flex items-center gap-2 text-xs text-ink-secondary hover:text-accent-hover transition-colors group"
            >
              <svg className="w-3.5 h-3.5 text-ink-muted group-hover:text-accent-hover transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              p.torres@colegiodiegothompson.cl
            </a>
          </div>
        </div>

        <p className="text-center text-ink-muted text-xs pb-4">
          Portal de Pagos Escolar · Año lectivo 2026
        </p>
      </main>

      {admiteMatricula2027 && modalMatricula2027 && (
        <ModalMatricula2027
          estudiante={estudianteActivo}
          onClose={() => setModalMatricula2027(false)}
        />
      )}

      {modalCuota && (
        <ModalTransferencia
          cuota={modalCuota}
          onClose={() => setModalCuota(null)}
        />
      )}
      
      {modalPagarCuota && (
        <ModalPagoOpciones
          cuota={modalPagarCuota}
          onClose={() => setModalPagarCuota(null)}
          onSelectMetodo={handleProcesarPago}
        />
      )}
    </div>
  )
}
