// ─────────────────────────────────────────────────────────────────────────────
// lib/exportarExcel.js
// Exporta un array de datos (cuotas, apoderados, etc.) a un archivo .xlsx
// que se descarga automáticamente en el navegador.
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx'

const formatCLP = (monto) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(monto)

const formatFecha = (date) => {
  if (!date) return '—'
  return date.toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const estadoLabel = {
  pendiente:   'Pendiente',
  atrasado:    'Atrasado',
  en_revision: 'En revisión',
  pagado:      'Pagado',
}

/**
 * Exporta cuotas a Excel
 * @param {Array} cuotas - Array de cuota objects
 * @param {Object} estudiantesMap - { estudianteId → nombre }
 * @param {string} nombreArchivo - Nombre del archivo sin extensión
 */
export function exportarCuotasExcel(cuotas, estudiantesMap, nombreArchivo = 'Cuotas_CDT') {
  const filas = cuotas.map((c) => ({
    'Mes':                c.mes,
    'Año':                c.anio,
    'Estudiante':         estudiantesMap[c.estudianteId] ?? c.estudianteId,
    'Monto':              c.monto,
    'Monto (formato)':    formatCLP(c.monto),
    'Estado':             estadoLabel[c.estado] ?? c.estado,
    'Fecha Vencimiento':  formatFecha(c.fechaVencimiento),
    'Fecha Pago':         formatFecha(c.fechaPago),
    'ID Cuota':           c.id,
  }))

  const ws = XLSX.utils.json_to_sheet(filas)

  // Ajustar ancho de columnas
  ws['!cols'] = [
    { wch: 12 }, // Mes
    { wch: 6 },  // Año
    { wch: 25 }, // Estudiante
    { wch: 10 }, // Monto
    { wch: 14 }, // Monto formato
    { wch: 14 }, // Estado
    { wch: 16 }, // F. Vencimiento
    { wch: 16 }, // F. Pago
    { wch: 24 }, // ID
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cuotas')

  // Agregar hoja de resumen
  const resumenData = [
    { 'Concepto': 'Total cuotas', 'Valor': cuotas.length },
    { 'Concepto': 'Pagadas', 'Valor': cuotas.filter(c => c.estado === 'pagado').length },
    { 'Concepto': 'Pendientes', 'Valor': cuotas.filter(c => c.estado === 'pendiente').length },
    { 'Concepto': 'Atrasadas', 'Valor': cuotas.filter(c => c.estado === 'atrasado').length },
    { 'Concepto': 'En revisión', 'Valor': cuotas.filter(c => c.estado === 'en_revision').length },
    { 'Concepto': '', 'Valor': '' },
    { 'Concepto': 'Monto total esperado', 'Valor': formatCLP(cuotas.reduce((a, c) => a + c.monto, 0)) },
    { 'Concepto': 'Monto cobrado', 'Valor': formatCLP(cuotas.filter(c => c.estado === 'pagado').reduce((a, c) => a + c.monto, 0)) },
    { 'Concepto': 'Monto pendiente', 'Valor': formatCLP(cuotas.filter(c => c.estado !== 'pagado').reduce((a, c) => a + c.monto, 0)) },
    { 'Concepto': '', 'Valor': '' },
    { 'Concepto': 'Fecha de generación', 'Valor': new Date().toLocaleDateString('es-CL') + ' ' + new Date().toLocaleTimeString('es-CL') },
    { 'Concepto': 'Generado por', 'Valor': 'Portal Escolar — Colegio Diego Thomson' },
  ]
  const wsResumen = XLSX.utils.json_to_sheet(resumenData)
  wsResumen['!cols'] = [{ wch: 22 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  XLSX.writeFile(wb, `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/**
 * Exporta lista de apoderados a Excel
 * @param {Array} apoderados
 * @param {Object} estudiantesMap
 */
export function exportarApoderadosExcel(apoderados, estudiantesMap) {
  const filas = apoderados.map((a) => ({
    'Nombre':       a.nombre ?? '—',
    'RUT':          a.rut ?? '—',
    'Email':        a.email ?? '—',
    'Teléfono':     a.telefono ?? '—',
    'Estudiantes':  (a.estudiantes_ids ?? []).map(id => estudiantesMap[id] ?? id).join(', '),
    'Fecha Registro': a.created_at ? formatFecha(a.created_at.toDate()) : '—',
  }))

  const ws = XLSX.utils.json_to_sheet(filas)
  ws['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 25 }, { wch: 14 }, { wch: 30 }, { wch: 16 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Apoderados')
  XLSX.writeFile(wb, `Apoderados_CDT_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
