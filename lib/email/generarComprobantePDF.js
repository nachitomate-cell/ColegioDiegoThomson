// ─────────────────────────────────────────────────────────────────────────────
// lib/email/generarComprobantePDF.js
// Genera un comprobante de pago en PDF server-side usando pdfkit.
// Devuelve un Buffer listo para adjuntar a un email.
//
// IMPORTANTE: este PDF es exclusivo para el email. El voucher que se muestra
// en pantalla sigue siendo el generado por jsPDF en lib/generarReciboPDF.js.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el PDF del comprobante de pago.
 *
 * @param {{
 *   apoderadoNombre: string,
 *   estudianteNombre: string,
 *   concepto: string,
 *   monto: number,
 *   fechaPago: Date,
 *   medioPago: string,
 *   transactionId: string,
 *   colegioNombre: string,
 *   colegioRut: string,
 *   colegioDireccion: string,
 * }} params
 * @returns {Promise<Buffer>}
 */
export async function generarComprobantePDF({
  apoderadoNombre,
  estudianteNombre,
  concepto,
  monto,
  fechaPago,
  medioPago,
  transactionId,
  colegioNombre,
  colegioRut,
  colegioDireccion,
}) {
  // Importación dinámica para evitar problemas de bundling con webpack
  const PDFDocumentModule = await import('pdfkit')
  const PDFDocument = PDFDocumentModule.default ?? PDFDocumentModule

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks = []

    doc.on('data',  (chunk) => chunks.push(chunk))
    doc.on('end',   ()      => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ── Header navy ───────────────────────────────────────────────────────────
    doc.rect(0, 0, 612, 80).fill('#0D2C54')
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
       .text(colegioNombre, 50, 25, { width: 512 })
    doc.fontSize(10).font('Helvetica')
       .text('Comprobante de pago', 50, 52)

    // ── Banda dorada divisoria ────────────────────────────────────────────────
    doc.rect(0, 80, 612, 4).fill('#C9A227')

    // ── Título sección ────────────────────────────────────────────────────────
    doc.fillColor('#0D2C54').fontSize(14).font('Helvetica-Bold')
       .text('Detalle de la transacción', 50, 108)

    // ── Tabla de datos ────────────────────────────────────────────────────────
    const startY     = 138
    const lineHeight = 26
    const colLabel   = 50
    const colValue   = 210

    const fechaFormateada = fechaPago instanceof Date && !isNaN(fechaPago)
      ? fechaPago.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
      : String(fechaPago)

    const montoFormateado = typeof monto === 'number'
      ? `$${monto.toLocaleString('es-CL')}`
      : `$${monto}`

    const filas = [
      ['Apoderado',       apoderadoNombre  || '—'],
      ['Estudiante',      estudianteNombre || '—'],
      ['Concepto',        concepto         || '—'],
      ['Monto pagado',    montoFormateado],
      ['Fecha de pago',   fechaFormateada],
      ['Medio de pago',   medioPago        || '—'],
      ['ID transacción',  transactionId    || '—'],
    ]

    filas.forEach(([label, value], i) => {
      const y = startY + i * lineHeight

      // Fondo alternado suave
      if (i % 2 === 0) {
        doc.rect(46, y - 4, 520, lineHeight).fill('#F8F5F0').stroke('#F8F5F0')
      }

      doc.font('Helvetica').fontSize(9).fillColor('#888888')
         .text(label.toUpperCase(), colLabel, y)
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1A1A1A')
         .text(value, colValue, y, { width: 350 })
    })

    // ── Disclaimer legal ──────────────────────────────────────────────────────
    const disclaimerY = startY + filas.length * lineHeight + 32
    doc.rect(50, disclaimerY, 512, 76).fill('#FFF3CD').stroke('#C9A227')
    doc.fillColor('#7A5C00').fontSize(9).font('Helvetica-Oblique')
       .text(
         'Importante: este documento es un comprobante de pago interno del colegio. ' +
         'NO constituye Documento Tributario Electrónico (DTE) ante el Servicio de ' +
         'Impuestos Internos (SII). La boleta o factura tributaria oficial será emitida ' +
         'por separado según corresponda.',
         62, disclaimerY + 10, { width: 488, align: 'left' }
       )

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerParts = [colegioNombre]
    if (colegioRut)       footerParts.push(`RUT ${colegioRut}`)
    if (colegioDireccion) footerParts.push(colegioDireccion)

    doc.fontSize(8).fillColor('#999999').font('Helvetica')
       .text(
         footerParts.join('  ·  '),
         50, 748, { align: 'center', width: 512 }
       )

    doc.end()
  })
}
