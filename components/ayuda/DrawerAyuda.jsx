'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, Search, ChevronDown, ChevronRight,
  CreditCard, Users, Settings, AlertCircle, Mail, ShieldCheck,
  Info, AlertTriangle, HelpCircle, MessageSquare,
} from 'lucide-react'
import { CATEGORIAS_AYUDA } from '../../lib/ayuda/contenido'

// ─── Normalización (misma lógica que lib/utils.js) ────────────────────────────
function normalizar(texto) {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// ─── Mapa de íconos Lucide disponibles en las categorías ─────────────────────
const ICONOS_MAPA = {
  CreditCard,
  Users,
  Settings,
  AlertCircle,
  Mail,
  ShieldCheck,
}

// ─── Motor de búsqueda con score ─────────────────────────────────────────────
function buscarSecciones(query) {
  const q = normalizar(query)
  if (!q) return []

  const resultados = []

  for (const cat of CATEGORIAS_AYUDA) {
    for (const sec of cat.secciones) {
      let score = 0

      const titulo   = normalizar(sec.titulo)
      const resumen  = normalizar(sec.contenido?.resumen ?? '')
      const keywords = (sec.keywords ?? []).map(normalizar)

      // Coincidencia en título
      if (titulo.includes(q)) {
        score += 10
        // Bonus si es palabra completa
        if (titulo.split(/\s+/).some((w) => w === q)) score += 3
      }

      // Coincidencia en keywords
      for (const kw of keywords) {
        if (kw.includes(q)) {
          score += 5
          if (kw === q) score += 3
        }
      }

      // Coincidencia en resumen
      if (resumen.includes(q)) score += 2

      if (score > 0) {
        resultados.push({
          ...sec,
          _catTitulo: cat.titulo,
          _catId:     cat.id,
          _score:     score,
        })
      }
    }
  }

  return resultados.sort((a, b) => b._score - a._score)
}

// ─── Alerta de contenido ──────────────────────────────────────────────────────
function AlertaContenido({ alerta }) {
  const variantes = {
    info: {
      wrapper: 'bg-blue-50 border-blue-200',
      texto:   'text-blue-800',
      icono:   <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />,
    },
    warning: {
      wrapper: 'bg-amber-50 border-amber-200',
      texto:   'text-amber-900',
      icono:   <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />,
    },
    danger: {
      wrapper: 'bg-red-50 border-red-200',
      texto:   'text-red-800',
      icono:   <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />,
    },
  }

  const v = variantes[alerta.tipo] ?? variantes.info

  return (
    <div className={`flex gap-2.5 p-3 rounded-lg border mt-3 ${v.wrapper}`}>
      {v.icono}
      <p className={`text-xs leading-relaxed ${v.texto}`}>{alerta.mensaje}</p>
    </div>
  )
}

// ─── Contenido de una sección expandida ──────────────────────────────────────
function ContenidoSeccion({ seccion, onVerTambien }) {
  const { contenido } = seccion
  if (!contenido) return null

  return (
    <div className="pt-2 pb-4 space-y-3">
      {/* Resumen */}
      {contenido.resumen && (
        <p className="text-sm text-gray-700 leading-relaxed">{contenido.resumen}</p>
      )}

      {/* Pasos numerados */}
      {contenido.pasos?.length > 0 && (
        <ol className="space-y-2.5">
          {contenido.pasos.map((paso, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700">
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold
                           flex items-center justify-center mt-0.5"
                style={{ background: '#C9A227', color: '#fff' }}
              >
                {i + 1}
              </span>
              <span className="leading-relaxed">{paso}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Tabla */}
      {contenido.tabla?.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
          <table className="w-full">
            <tbody>
              {contenido.tabla.map((fila, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-2 font-semibold text-[#0D2C54] w-1/3 align-top border-r border-gray-200">
                    {fila.label}
                  </td>
                  <td className="px-3 py-2 text-gray-600 leading-relaxed">
                    {fila.descripcion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Alerta */}
      {contenido.alerta && <AlertaContenido alerta={contenido.alerta} />}

      {/* Ver también */}
      {contenido.verTambien?.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Ver también:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {contenido.verTambien.map((id) => {
              let titulo = id
              for (const cat of CATEGORIAS_AYUDA) {
                const found = cat.secciones.find((s) => s.id === id)
                if (found) { titulo = found.titulo; break }
              }
              return (
                <button
                  key={id}
                  onClick={() => onVerTambien(id)}
                  className="text-xs px-2.5 py-1 rounded-md bg-[#0D2C54]/10 text-[#0D2C54]
                             hover:bg-[#0D2C54]/20 transition-colors text-left leading-snug"
                >
                  {titulo}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DrawerAyuda ─────────────────────────────────────────────────────────────
export function DrawerAyuda({ abierto, onCerrar }) {
  const [query,          setQuery]          = useState('')
  const [queryDebounced, setQueryDebounced] = useState('')
  const [catAbiertas,    setCatAbiertas]    = useState({})
  const [secAbiertas,    setSecAbiertas]    = useState({})

  const inputRef   = useRef(null)
  const drawerRef  = useRef(null)
  const debounceRef = useRef(null)
  const scrollRef  = useRef(null)

  // ── Debounce de búsqueda ────────────────────────────────────────────────
  const handleQuery = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setQueryDebounced(val), 200)
  }

  // ── ESC cierra ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!abierto) return
    const onKey = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto, onCerrar])

  // ── Focus al input cuando abre / limpia al cerrar ──────────────────────
  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 310)
    } else {
      setQuery('')
      setQueryDebounced('')
    }
  }, [abierto])

  // ── Focus trap dentro del drawer ───────────────────────────────────────
  useEffect(() => {
    if (!abierto || !drawerRef.current) return
    const getFocusables = () =>
      Array.from(
        drawerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])'
        )
      )
    const trap = (e) => {
      if (e.key !== 'Tab') return
      const focusables = getFocusables()
      if (focusables.length === 0) return
      const first = focusables[0]
      const last  = focusables[focusables.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', trap)
    return () => window.removeEventListener('keydown', trap)
  }, [abierto])

  // ── Acciones de acordeón ────────────────────────────────────────────────
  const toggleCat = (catId) =>
    setCatAbiertas((p) => ({ ...p, [catId]: !p[catId] }))

  const toggleSec = (secId) =>
    setSecAbiertas((p) => ({ ...p, [secId]: !p[secId] }))

  // ── Ver también: abre categoría + sección y scrollea ───────────────────
  const handleVerTambien = (secId) => {
    for (const cat of CATEGORIAS_AYUDA) {
      if (cat.secciones.some((s) => s.id === secId)) {
        setCatAbiertas((p) => ({ ...p, [cat.id]: true }))
        setSecAbiertas((p) => ({ ...p, [secId]: true }))
        setQuery('')
        setQueryDebounced('')
        setTimeout(() => {
          const el = document.getElementById(`ayuda-sec-${secId}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
        break
      }
    }
  }

  const resultados = buscarSecciones(queryDebounced)
  const buscando   = queryDebounced.trim().length > 0

  if (!abierto) return null

  return (
    <>
      {/* Keyframes para el slide-in */}
      <style>{`
        @keyframes ayuda-slide-in {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .ayuda-drawer-enter {
          animation: ayuda-slide-in 300ms cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
        onClick={onCerrar}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ayuda-drawer-titulo"
        className="ayuda-drawer-enter fixed top-0 right-0 h-full w-full sm:w-[420px]
                   bg-white z-50 flex flex-col shadow-2xl"
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-[#0D2C54] px-5 pt-5 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2
                id="ayuda-drawer-titulo"
                className="text-base font-bold text-white leading-tight"
              >
                Centro de ayuda
              </h2>
              <p className="text-xs text-white/65 mt-0.5">
                Encuentra respuestas a dudas frecuentes
              </p>
            </div>
            <button
              onClick={onCerrar}
              aria-label="Cerrar centro de ayuda"
              className="flex-shrink-0 p-1.5 rounded-lg text-white/60
                         hover:text-white hover:bg-white/10 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQuery}
              placeholder="Buscar… (ej. 'confirmar pago')"
              aria-label="Buscar en el centro de ayuda"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white
                         placeholder-gray-400 text-gray-800
                         focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
            />
          </div>
        </div>

        {/* ── Contenido scrolleable ────────────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 space-y-2">

            {/* ── MODO BÚSQUEDA ── */}
            {buscando ? (
              resultados.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-500">
                    No encontramos resultados.
                  </p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    ¿Puedes reformular la pregunta<br />
                    o revisar "Contactar soporte" al final?
                  </p>
                </div>
              ) : (
                resultados.map((sec) => (
                  <div
                    key={sec.id}
                    id={`ayuda-sec-${sec.id}`}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleSec(sec.id)}
                      aria-expanded={!!secAbiertas[sec.id]}
                      className="w-full flex items-center justify-between gap-2
                                 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0D2C54] leading-snug">
                          {sec.titulo}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{sec._catTitulo}</p>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform
                          ${secAbiertas[sec.id] ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {secAbiertas[sec.id] && (
                      <div className="px-4 border-t border-gray-100 bg-gray-50/40">
                        <ContenidoSeccion seccion={sec} onVerTambien={handleVerTambien} />
                      </div>
                    )}
                  </div>
                ))
              )
            ) : (
              /* ── MODO DEFAULT: categorías acordeón ── */
              CATEGORIAS_AYUDA.map((cat) => {
                const Icono     = ICONOS_MAPA[cat.icono] ?? HelpCircle
                const catAbierta = !!catAbiertas[cat.id]

                return (
                  <div key={cat.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Header de categoría */}
                    <button
                      onClick={() => toggleCat(cat.id)}
                      aria-expanded={catAbierta}
                      className="w-full flex items-center justify-between gap-3
                                 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(13,44,84,0.10)' }}
                        >
                          <Icono className="w-4 h-4 text-[#0D2C54]" />
                        </span>
                        <span className="text-sm font-semibold text-gray-800 truncate">
                          {cat.titulo}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          ({cat.secciones.length})
                        </span>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform
                          ${catAbierta ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {/* Secciones de la categoría */}
                    {catAbierta && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        {cat.secciones.map((sec) => (
                          <div key={sec.id} id={`ayuda-sec-${sec.id}`}>
                            <button
                              onClick={() => toggleSec(sec.id)}
                              aria-expanded={!!secAbiertas[sec.id]}
                              className="w-full flex items-center justify-between gap-2
                                         px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                            >
                              <span className="text-sm text-gray-700 leading-snug">
                                {sec.titulo}
                              </span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform
                                  ${secAbiertas[sec.id] ? 'rotate-180' : ''}`}
                              />
                            </button>
                            {secAbiertas[sec.id] && (
                              <div className="px-4 bg-gray-50/50 border-t border-gray-100">
                                <ContenidoSeccion
                                  seccion={sec}
                                  onVerTambien={handleVerTambien}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Sección de contacto — siempre visible al final ───────────────── */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(201,162,39,0.15)' }}
            >
              <MessageSquare className="w-4 h-4" style={{ color: '#C9A227' }} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800">
                ¿No encontraste lo que buscabas?
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Contacta directamente según el tipo de problema:
              </p>
              <ul className="mt-2 space-y-1.5">
                <li className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-medium text-gray-700">
                    Problemas técnicos del portal →
                  </span>{' '}
                  <span className="select-all text-[#0D2C54] font-medium">
                    ignaciiio.mate@gmail.com
                  </span>
                </li>
                <li className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-medium text-gray-700">
                    Problemas con Transbank →
                  </span>{' '}
                  <span className="select-all text-[#0D2C54] font-medium">
                    [completar: contacto Transbank del colegio]
                  </span>
                </li>
                <li className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-medium text-gray-700">
                    Dudas administrativas →
                  </span>{' '}
                  <span className="select-all text-[#0D2C54] font-medium">
                    [completar: email de dirección del colegio]
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
