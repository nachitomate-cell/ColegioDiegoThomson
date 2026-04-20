// ─────────────────────────────────────────────────────────────────────────────
// lib/email/sender.js
// Wrapper centralizado para el envío de emails via Resend.
//
// Variables de entorno requeridas:
//   RESEND_API_KEY       — clave de la API de Resend
//   RESEND_FROM_EMAIL    — dirección remitente (debe estar verificada en Resend)
//   RESEND_FROM_NAME     — nombre visible del remitente (opcional)
// ─────────────────────────────────────────────────────────────────────────────
import { Resend } from 'resend'

let _resend = null

function getResend() {
  if (_resend) return _resend
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY no configurada')
  _resend = new Resend(apiKey)
  return _resend
}

/**
 * Envía un email usando Resend.
 *
 * @param {{ to: string, subject: string, html: string, text?: string }} params
 * @returns {Promise<{ ok: boolean, id?: string, error?: string }>}
 */
export async function enviarEmail({ to, subject, html, text }) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const fromName  = process.env.RESEND_FROM_NAME  || 'Colegio Diego Thomson'
  const from      = `${fromName} <${fromEmail}>`

  try {
    const resend         = getResend()
    const { data, error } = await resend.emails.send({ from, to, subject, html, text })

    if (error) {
      console.error('[email] Error de Resend', { code: error.name, message: error.message })
      return { ok: false, error: error.message }
    }

    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[email] Excepción al enviar', { mensaje: err.message })
    return { ok: false, error: 'No se pudo enviar el email' }
  }
}
