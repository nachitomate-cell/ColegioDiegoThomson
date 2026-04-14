'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx — Portal de Pagos Escolar
// Estado: PRODUCCIÓN — conectado a Firebase Auth, Firestore y Storage
//
// Cambios respecto al mock:
//   · PASO 2: useAuth() + useApoderado(uid) reemplazan MOCK_APODERADO
//   · PASO 3: useCuotas(estudianteId) con onSnapshot reemplaza MOCK_CUOTAS
//   · PASO 4: handleSubmit en ModalTransferencia sube a Storage y actualiza Firestore
// ─────────────────────────────────────────────────────────────────────────────

import { useState }      from 'react'
import { signOut }       from 'firebase/auth'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { useRouter }     from 'next/navigation'

// Firebase instances
import { auth, db, storage } from '../firebase/firebaseConfig'

// ── PASO 2: Hooks de autenticación y datos del apoderado ──────────────────────
import { useAuth }       from '../hooks/useAuth'
import { useApoderado }  from '../hooks/useApoderado'

// ── PASO 3: Hook de cuotas en tiempo real ─────────────────────────────────────
import { useCuotas }     from '../hooks/useCuotas'


// ─── HELPERS ─────────────────────────────────────────────────────────────────

const formatCLP = (monto) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0
  }).format(monto)

// Acepta Date de JS (ya convertido desde Firestore Timestamp en el hook)
const formatFecha = (date) => {
  if (!date) return '—'
  return date.toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

const estadoConfig = {
  pagado:      { label: 'Pagado',      dot: 'bg-paid',    badge: 'bg-paid-bg text-paid border border-paid-border',       rowAccent: '' },
  en_revision: { label: 'En Revisión', dot: 'bg-review',  badge: 'bg-review-bg text-review border border-review-border', rowAccent: '' },
  pendiente:   { label: 'Pendiente',   dot: 'bg-pending', badge: 'bg-pending-bg text-pending border border-pending-border', rowAccent: '' },
  atrasado:    { label: 'Atrasado',    dot: 'bg-overdue', badge: 'bg-overdue-bg text-overdue border border-overdue-border', rowAccent: 'border-l-2 border-overdue' },
}


// ─── SUBCOMPONENTES (sin cambios visuales respecto al mock) ───────────────────

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

function TarjetaProximaCuota({ cuotas, estudiante, onPagar, onAvisarTransferencia }) {
  const proxima = cuotas.find((c) => c.estado === 'pendiente' || c.estado === 'atrasado')
  if (!proxima) {
    return (
      <div className="bg-surface-700 border border-surface-500 rounded-xl p-6 shadow-card">
        <p className="text-paid font-semibold text-lg">✓ Sin cuotas pendientes</p>
        <p className="text-ink-muted text-sm mt-1">{estudiante.nombre} está al día.</p>
      </div>
    )
  }
  const esAtrasada = proxima.estado === 'atrasado'
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
          className="flex-1 bg-accent hover:bg-accent-hover text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 shadow-glow-blue"
        >
          Pagar Online
        </button>
        <button
          onClick={() => onAvisarTransferencia(proxima)}
          className="flex-1 bg-surface-600 hover:bg-surface-500 text-ink-primary text-sm font-semibold py-2.5 px-4 rounded-lg border border-surface-400 transition-colors duration-200"
        >
          Avisar Transferencia
        </button>
      </div>
    </div>
  )
}

function ResumenAnual({ cuotas }) {
  const total    = cuotas.length
  const pagadas  = cuotas.filter((c) => c.estado === 'pagado').length
  const revision = cuotas.filter((c) => c.estado === 'en_revision').length
  const atrasadas= cuotas.filter((c) => c.estado === 'atrasado').length
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

function FilaCuota({ cuota, onPagar, onAvisarTransferencia }) {
  const cfg = estadoConfig[cuota.estado] ?? estadoConfig.pendiente
  const accionable = cuota.estado === 'pendiente' || cuota.estado === 'atrasado'
  return (
    <tr className={`border-b border-surface-500 hover:bg-surface-600 transition-colors group ${cfg.rowAccent}`}>
      <td className="px-4 py-3.5 text-ink-primary text-sm font-medium">{cuota.mes} {cuota.anio}</td>
      <td className="px-4 py-3.5 text-ink-secondary text-sm font-mono">{formatCLP(cuota.monto)}</td>
      <td className="px-4 py-3.5 text-ink-secondary text-sm hidden sm:table-cell">
        {formatFecha(cuota.fechaVencimiento)}
      </td>
      <td className="px-4 py-3.5"><EstadoBadge estado={cuota.estado} /></td>
      <td className="px-4 py-3.5">
        {accionable ? (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onPagar(cuota)} className="text-xs bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded-md font-medium transition-colors">
              Pagar
            </button>
            <button onClick={() => onAvisarTransferencia(cuota)} className="text-xs bg-surface-500 hover:bg-surface-400 text-ink-secondary px-3 py-1.5 rounded-md font-medium transition-colors border border-surface-400">
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

function TablaCuotas({ cuotas, loading, error, onPagar, onAvisarTransferencia }) {
  return (
    <div className="bg-surface-700 border border-surface-500 rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-500">
        <h3 className="text-ink-primary font-semibold text-base">Plan de pagos anual</h3>
        <p className="text-ink-muted text-xs mt-0.5">Todas las cuotas del año escolar</p>
      </div>

      {/* ── PASO 3: Estados de carga y error ─────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-ink-muted text-sm">Cargando cuotas...</span>
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
                <FilaCuota key={c.id} cuota={c} onPagar={onPagar} onAvisarTransferencia={onAvisarTransferencia} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 4: ModalTransferencia — Firebase Storage + Firestore update
// ─────────────────────────────────────────────────────────────────────────────

function ModalTransferencia({ cuota, onClose }) {
  const [archivo, setArchivo]           = useState(null)
  const [enviando, setEnviando]         = useState(false)
  const [progreso, setProgreso]         = useState(0)   // 0-100 para la barra de progreso
  const [errorUpload, setErrorUpload]   = useState(null)

  /**
   * PASO 4: handleSubmit completo con Firebase Storage y Firestore
   *
   * Flujo:
   *   1. Validar archivo seleccionado
   *   2. Crear referencia en Storage: /comprobantes/{cuotaId}/{timestamp}_{archivo.name}
   *   3. uploadBytesResumable → permite mostrar barra de progreso
   *   4. getDownloadURL → URL pública del archivo subido
   *   5. updateDoc en Firestore: estado → 'en_revision', comprobante_url, fecha_envio
   *   6. Cerrar modal (el onSnapshot de useCuotas actualizará la UI automáticamente)
   */
  const handleSubmit = async () => {
    if (!archivo) return

    setEnviando(true)
    setProgreso(0)
    setErrorUpload(null)

    try {
      // ── PASO 4.1: Referencia en Storage ─────────────────────────────────────
      // Añadimos timestamp para evitar colisiones si el apoderado sube varios archivos.
      // Ruta: comprobantes/{cuotaId}/1718000000000_comprobante.pdf
      const timestamp = Date.now()
      const storageRef = ref(
        storage,
        `comprobantes/${cuota.id}/${timestamp}_${archivo.name}`
      )

      // ── PASO 4.2: Subida con progreso ────────────────────────────────────────
      // uploadBytesResumable permite escuchar el progreso byte a byte.
      // Alternativa simple sin progreso: uploadBytes(storageRef, archivo)
      await new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, archivo, {
          contentType: archivo.type,
          customMetadata: {
            cuotaId:      cuota.id,
            estudianteId: cuota.estudianteId,
            subidoPor:    auth.currentUser?.uid ?? 'desconocido',
          },
        })

        uploadTask.on(
          'state_changed',
          // Callback de progreso
          (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            setProgreso(pct)
          },
          // Callback de error en la subida
          (err) => {
            console.error('[ModalTransferencia] Error en upload:', err)
            reject(err)
          },
          // Callback de éxito
          () => resolve(uploadTask.snapshot)
        )
      })

      // ── PASO 4.3: Obtener URL de descarga ────────────────────────────────────
      // getDownloadURL requiere la misma referencia usada en la subida.
      const downloadURL = await getDownloadURL(storageRef)

      // ── PASO 4.4: Actualizar documento en Firestore ──────────────────────────
      // updateDoc solo modifica los campos especificados (no sobreescribe el doc).
      // serverTimestamp() guarda la hora del servidor de Firebase (no del cliente).
      const cuotaRef = doc(db, 'Cuotas', cuota.id)
      await updateDoc(cuotaRef, {
        estado:          'en_revision',
        comprobante_url: downloadURL,
        fecha_envio:     serverTimestamp(),
      })

      // ── PASO 4.5: Cerrar modal ───────────────────────────────────────────────
      // El onSnapshot en useCuotas detectará automáticamente el cambio de estado
      // y actualizará la tabla sin necesidad de refrescar la página.
      onClose()

    } catch (err) {
      console.error('[ModalTransferencia] Error general:', err)
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
      onClick={(e) => e.target === e.currentTarget && !enviando && onClose()}
    >
      <div className="bg-surface-700 border border-surface-400 rounded-2xl shadow-card-lg w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-500">
          <h2 className="text-ink-primary font-semibold text-base">Avisar transferencia</h2>
          {!enviando && (
            <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors text-xl leading-none">×</button>
          )}
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5 space-y-4">
          {/* Datos de la cuota */}
          <div className="bg-surface-800 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-ink-muted text-xs">Cuota correspondiente</p>
              <p className="text-ink-primary font-semibold">{cuota.mes} {cuota.anio}</p>
            </div>
            <p className="text-pending font-bold text-lg">{formatCLP(cuota.monto)}</p>
          </div>

          {/* Datos bancarios */}
          <div className="bg-surface-800 rounded-xl p-4 space-y-1.5">
            <p className="text-ink-muted text-xs uppercase tracking-wider mb-2">Datos para transferencia</p>
            {[
              ['Banco',  'Banco Estado'],
              ['Cuenta', '123-456-789'],
              ['RUT',    '76.123.456-7'],
              ['Nombre', 'Colegio San Mateo'],
            ].map(([k, v]) => (
              <p key={k} className="text-ink-secondary text-sm">
                <span className="text-ink-muted">{k}: </span>{v}
              </p>
            ))}
          </div>

          {/* Upload de comprobante */}
          <div>
            <label className="block text-ink-secondary text-sm font-medium mb-2">
              Adjuntar comprobante <span className="text-overdue">*</span>
            </label>
            <label className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors
              ${enviando ? 'border-surface-400 cursor-not-allowed' : 'border-surface-400 hover:border-accent'}
            `}>
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
                disabled={enviando}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f && f.size > 5 * 1024 * 1024) {
                    setErrorUpload('El archivo supera el límite de 5 MB.')
                    return
                  }
                  setArchivo(f ?? null)
                  setErrorUpload(null)
                }}
              />
            </label>
          </div>

          {/* Barra de progreso (visible solo durante la subida) */}
          {enviando && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-ink-muted">
                <span>{progreso < 100 ? 'Subiendo comprobante...' : 'Actualizando estado...'}</span>
                <span>{progreso}%</span>
              </div>
              <div className="w-full bg-surface-500 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-accent h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            </div>
          )}

          {/* Mensaje de error */}
          {errorUpload && (
            <p className="text-overdue text-xs bg-overdue-bg border border-overdue-border rounded-lg px-3 py-2">
              {errorUpload}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-surface-500">
          <button
            onClick={onClose}
            disabled={enviando}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-ink-secondary bg-surface-600 hover:bg-surface-500 border border-surface-400 transition-colors disabled:opacity-40"
          >
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


// ─────────────────────────────────────────────────────────────────────────────
// PANTALLAS DE ESTADO: Loading global y error de auth
// ─────────────────────────────────────────────────────────────────────────────

function PantallaLoading({ mensaje = 'Cargando...' }) {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-ink-muted text-sm">{mensaje}</p>
      </div>
    </div>
  )
}

function PantallaError({ mensaje }) {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center">
      <div className="bg-surface-700 border border-overdue-border rounded-xl p-8 max-w-sm text-center">
        <p className="text-overdue text-lg font-semibold mb-2">Error</p>
        <p className="text-ink-muted text-sm">{mensaje}</p>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()

  // ── PASO 2: Autenticación ───────────────────────────────────────────────────
  const { user, loading: authLoading } = useAuth()

  // ── PASO 2: Datos del apoderado (solo cuando hay user) ─────────────────────
  const { apoderado, loading: apoderadoLoading, error: apoderadoError } = useApoderado(user?.uid)

  // Estado local: estudiante actualmente seleccionado
  const [estudianteId, setEstudianteId] = useState(null)

  // Inicializar estudianteId al primer estudiante cuando se carguen los datos
  // (se ejecuta cuando apoderado cambia de null → objeto)
  const estudianteIdResuelto = estudianteId ?? apoderado?.estudiantes?.[0]?.id ?? null

  // ── PASO 3: Cuotas en tiempo real del estudiante seleccionado ──────────────
  const { cuotas, loading: cuotasLoading, error: cuotasError } = useCuotas(estudianteIdResuelto)

  // Estado: modal de transferencia
  const [modalCuota, setModalCuota] = useState(null)

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handlePagar = (cuota) => {
    // TODO PASO 5: Iniciar flujo MercadoPago/Flow
    // Ejemplo: router.push(`/pago/${cuota.id}`)
    console.log('Iniciar pago online para cuota:', cuota.id)
  }

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/login')
  }

  // ── Renderizado condicional ─────────────────────────────────────────────────

  // 1. Firebase Auth todavía resolviendo estado inicial
  if (authLoading) return <PantallaLoading mensaje="Verificando sesión..." />

  // 2. No autenticado → redirigir (en producción usar middleware de Next.js)
  if (!user) {
    router.push('/login')
    return <PantallaLoading mensaje="Redirigiendo..." />
  }

  // 3. Cargando datos del apoderado
  if (apoderadoLoading) return <PantallaLoading mensaje="Cargando tu perfil..." />

  // 4. Error al cargar apoderado
  if (apoderadoError) return <PantallaError mensaje={apoderadoError.message} />

  // 5. No se encontró el apoderado en Firestore (uid sin documento)
  if (!apoderado) return <PantallaError mensaje="No se encontró tu perfil de apoderado. Contacta al colegio." />

  const estudiante = apoderado.estudiantes.find((e) => e.id === estudianteIdResuelto)

  return (
    <div className="min-h-screen bg-surface-900 text-ink-primary font-sans">

      {/* ── TOPBAR ────────────────────────────────────────────────────────── */}
      <header className="bg-surface-800 border-b border-surface-500 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold">C</div>
            <span className="text-ink-primary font-semibold text-sm">Portal Escolar</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              {/* Datos reales del apoderado desde Firestore */}
              <p className="text-ink-primary text-xs font-medium leading-tight">{apoderado.nombre}</p>
              <p className="text-ink-muted text-xs leading-tight">{apoderado.email}</p>
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

      {/* ── CONTENIDO PRINCIPAL ──────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">

        {/* Saludo + selector */}
        <div className="space-y-3">
          <div>
            <h1 className="text-ink-primary text-xl font-bold">
              Bienvenido, {apoderado.nombre.split(' ')[0]}
            </h1>
            {estudiante && (
              <p className="text-ink-muted text-sm mt-0.5">
                Visualizando el estado de pagos de{' '}
                <span className="text-ink-secondary">{estudiante.nombre}</span> · {estudiante.curso}
              </p>
            )}
          </div>
          {/* Selector solo visible si hay más de un hijo */}
          <SelectorEstudiante
            estudiantes={apoderado.estudiantes}
            seleccionado={estudianteIdResuelto}
            onChange={(id) => setEstudianteId(id)}
          />
        </div>

        {/* Grid: tarjeta próxima cuota + estadísticas anuales */}
        {!cuotasLoading && !cuotasError && estudiante && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1">
              <TarjetaProximaCuota
                cuotas={cuotas}
                estudiante={estudiante}
                onPagar={handlePagar}
                onAvisarTransferencia={(cuota) => setModalCuota(cuota)}
              />
            </div>
            <div className="lg:col-span-2">
              <ResumenAnual cuotas={cuotas} />
            </div>
          </div>
        )}

        {/* Tabla plan de pagos — PASO 3: recibe loading y error de useCuotas */}
        <TablaCuotas
          cuotas={cuotas}
          loading={cuotasLoading}
          error={cuotasError}
          onPagar={handlePagar}
          onAvisarTransferencia={(cuota) => setModalCuota(cuota)}
        />

        <p className="text-center text-ink-muted text-xs pb-4">
          Portal de Pagos Escolar · Año lectivo 2025
        </p>
      </main>

      {/* ── MODAL DE TRANSFERENCIA — PASO 4: con Firebase Storage ────────── */}
      {modalCuota && (
        <ModalTransferencia
          cuota={modalCuota}
          onClose={() => setModalCuota(null)}
        />
      )}
    </div>
  )
}
