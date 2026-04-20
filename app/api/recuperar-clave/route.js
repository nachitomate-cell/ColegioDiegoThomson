// ─────────────────────────────────────────────────────────────────────────────
// app/api/recuperar-clave/route.js
//
// Flujo:
//   1. Recibe el RUT del estudiante desde el formulario de login.
//   2. Deriva el email interno (rut@colegiodiegothompson.cl) y busca al
//      usuario en Firebase Auth para obtener su UID.
//   3. Lee el doc Estudiantes/{uid} en Firestore para obtener apoderado_email.
//   4. Genera un link de reset real con el Admin SDK.
//   5. Envía ese link al correo real del apoderado via Resend.
//
// Seguridad: siempre devuelve { ok: true } aunque el RUT no exista,
// para evitar la enumeración de usuarios (anti-user-enumeration).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse }           from 'next/server'
import { adminAuth, adminDb }     from '../../../firebase/adminConfig'
import { enviarEmail }            from '../../../lib/email/sender'

const EMAIL_DOMAIN = 'colegiodiegothompson.cl'

function normalizarRut(rut) {
  return rut.replace(/[.\-\s]/g, '').trim().toLowerCase()
}

function rutAEmailInterno(rut) {
  return `${normalizarRut(rut)}@${EMAIL_DOMAIN}`
}

function plantillaResetPassword(nombreEstudiante, resetLink) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Restablecer contraseña</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 560px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #0D2C54; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px; }
    .content { padding: 32px 28px; color: #333; line-height: 1.6; }
    .content p { margin: 0 0 16px; }
    .button-wrap { text-align: center; margin: 28px 0; }
    .button { display: inline-block; background: #C9A227; color: white; padding: 13px 36px;
              text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
    .note { color: #777; font-size: 13px; }
    .footer { padding: 16px 28px; background: #f5f5f5; color: #999; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Colegio Diego Thomson</h1>
    </div>
    <div class="content">
      <p>Estimado/a apoderado/a,</p>
      <p>
        Recibimos una solicitud para restablecer la contraseña del portal
        correspondiente al estudiante <strong>${nombreEstudiante}</strong>.
      </p>
      <p>Haz clic en el botón para crear una nueva contraseña:</p>
      <div class="button-wrap">
        <a href="${resetLink}" class="button">Restablecer contraseña</a>
      </div>
      <p class="note">
        Este enlace es válido por <strong>1 hora</strong>. Si no solicitaste este cambio,
        puedes ignorar este correo de forma segura.
      </p>
    </div>
    <div class="footer">
      Portal de Pagos · Colegio Diego Thomson<br/>
      Este es un correo automático, por favor no responder.
    </div>
  </div>
</body>
</html>`
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
      console.warn(`[recuperar-clave] Estudiante ${uid} sin apoderado_email`)
      return NextResponse.json({ ok: true })
    }

    // ── 3. Generar link de reset con Admin SDK ─────────────────────────────────
    // generatePasswordResetLink usa el email interno de Firebase Auth.
    // El apoderado recibe el link en su correo real, pero al hacer clic
    // restablece la contraseña de la cuenta interna del portal.
    const resetLink = await adminAuth.generatePasswordResetLink(emailInterno)

    // ── 4. Enviar email al apoderado via Resend ────────────────────────────────
    const resultado = await enviarEmail({
      to:      apoderadoEmail,
      subject: 'Restablece tu contraseña — Portal Colegio Diego Thomson',
      html:    plantillaResetPassword(nombreEstudiante, resetLink),
    })

    if (!resultado.ok) {
      console.error('[recuperar-clave] No se pudo enviar el email:', resultado.error)
      return NextResponse.json(
        { error: 'No pudimos enviar el correo de recuperación. Intenta más tarde o contacta a secretaría.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[recuperar-clave] Error interno:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
