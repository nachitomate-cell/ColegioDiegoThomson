// ─────────────────────────────────────────────────────────────────────────────
// lib/generarReciboPDF.js
// Genera un recibo de pago en PDF con logo del colegio, datos del estudiante,
// monto, mes y código de autorización. Se descarga al navegador del apoderado.
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'

const formatCLP = (monto) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(monto)

const formatFecha = (date) => {
  if (!date) return '—'
  return date.toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/**
 * @param {Object} params
 * @param {string} params.nombreEstudiante
 * @param {string} params.curso
 * @param {string} params.nombreApoderado
 * @param {string} params.rutApoderado
 * @param {string} params.mes
 * @param {number} params.anio
 * @param {number} params.monto
 * @param {Date|null} params.fechaPago
 * @param {string|null} params.codigoAutorizacion
 * @param {string} params.cuotaId
 */
export function generarReciboPDF({
  nombreEstudiante, curso, nombreApoderado, rutApoderado,
  mes, anio, monto, fechaPago, codigoAutorizacion, cuotaId,
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const marginL = 20
  const marginR = 20
  let y = 20

  // ── Header verde ────────────────────────────────────────────
  doc.setFillColor(140, 198, 63) // #8CC63F
  doc.rect(0, 0, pageW, 40, 'F')

  doc.setTextColor(26, 46, 0)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Colegio Diego Thomson', pageW / 2, 18, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Portal de Pagos Escolares', pageW / 2, 26, { align: 'center' })

  doc.setFontSize(8)
  doc.text('Documento no fiscal — Comprobante interno', pageW / 2, 33, { align: 'center' })

  y = 52

  // ── Título ────────────────────────────────────────────────────
  doc.setTextColor(17, 24, 39)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('RECIBO DE PAGO', pageW / 2, y, { align: 'center' })
  y += 12

  // ── Línea decorativa ──────────────────────────────────────────
  doc.setDrawColor(140, 198, 63)
  doc.setLineWidth(0.8)
  doc.line(marginL, y, pageW - marginR, y)
  y += 10

  // ── Datos del recibo ──────────────────────────────────────────
  const datos = [
    ['N° de Recibo', cuotaId?.slice(0, 12)?.toUpperCase() ?? '—'],
    ['Fecha de emisión', formatFecha(new Date())],
    ['Fecha de pago', formatFecha(fechaPago)],
    ['', ''],
    ['Apoderado', nombreApoderado ?? '—'],
    ['RUT', rutApoderado ?? '—'],
    ['Estudiante', nombreEstudiante ?? '—'],
    ['Curso', curso ?? '—'],
    ['', ''],
    ['Concepto', `Mensualidad ${mes} ${anio}`],
  ]

  doc.setFontSize(10)
  for (const [label, value] of datos) {
    if (!label && !value) { y += 4; continue }

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(label, marginL, y)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(String(value), pageW - marginR, y, { align: 'right' })

    y += 7
  }

  y += 6

  // ── Monto en recuadro grande ──────────────────────────────────
  doc.setFillColor(240, 253, 244) // verde muy claro
  doc.setDrawColor(187, 247, 208) // borde verde
  doc.roundedRect(marginL, y, pageW - marginL - marginR, 28, 4, 4, 'FD')

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(107, 114, 128)
  doc.text('MONTO PAGADO', marginL + 8, y + 10)

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 163, 74) // verde
  doc.text(formatCLP(monto), pageW - marginR - 8, y + 20, { align: 'right' })

  y += 38

  // ── Código de autorización ──────────────────────────────────
  if (codigoAutorizacion) {
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(marginL, y, pageW - marginL - marginR, 16, 3, 3, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text('Código de autorización bancaria:', marginL + 6, y + 10)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(codigoAutorizacion, pageW - marginR - 6, y + 10, { align: 'right' })

    y += 24
  }

  // ── Estado ────────────────────────────────────────────────────
  doc.setFillColor(22, 163, 74) // verde
  doc.roundedRect(pageW / 2 - 25, y, 50, 12, 3, 3, 'F')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('✓  PAGADO', pageW / 2, y + 8, { align: 'center' })

  y += 24

  // ── Texto legal ────────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(156, 163, 175)
  const legalText = [
    'Este documento es un comprobante de pago interno del Colegio Diego Thomson.',
    'No constituye boleta ni factura tributaria. Conserve este documento para sus registros.',
    `Generado electrónicamente el ${formatFecha(new Date())} a las ${new Date().toLocaleTimeString('es-CL')}.`,
  ]
  legalText.forEach((line) => {
    doc.text(line, pageW / 2, y, { align: 'center' })
    y += 4
  })

  // ── Footer verde ──────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFillColor(140, 198, 63)
  doc.rect(0, pageH - 12, pageW, 12, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(26, 46, 0)
  doc.text('Colegio Diego Thomson · Portal Escolar · www.colegiodiegothomson.cl', pageW / 2, pageH - 5, { align: 'center' })

  // ── Descargar ──────────────────────────────────────────────────
  doc.save(`Recibo_${mes}_${anio}_${nombreEstudiante?.replace(/\s/g, '_') ?? 'pago'}.pdf`)
}
