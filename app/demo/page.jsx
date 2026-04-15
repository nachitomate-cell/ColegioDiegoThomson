'use client'

import { useState } from 'react'
import { LOGO_SRC } from '../lib/logo'
import { useRouter } from 'next/navigation'

const STEPS = [
  {
    id: 'intro',
    emoji: '🏫',
    title: 'Portal de Pagos Escolar',
    subtitle: 'Colegio Diego Thomson · Demo para Dirección',
    content: 'Sistema digital completo de gestión de pagos escolares. Elimina el papeleo, automatiza el cobro y da visibilidad total a la dirección en tiempo real.',
    bullets: [
      '✅ Pago online con tarjeta (Webpay Plus)',
      '✅ Pago por transferencia con comprobante',
      '✅ Panel de administración en tiempo real',
      '✅ Reportes exportables a Excel y PDF',
    ],
    cta: 'Comenzar Demo →',
    ctaNext: 'admin',
    bg: 'from-slate-900 to-slate-800',
    accent: 'text-blue-400',
  },
  {
    id: 'admin',
    emoji: '📊',
    title: 'Panel de Administración',
    subtitle: 'Visión completa del estado financiero',
    content: 'La dirección puede ver en tiempo real cuánto se ha recaudado, qué apoderados están atrasados, y aprobar comprobantes de transferencia con un clic.',
    bullets: [
      '📈 Dashboard con % de recaudación mensual',
      '📋 Lista de comprobantes por verificar',
      '👥 Gestión completa de apoderados',
      '📊 Resumen financiero desglosado por mes',
    ],
    cta: 'Ver Panel Admin →',
    ctaLink: '/admin',
    ctaNext: 'apoderado',
    bg: 'from-blue-950 to-slate-900',
    accent: 'text-blue-400',
    credencialAdmin: { rut: '98.765.432-5', pass: 'Admin2025!' },
  },
  {
    id: 'apoderado',
    emoji: '👨‍👩‍👧',
    title: 'Vista del Apoderado',
    subtitle: 'Experiencia simple y autogestión total',
    content: 'El apoderado ingresa con su RUT y contraseña, ve todas sus cuotas, paga online con su tarjeta, o sube un comprobante de transferencia.',
    bullets: [
      '💳 Pago online instantáneo con Webpay',
      '📸 Subir comprobante de transferencia',
      '📄 Descargar recibo PDF de cada pago',
      '📱 Funciona desde el celular',
    ],
    cta: 'Ver Dashboard Apoderado →',
    ctaLink: '/dashboard',
    ctaNext: 'excel',
    bg: 'from-emerald-950 to-slate-900',
    accent: 'text-emerald-400',
    cuentas: [
      { label: 'Carlos Muñoz — Buen pagador (8 pagadas)', rut: '15.678.901-1', pass: 'Demo2025!', tag: '✅ Al día' },
      { label: 'María González — Comprobante pendiente', rut: '12.345.678-5', pass: 'Demo2025!', tag: '🟡 En revisión' },
      { label: 'Ana Herrera — Apoderada morosa', rut: '9.876.543-3', pass: 'Demo2025!', tag: '🔴 6 cuotas atrasadas' },
    ],
  },
  {
    id: 'excel',
    emoji: '📥',
    title: 'Reportes y Exportaciones',
    subtitle: 'Sin necesidad de Excel manual',
    content: 'El administrador puede exportar cualquier vista a Excel con un clic: listado de cuotas filtrado, nómina de apoderados, o reporte financiero completo del año.',
    bullets: [
      '📊 Exportar cuotas filtradas a Excel (.xlsx)',
      '👥 Exportar nómina de apoderados con contactos',
      '📄 Generar recibo PDF oficial por cada pago',
      '🔍 Auditoría: registro de quién aprobó cada pago',
    ],
    cta: 'Ver Exportaciones en Admin →',
    ctaLink: '/admin',
    ctaNext: 'whatsapp',
    bg: 'from-violet-950 to-slate-900',
    accent: 'text-violet-400',
  },
  {
    id: 'whatsapp',
    emoji: '💬',
    title: 'Recordatorios por WhatsApp',
    subtitle: 'Cobro automatizado sin llamadas',
    content: 'El sistema identifica automáticamente a los apoderados con cuotas atrasadas y permite enviarles un recordatorio personalizado por WhatsApp con un clic.',
    bullets: [
      '🤖 Detecta apoderados morosos automáticamente',
      '💬 Mensaje prellenado con cuotas pendientes',
      '🔗 Link directo al portal de pago',
      '📲 Se abre WhatsApp en el celular del admin',
    ],
    cta: 'Ver en Panel Admin →',
    ctaLink: '/admin',
    ctaNext: 'seguridad',
    bg: 'from-green-950 to-slate-900',
    accent: 'text-green-400',
  },
  {
    id: 'seguridad',
    emoji: '🔒',
    title: 'Seguridad y Confiabilidad',
    subtitle: 'Infraestructura de nivel bancario',
    content: 'El sistema usa Firebase de Google (el mismo que usa Spotify, Duolingo y Twitter) para el almacenamiento. Los pagos online son procesados por Transbank con certificación PCI-DSS.',
    bullets: [
      '🏦 Pagos procesados por Transbank (certificado por bancos chilenos)',
      '🔐 Contraseñas nunca almacenadas en texto plano',
      '☁️ Base de datos en servidores de Google con respaldo automático',
      '📜 Cada acción del admin queda registrada con fecha y usuario',
    ],
    cta: 'Ver Panel Admin →',
    ctaLink: '/admin',
    ctaNext: 'cierre',
    bg: 'from-slate-900 to-gray-900',
    accent: 'text-yellow-400',
  },
  {
    id: 'cierre',
    emoji: '🚀',
    title: '¿Listos para implementar?',
    subtitle: 'El sistema está operativo hoy',
    content: 'El panel, la base de datos y la integración con Webpay están completamente listos. Solo se requiere activar el contrato de producción con Transbank y registrar los datos del colegio.',
    bullets: [
      '📋 Registrar apoderados en el sistema (import masivo disponible)',
      '🏦 Certificación de producción con Transbank (trámite estándar)',
      '📧 Configurar correo oficial para notificaciones automáticas',
      '🎯 Capacitación para personal administrativo (1 hora)',
    ],
    cta: 'Ir al Panel Admin →',
    ctaLink: '/admin',
    ctaNext: null,
    bg: 'from-indigo-950 to-slate-900',
    accent: 'text-indigo-400',
  },
]

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className={`text-xs px-2 py-1 rounded font-mono transition-all ${
        copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
      }`}
    >
      {copied ? '✓' : 'copiar'}
    </button>
  )
}

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const router = useRouter()
  const step = STEPS[currentStep]

  const goNext = () => {
    if (step.ctaLink) window.open(step.ctaLink, '_blank')
    if (step.ctaNext) {
      const nextIndex = STEPS.findIndex(s => s.id === step.ctaNext)
      if (nextIndex !== -1) setCurrentStep(nextIndex)
    }
  }

  const progress = ((currentStep) / (STEPS.length - 1)) * 100

  return (
    <div className={`min-h-screen bg-gradient-to-br ${step.bg} text-white transition-all duration-700`}>
      {/* Barra de progreso */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/10 z-50">
        <div
          className="h-full bg-white/50 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <header className="fixed top-1 left-0 right-0 z-40 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={LOGO_SRC} alt="CDT" className="w-7 h-7 rounded-md object-cover ring-1 ring-white/20" />
          <span className="text-white/60 text-xs font-medium">Demo · Colegio Diego Thomson</span>
        </div>
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentStep ? 'bg-white w-6' : i < currentStep ? 'bg-white/40' : 'bg-white/15'
              }`}
            />
          ))}
        </div>
        <a href="/admin" target="_blank" className="text-xs text-white/50 hover:text-white/80 transition-colors">
          Ir al sistema →
        </a>
      </header>

      {/* Contenido principal */}
      <main className="min-h-screen flex flex-col items-center justify-center px-6 pt-16 pb-10">
        <div className="max-w-2xl w-full mx-auto space-y-8 animate-fade-in" key={step.id}>

          {/* Emoji + Título */}
          <div className="text-center space-y-3">
            <div className="text-7xl mb-4">{step.emoji}</div>
            <h1 className="text-4xl font-bold text-white leading-tight">{step.title}</h1>
            <p className={`text-lg font-medium ${step.accent}`}>{step.subtitle}</p>
          </div>

          {/* Descripción */}
          <p className="text-white/70 text-lg text-center leading-relaxed">
            {step.content}
          </p>

          {/* Bullets */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            {step.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-base leading-relaxed text-white/90">{b}</span>
              </div>
            ))}
          </div>

          {/* Credencial admin (solo en el paso de admin) */}
          {step.credencialAdmin && (
            <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
                🔑 Credencial de acceso al panel admin
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-xs">RUT:</span>
                  <span className="font-mono text-sm text-white/90 font-semibold">{step.credencialAdmin.rut}</span>
                  <CopyButton text={step.credencialAdmin.rut} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-xs">Clave:</span>
                  <span className="font-mono text-sm text-white/90">{step.credencialAdmin.pass}</span>
                  <CopyButton text={step.credencialAdmin.pass} />
                </div>
                <a href="/login" target="_blank" className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-all">
                  Abrir login →
                </a>
              </div>
            </div>
          )}

          {/* Cuentas de demo (solo en el paso de apoderado) */}
          {step.cuentas && (
            <div className="space-y-3">
              <p className="text-white/50 text-sm text-center uppercase tracking-wider">
                Cuentas de prueba disponibles
              </p>
              {step.cuentas.map((cuenta, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-semibold">{cuenta.label}</span>
                      <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/60">{cuenta.tag}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white/40 text-xs">RUT:</span>
                      <span className="font-mono text-xs text-white/80 font-semibold">{cuenta.rut}</span>
                      <CopyButton text={cuenta.rut} />
                      <span className="font-mono text-xs text-white/40">|</span>
                      <span className="text-white/40 text-xs">Clave:</span>
                      <span className="font-mono text-xs text-white/60">{cuenta.pass}</span>
                      <CopyButton text={cuenta.pass} />
                    </div>
                  </div>
                  <a
                    href="/login"
                    target="_blank"
                    className="flex-shrink-0 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-all whitespace-nowrap"
                  >
                    Abrir login →
                  </a>
                </div>
              ))}
              {/* Tarjeta de pago Transbank */}
              <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4">
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  💳 Tarjeta de prueba para pago online (Webpay Sandbox)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Número (Visa)', value: '4051 8856 0044 6623' },
                    { label: 'Vencimiento', value: '12/30' },
                    { label: 'CVV', value: '123' },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-white/40 text-xs">{f.label}</p>
                        <p className="text-white font-mono text-sm">{f.value}</p>
                      </div>
                      <CopyButton text={f.value} />
                    </div>
                  ))}
                </div>
                <p className="text-white/30 text-xs mt-2">RUT en banco simulado: 11.111.111-1 · Clave de banco: cualquiera · Seleccionar "Aprobar"</p>
              </div>
            </div>
          )}

          {/* Botones de navegación */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="text-sm text-white/40 hover:text-white/70 disabled:opacity-0 transition-all"
            >
              ← Anterior
            </button>

            {step.ctaNext === null ? (
              <a
                href="/admin"
                target="_blank"
                className="bg-white text-gray-900 font-bold text-base px-8 py-3.5 rounded-xl hover:bg-white/90 transition-all shadow-lg active:scale-[0.98]"
              >
                {step.cta}
              </a>
            ) : (
              <button
                onClick={goNext}
                className="bg-white text-gray-900 font-bold text-base px-8 py-3.5 rounded-xl hover:bg-white/90 transition-all shadow-lg active:scale-[0.98]"
              >
                {step.cta}
              </button>
            )}

            <button
              onClick={() => setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1))}
              disabled={currentStep === STEPS.length - 1}
              className="text-sm text-white/40 hover:text-white/70 disabled:opacity-0 transition-all"
            >
              Siguiente →
            </button>
          </div>

          {/* Contador de paso */}
          <p className="text-center text-white/25 text-xs">
            {currentStep + 1} / {STEPS.length}
          </p>
        </div>
      </main>
    </div>
  )
}
