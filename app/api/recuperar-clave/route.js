// ─────────────────────────────────────────────────────────────────────────────
// app/api/recuperar-clave/route.js
//
// Flujo:
//   1. Recibe el RUT del estudiante desde el formulario de login.
//   2. Deriva el email interno (rut@colegiodiegothompson.cl) y busca al
//      usuario en Firebase Auth para obtener su UID.
//   3. Lee el doc Estudiantes/{uid} en Firestore para obtener apoderado_email.
//   4. Genera un link de reset real con el Admin SDK.
//   5. Envía ese link al correo real del apoderado via SMTP (nodemailer).
//
// Seguridad: siempre devuelve { ok: true } aunque el RUT no exista,
// para evitar la enumeración de usuarios (anti-user-enumeration).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import nodemailer        from 'nodemailer'
import { adminAuth, adminDb } from '../../../firebase/adminConfig'

const EMAIL_DOMAIN = 'colegiodiegothompson.cl'

function normalizarRut(rut) {
  return rut.replace(/[.\-\s]/g, '').trim().toLowerCase()
}

function rutAEmailInterno(rut) {
  return `${normalizarRut(rut)}@${EMAIL_DOMAIN}`
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { rut } = body ?? {}
  if (!rut || typeof rut !== 'string') {
    return NextResponse.json({ error: 'RUT requerido' }, { status: 400 })
  }

  const emailInterno = rutAEmailInterno(rut)

  try {
    // ── 1. Buscar usuario en Firebase Auth ─────────────────────────────────────
    let uid
    try {
      const userRecord = await adminAuth.getUserByEmail(emailInterno)
      uid = userRecord.uid
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        // Anti-enumeración: respondemos igual aunque no exista
        return NextResponse.json({ ok: true })
      }
      throw err
    }

    // ── 2. Obtener apoderado_email desde Firestore ─────────────────────────────
    const estDoc = await adminDb.collection('Estudiantes').doc(uid).get()
    if (!estDoc.exists) {
      return NextResponse.json({ ok: true })
    }

    const { apoderado_email: apoderadoEmail, nombre: nombreEstudiante = 'su hijo/a' } = estDoc.data()

    if (!apoderadoEmail) {
      console.warn(`[recuperar-clave] El estudiante ${uid} no tiene apoderado_email registrado.`)
      return NextResponse.json({ ok: true })
    }

    // ── 3. Generar link de reset con Admin SDK ─────────────────────────────────
    // generatePasswordResetLink usa el email interno de Firebase Auth.
    // El apoderado recibirá el link en su correo real, pero al hacer clic
    // restablecerá la contraseña de la cuenta interna del portal.
    const resetLink = await adminAuth.generatePasswordResetLink(emailInterno)

    // ── 4. Enviar email al apoderado via SMTP ──────────────────────────────────
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',   // true = puerto 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const remitente = process.env.SMTP_FROM || process.env.SMTP_USER

    await transporter.sendMail({
      from:    `"Colegio Diego Thomson" <${remitente}>`,
      to:      apoderadoEmail,
      subject: 'Recuperación de contraseña — Portal Escolar',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="margin-bottom: 4px;">Recuperación de contraseña</h2>
          <p style="color: #555; margin-top: 0;">Portal Escolar — Colegio Diego Thomson</p>

          <p>Estimado/a apoderado/a,</p>
          <p>
            Recibimos una solicitud para restablecer la contraseña del portal
            correspondiente al estudiante <strong>${nombreEstudiante}</strong>.
          </p>
          <p>Haz clic en el botón para crear una nueva contraseña:</p>

          <p style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}"
               style="background-color: #8CC63F; color: #fff; padding: 13px 30px;
                      border-radius: 8px; text-decoration: none; font-weight: bold;
                      font-size: 15px; display: inline-block;">
              Crear nueva contraseña
            </a>
          </p>

          <p style="color: #888; font-size: 13px;">
            Si no realizaste esta solicitud, puedes ignorar este correo con total seguridad.
            El enlace expira en <strong>1 hora</strong>.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0;" />
          <p style="color: #bbb; font-size: 12px; margin: 0;">
            Colegio Diego Thomson · Portal de Pagos Escolares
          </p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[recuperar-clave] Error interno:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
