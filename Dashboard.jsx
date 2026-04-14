'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx — Portal de Pagos Escolar
// Estado: MOCK (sin conexión a Firebase)
// Próximo paso: reemplazar MOCK_DATA y MOCK_APODERADO con hooks de Firestore
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

// ─── DATOS MOCKEADOS ─────────────────────────────────────────────────────────
// TODO: Reemplazar con useApoderado(uid) que lea desde Firestore > Apoderados/{rut}

const MOCK_APODERADO = {
  nombre: 'Carlos Fuentes Morales',
  email:  'c.fuentes@gmail.com',
  estudiantes: [
    {
      id:     'est_001',
      nombre: 'Sofía Fuentes',
      curso:  '7° Básico A',
    },
    {
      id:     'est_002',
      nombre: 'Mateo Fuentes',
      curso:  '4° Básico B',
    },
  ],
}

// TODO: Reemplazar con useCuotas(estudianteId) que lea desde Firestore > Cuotas
// where('estudiante_id', '==', estudianteId)
const MOCK_CUOTAS = {
  est_001: [
    { id: 'c01', mes: 'Marzo',      monto: 85000, fechaVencimiento: '2025-03-10', estado: 'pagado',      comprobanteUrl: null },
    { id: 'c02', mes: 'Abril',      monto: 85000, fechaVencimiento: '2025-04-10', estado: 'pagado',      comprobanteUrl: null },
    { id: 'c03', mes: 'Mayo',       monto: 85000, fechaVencimiento: '2025-05-10', estado: 'en_revision', comprobanteUrl: 'https://example.com/comprobante.pdf' },
    { id: 'c04', mes: 'Junio',      monto: 85000, fechaVencimiento: '2025-06-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c05', mes: 'Julio',      monto: 85000, fechaVencimiento: '2025-07-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c06', mes: 'Agosto',     monto: 85000, fechaVencimiento: '2025-08-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c07', mes: 'Septiembre', monto: 85000, fechaVencimiento: '2025-09-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c08', mes: 'Octubre',    monto: 85000, fechaVencimiento: '2025-10-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c09', mes: 'Noviembre',  monto: 85000, fechaVencimiento: '2025-11-10', estado: 'atrasado',    comprobanteUrl: null },
    { id: 'c10', mes: 'Diciembre',  monto: 85000, fechaVencimiento: '2025-12-10', estado: 'pendiente',   comprobanteUrl: null },
  ],
  est_002: [
    { id: 'c11', mes: 'Marzo',      monto: 72000, fechaVencimiento: '2025-03-10', estado: 'pagado',      comprobanteUrl: null },
    { id: 'c12', mes: 'Abril',      monto: 72000, fechaVencimiento: '2025-04-10', estado: 'atrasado',    comprobanteUrl: null },
    { id: 'c13', mes: 'Mayo',       monto: 72000, fechaVencimiento: '2025-05-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c14', mes: 'Junio',      monto: 72000, fechaVencimiento: '2025-06-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c15', mes: 'Julio',      monto: 72000, fechaVencimiento: '2025-07-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c16', mes: 'Agosto',     monto: 72000, fechaVencimiento: '2025-08-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c17', mes: 'Septiembre', monto: 72000, fechaVencimiento: '2025-09-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c18', mes: 'Octubre',    monto: 72000, fechaVencimiento: '2025-10-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c19', mes: 'Noviembre',  monto: 72000, fechaVencimiento: '2025-11-10', estado: 'pendiente',   comprobanteUrl: null },
    { id: 'c20', mes: 'Diciembre',  monto: 72000, fechaVencimiento: '2025-12-10', estado: 'pendiente',   comprobanteUrl: null },
  ],
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Formatea número como moneda chilena */
const formatCLP = (monto) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monto)

/** Formatea fecha ISO a texto legible */
const formatFecha = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Retorna clases de Tailwind según el estado de la cuota.
 * Los colores están definidos en tailwind.config.js como colores semáforo.
 */
const estadoConfig = {
  pagado: {
    label:      'Pagado',
    dot:        'bg-paid',
    badge:      'bg-paid-bg text-paid border border-paid-border',
    rowAccent:  '',
  },
  en_revision: {
    label:      'En Revisión',
    dot:        'bg-review',
    badge:      'bg-review-bg text-review border border-review-border',
    rowAccent:  '',
  },
  pendiente: {
    label:      'Pendiente',
    dot:        'bg-pending',
    badge:      'bg-pending-bg text-pending border border-pending-border',
    rowAccent:  '',
  },
  atrasado: {
    label:      'Atrasado',
    dot:        'bg-overdue',
    badge:      'bg-overdue-bg text-overdue border border-overdue-border',
    rowAccent:  'border-l-2 border-overdue',
  },
}

// ─── SUBCOMPONENTES ───────────────────────────────────────────────────────────

/** Badge de estado con punto de color */
function EstadoBadge({ estado }) {
  const cfg = estadoConfig[estado] ?? estadoConfig.pendiente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

/** Selector de estudiante cuando el apoderado tiene más de un hijo */
function SelectorEstudiante({ estudiantes, seleccionado, onChange }) {
  if (estudiantes.length === 1) return null
  return (
    <div className="flex gap-2 flex-wrap">
      {estudiantes.map((est) => (
        <button
          key={est.id}
          onClick={() => onChange(est.id)}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${seleccionado === est.id
              ? 'bg-accent text-white shadow-glow-blue'
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

/** Tarjeta de resumen: próxima cuota a vencer */
function TarjetaProximaCuota({ cuotas, estudiante }) {
  const proxima = cuotas.find((c) => c.estado === 'pendiente' || c.estado === 'atrasado')
  if (!proxima) {
    return (
      <div className="bg-surface-700 border border-surface-500 rounded-xl p-6 shadow-card">
        <p className="text-paid font-semibold text-lg">✓ Sin cuotas pendientes</p>
        <p className="text-ink-muted text-sm mt-1">{estudiante.nombre} está al día con todos sus pagos.</p>
      </div>
    )
  }
  const esAtrasada = proxima.estado === 'atrasado'
  return (
    <div className={`
      bg-surface-700 border rounded-xl p-6 shadow-card-lg transition-all
      ${esAtrasada
        ? 'border-overdue-border shadow-glow-red'
        : 'border-pending-border shadow-glow-orange'
      }
    `}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-ink-muted text-xs uppercase tracking-widest mb-1">Próxima cuota</p>
          <h2 className="text-ink-primary text-2xl font-bold">{formatCLP(proxima.monto)}</h2>
        </div>
        <EstadoBadge estado={proxima.estado} />
      </div>

      {/* Detalles */}
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

      {/* Acciones */}
      {/* TODO: onClick de "Pagar Online" → iniciar flujo MercadoPago/Flow */}
      {/* TODO: onClick de "Avisar Transferencia" → abrir <ModalTransferencia /> */}
      <div className="flex gap-3">
        <button className="flex-1 bg-accent hover:bg-accent-hover text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 shadow-glow-blue">
          Pagar Online
        </button>
        <button className="flex-1 bg-surface-600 hover:bg-surface-500 text-ink-primary text-sm font-semibold py-2.5 px-4 rounded-lg border border-surface-400 transition-colors duration-200">
          Avisar Transferencia
        </button>
      </div>
    </div>
  )
}

/** Estadísticas rápidas del año */
function ResumenAnual({ cuotas }) {
  const total     = cuotas.length
  const pagadas   = cuotas.filter((c) => c.estado === 'pagado').length
  const revision  = cuotas.filter((c) => c.estado === 'en_revision').length
  const atrasadas = cuotas.filter((c) => c.estado === 'atrasado').length
  const montoPendiente = cuotas
    .filter((c) => c.estado === 'pendiente' || c.estado === 'atrasado')
    .reduce((acc, c) => acc + c.monto, 0)

  const stats = [
    { label: 'Cuotas pagadas',    value: `${pagadas} / ${total}`,      color: 'text-paid' },
    { label: 'En revisión',       value: revision,                      color: 'text-review' },
    { label: 'Atrasadas',         value: atrasadas,                     color: 'text-overdue' },
    { label: 'Saldo pendiente',   value: formatCLP(montoPendiente),     color: 'text-pending' },
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

/** Fila de la tabla de cuotas */
function FilaCuota({ cuota, onPagar, onAvisarTransferencia }) {
  const cfg = estadoConfig[cuota.estado]
  const acciones = cuota.estado === 'pendiente' || cuota.estado === 'atrasado'

  return (
    <tr className={`border-b border-surface-500 hover:bg-surface-600 transition-colors group ${cfg.rowAccent}`}>
      {/* Mes */}
      <td className="px-4 py-3.5 text-ink-primary text-sm font-medium">{cuota.mes}</td>

      {/* Monto */}
      <td className="px-4 py-3.5 text-ink-secondary text-sm font-mono">{formatCLP(cuota.monto)}</td>

      {/* Vencimiento */}
      <td className="px-4 py-3.5 text-ink-secondary text-sm hidden sm:table-cell">
        {formatFecha(cuota.fechaVencimiento)}
      </td>

      {/* Estado */}
      <td className="px-4 py-3.5">
        <EstadoBadge estado={cuota.estado} />
      </td>

      {/* Acciones */}
      <td className="px-4 py-3.5">
        {acciones ? (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* TODO: onClick → iniciar flujo de pago */}
            <button
              onClick={() => onPagar(cuota)}
              className="text-xs bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded-md font-medium transition-colors"
            >
              Pagar
            </button>
            {/* TODO: onClick → abrir <ModalTransferencia cuota={cuota} /> */}
            <button
              onClick={() => onAvisarTransferencia(cuota)}
              className="text-xs bg-surface-500 hover:bg-surface-400 text-ink-secondary px-3 py-1.5 rounded-md font-medium transition-colors border border-surface-400"
            >
              Transferencia
            </button>
          </div>
        ) : cuota.estado === 'en_revision' ? (
          <span className="text-xs text-ink-muted">Comprobante enviado</span>
        ) : null}
      </td>
    </tr>
  )
}

/** Tabla completa del plan de pagos */
function TablaCuotas({ cuotas, onPagar, onAvisarTransferencia }) {
  return (
    <div className="bg-surface-700 border border-surface-500 rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-500">
        <h3 className="text-ink-primary font-semibold text-base">Plan de pagos anual</h3>
        <p className="text-ink-muted text-xs mt-0.5">Todas las cuotas del año escolar 2025</p>
      </div>

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
              <FilaCuota
                key={c.id}
                cuota={c}
                onPagar={onPagar}
                onAvisarTransferencia={onAvisarTransferencia}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Modal para subir comprobante de transferencia */
function ModalTransferencia({ cuota, onClose }) {
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async () => {
    if (!archivo) return
    setEnviando(true)
    // TODO: Subir archivo a Firebase Storage → /comprobantes/{cuotaId}/{archivo.name}
    // TODO: Actualizar Firestore: Cuotas/{cuotaId} → { estado: 'en_revision', comprobanteUrl: downloadURL }
    console.log('Mock: subiendo comprobante para cuota', cuota.id, archivo.name)
    await new Promise((r) => setTimeout(r, 1200)) // Simula delay
    setEnviando(false)
    onClose()
  }

  return (
    // Overlay
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Panel del modal */}
      <div className="bg-surface-700 border border-surface-400 rounded-2xl shadow-card-lg w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-500">
          <h2 className="text-ink-primary font-semibold text-base">Avisar transferencia</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors text-xl leading-none">×</button>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5 space-y-4">
          {/* Datos de la cuota */}
          <div className="bg-surface-800 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-ink-muted text-xs">Cuota correspondiente</p>
              <p className="text-ink-primary font-semibold">{cuota.mes} 2025</p>
            </div>
            <p className="text-pending font-bold text-lg">{formatCLP(cuota.monto)}</p>
          </div>

          {/* Datos bancarios del colegio */}
          <div className="bg-surface-800 rounded-xl p-4 space-y-1.5">
            <p className="text-ink-muted text-xs uppercase tracking-wider mb-2">Datos para transferencia</p>
            <p className="text-ink-secondary text-sm"><span className="text-ink-muted">Banco:</span> Banco Estado</p>
            <p className="text-ink-secondary text-sm"><span className="text-ink-muted">Cuenta:</span> 123-456-789</p>
            <p className="text-ink-secondary text-sm"><span className="text-ink-muted">RUT:</span> 76.123.456-7</p>
            <p className="text-ink-secondary text-sm"><span className="text-ink-muted">Nombre:</span> Colegio San Mateo</p>
          </div>

          {/* Upload comprobante */}
          <div>
            <label className="block text-ink-secondary text-sm font-medium mb-2">
              Adjuntar comprobante <span className="text-overdue">*</span>
            </label>
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-surface-400 hover:border-accent rounded-xl p-6 cursor-pointer transition-colors">
              <span className="text-2xl mb-2">📄</span>
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
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-surface-500">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-ink-secondary bg-surface-600 hover:bg-surface-500 border border-surface-400 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!archivo || enviando}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {enviando ? 'Enviando...' : 'Enviar comprobante'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Dashboard() {
  const apoderado = MOCK_APODERADO

  // Estado: estudiante seleccionado (por defecto el primero)
  const [estudianteId, setEstudianteId] = useState(apoderado.estudiantes[0].id)

  // Estado: modal de transferencia
  const [modalCuota, setModalCuota] = useState(null) // null | objeto Cuota

  const estudiante = apoderado.estudiantes.find((e) => e.id === estudianteId)
  const cuotas     = MOCK_CUOTAS[estudianteId] ?? []

  // TODO: Reemplazar handlers con lógica real
  const handlePagar              = (cuota) => console.log('Iniciar pago online para cuota:', cuota.id)
  const handleAvisarTransferencia = (cuota) => setModalCuota(cuota)

  return (
    // Fondo base de la app (bg-surface-900 definido en tailwind.config)
    <div className="min-h-screen bg-surface-900 text-ink-primary font-sans">

      {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
      <header className="bg-surface-800 border-b border-surface-500 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold">C</div>
            <span className="text-ink-primary font-semibold text-sm">Portal Escolar</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-ink-primary text-xs font-medium leading-tight">{apoderado.nombre}</p>
              <p className="text-ink-muted text-xs leading-tight">{apoderado.email}</p>
            </div>
            {/* TODO: Botón de logout → Firebase Auth signOut() */}
            <button className="w-8 h-8 rounded-full bg-surface-600 border border-surface-400 text-ink-muted hover:text-ink-primary text-xs transition-colors">
              ↩
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL ──────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">

        {/* Saludo + selector de estudiante */}
        <div className="space-y-3">
          <div>
            <h1 className="text-ink-primary text-xl font-bold">Bienvenido, {apoderado.nombre.split(' ')[0]}</h1>
            <p className="text-ink-muted text-sm mt-0.5">
              Visualizando el estado de pagos de <span className="text-ink-secondary">{estudiante.nombre}</span> · {estudiante.curso}
            </p>
          </div>
          <SelectorEstudiante
            estudiantes={apoderado.estudiantes}
            seleccionado={estudianteId}
            onChange={setEstudianteId}
          />
        </div>

        {/* Fila principal: resumen + tarjeta próxima cuota */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Tarjeta próxima cuota → ocupa 1 columna en desktop */}
          <div className="lg:col-span-1">
            <TarjetaProximaCuota cuota={cuotas} cuotas={cuotas} estudiante={estudiante} />
          </div>
          {/* Resumen anual → ocupa 2 columnas en desktop */}
          <div className="lg:col-span-2">
            <ResumenAnual cuotas={cuotas} />
          </div>
        </div>

        {/* Tabla plan de pagos */}
        <TablaCuotas
          cuotas={cuotas}
          onPagar={handlePagar}
          onAvisarTransferencia={handleAvisarTransferencia}
        />

        {/* Footer */}
        <p className="text-center text-ink-muted text-xs pb-4">
          Portal de Pagos Escolar · Año lectivo 2025
        </p>
      </main>

      {/* ── MODAL DE TRANSFERENCIA ───────────────────────────────────────── */}
      {modalCuota && (
        <ModalTransferencia
          cuota={modalCuota}
          onClose={() => setModalCuota(null)}
        />
      )}
    </div>
  )
}
