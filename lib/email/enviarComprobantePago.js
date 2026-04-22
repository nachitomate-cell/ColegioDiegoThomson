// ─────────────────────────────────────────────────────────────────────────────
// lib/email/enviarComprobantePago.js
// Orquesta la generación del PDF server-side y el envío del email de
// comprobante al apoderado tras un pago exitoso.
//
// Uso:
//   import { enviarComprobantePago } from '@/lib/email/enviarComprobantePago'
//   await enviarComprobantePago({ apoderadoEmail, apoderadoNombre, ... })
//
// Esta función es best-effort: captura sus propias excepciones para que
// un fallo de email nunca bloquee ni revierta un pago.
// ─────────────────────────────────────────────────────────────────────────────
import { enviarEmail }          from './sender'
import { generarComprobantePDF } from './generarComprobantePDF'
import { COLEGIO_INFO }          from '../constants'

const NOMBRE_COLEGIO   = 'Colegio Diego Thomson'

/**
 * Envía el comprobante de pago por email al apoderado.
 *
 * @param {{
 *   apoderadoEmail:   string,
 *   apoderadoNombre:  string,
 *   estudianteNombre: string,
 *   concepto:         string,
 *   monto:            number,
 *   fechaPago:        Date,
 *   medioPago:        string,
 *   transactionId:    string,
 * }} params
 * @returns {Promise<{ ok: boolean, id?: string, error?: string }>}
 */
export async function enviarComprobantePago({
  apoderadoEmail,
  apoderadoNombre,
  estudianteNombre,
  concepto,
  monto,
  fechaPago,
  medioPago,
  transactionId,
}) {
  const colegioNombre   = COLEGIO_INFO.razonSocial || NOMBRE_COLEGIO
  const colegioRut      = COLEGIO_INFO.rut         || ''
  const colegioDireccion = COLEGIO_INFO.direccion  || ''

  // ── 1. Generar PDF ──────────────────────────────────────────────────────────
  const pdfBuffer = await generarComprobantePDF({
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
  })

  // ── 2. HTML del email ───────────────────────────────────────────────────────
  const montoFormateado = typeof monto === 'number'
    ? monto.toLocaleString('es-CL')
    : monto

  const fechaFormateada = fechaPago instanceof Date && !isNaN(fechaPago)
    ? fechaPago.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    : String(fechaPago)

  const primerNombre = apoderadoNombre?.split(' ')[0] || 'Apoderado'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprobante de pago</title>
</head>
<body style="margin:0;padding:20px;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0D2C54;padding:28px 28px 20px;text-align:center;">
      <p style="margin:0 0 4px;color:#C9A227;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">
        ${colegioNombre}
      </p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
        Pago confirmado
      </h1>
    </div>

    <!-- Banda dorada -->
    <div style="height:4px;background:#C9A227;"></div>

    <!-- Contenido -->
    <div style="padding:28px 28px 20px;">
      <p style="margin:0 0 20px;color:#333333;font-size:15px;line-height:1.6;">
        Hola <strong>${primerNombre}</strong>,<br>
        recibimos tu pago correctamente. Adjuntamos el comprobante en PDF.
      </p>

      <!-- Resumen -->
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#F8F5F0;border-radius:6px;overflow:hidden;margin-bottom:20px;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #ece8e0;">
            <p style="margin:0 0 2px;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Estudiante</p>
            <p style="margin:0;font-size:14px;font-weight:700;color:#0D2C54;">${estudianteNombre}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #ece8e0;">
            <p style="margin:0 0 2px;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Concepto</p>
            <p style="margin:0;font-size:14px;font-weight:700;color:#1A1A1A;">${concepto}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #ece8e0;">
            <p style="margin:0 0 2px;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Monto pagado</p>
            <p style="margin:0;font-size:24px;font-weight:700;color:#1B7A4A;">$${montoFormateado}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #ece8e0;">
            <p style="margin:0 0 2px;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Fecha de pago</p>
            <p style="margin:0;font-size:14px;font-weight:700;color:#1A1A1A;">${fechaFormateada}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #ece8e0;">
            <p style="margin:0 0 2px;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Medio de pago</p>
            <p style="margin:0;font-size:14px;font-weight:700;color:#1A1A1A;">${medioPago}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;">
            <p style="margin:0 0 2px;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">ID de transacción</p>
            <p style="margin:0;font-size:13px;font-weight:700;color:#1A1A1A;font-family:monospace;">${transactionId}</p>
          </td>
        </tr>
      </table>

      <!-- Disclaimer -->
      <div style="background:#FFF3CD;border:1px solid #C9A227;border-radius:6px;padding:14px 16px;margin-bottom:20px;">
        <p style="margin:0;font-size:12px;color:#7A5C00;line-height:1.5;">
          <strong>Importante:</strong> este email confirma la recepción de tu pago.
          No constituye boleta tributaria electrónica (DTE) ante el SII.
          La boleta oficial del colegio será emitida por separado según corresponda.
        </p>
      </div>

      <p style="margin:0;font-size:13px;color:#666666;line-height:1.5;">
        Si tienes dudas sobre este pago, contacta a secretaría del colegio.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;background:#f4f4f4;border-top:1px solid #e8e8e8;text-align:center;">
      <p style="margin:0;font-size:12px;color:#888888;">
        ${colegioNombre}
        ${colegioRut ? `&nbsp;·&nbsp; RUT ${colegioRut}` : ''}
        ${colegioDireccion ? `&nbsp;·&nbsp; ${colegioDireccion}` : ''}
      </p>
      <p style="margin:4px 0 0;font-size:11px;color:#aaaaaa;">
        Este es un correo automático, por favor no responder a este mensaje.
      </p>
    </div>

  </div>
</body>
</html>`

  // ── 3. Enviar email con PDF adjunto ─────────────────────────────────────────
  const nombreArchivo = `comprobante-${transactionId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`

  return await enviarEmail({
    to:          apoderadoEmail,
    subject:     `Comprobante de pago – ${concepto} – ${estudianteNombre}`,
    html,
    attachments: [
      {
        filename: nombreArchivo,
        content:  pdfBuffer,
      },
    ],
  })
}
