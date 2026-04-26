// ─────────────────────────────────────────────────────────────────────────────
// app/api/admin/crear-usuario/route.js
//
// Crea un usuario en Firebase Auth usando el Admin SDK (server-side).
// Ventaja clave: NO inicia sesión como el nuevo usuario, por lo que el
// admin que hace la solicitud NO pierde su sesión activa.
//
// Seguridad:
//   1. Verifica ID token de Firebase → 401 si inválido
//   2. Determina rol efectivo (admin o secretaria) → 403 si ninguno
//   3. Valida campos obligatorios
//   4. Crea el usuario en Firebase Auth
//   5. Registra la acción en AuditoriaPagos
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse }   from 'next/server'
import { adminAuth, adminDb } from '../../../../firebase/adminConfig'
import admin              from '../../../../firebase/adminConfig'
import { getRolEfectivo } from '../../../../lib/admin/auth'

export async function POST(request) {
  // ── 1. Verificar token ──────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let decoded
  try {
    decoded = await adminAuth.verifyIdToken(authHeader.slice(7))
  } catch {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
  }
  const uid = decoded.uid

  // ── 2. Verificar rol (admin o secretaria pueden crear usuarios) ─────────────
  const rol = await getRolEfectivo(uid, decoded)
  if (!rol) {
    return NextResponse.json({ error: 'Acceso denegado: se requiere rol admin o secretaria' }, { status: 403 })
  }

  // ── 3. Validar body ─────────────────────────────────────────────────────────
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Faltan campos obligatorios: email y password' },
      { status: 400 }
    )
  }

  // ── 4. Crear usuario en Firebase Auth ───────────────────────────────────────
  try {
    const newUser = await adminAuth.createUser({ email, password })

    // ── 5. Auditoría ────────────────────────────────────────────────────────────
    // Best-effort: un fallo aquí no revierte la creación del usuario.
    try {
      const actorNombre = decoded.name || decoded.email?.split('@')[0] || uid.slice(0, 8)
      const ipCaller    = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                       || request.headers.get('x-real-ip')
                       || 'desconocida'
      const userAgent   = request.headers.get('user-agent') || 'desconocido'

      await adminDb.collection('AuditoriaPagos').add({
        accion:           'creacion_usuario',
        email_creado:     email,
        uid_creado:       newUser.uid,
        admin_uid:        uid,
        admin_nombre:     actorNombre,
        admin_rol:        rol,
        timestamp:        admin.firestore.FieldValue.serverTimestamp(),
        ip_caller:        ipCaller,
        user_agent_caller: userAgent,
      })
    } catch (auditErr) {
      console.error('[crear-usuario] Error escribiendo auditoría:', auditErr.message)
    }

    console.log(`[crear-usuario] Usuario creado: ${email} (${newUser.uid}) por ${decoded.email} (${rol})`)
    return NextResponse.json({ uid: newUser.uid }, { status: 201 })

  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      // El RUT ya tiene cuenta — devolvemos el UID para que el form pueda
      // continuar y actualizar Firestore sin volver a crear el Auth user.
      try {
        const existing = await adminAuth.getUserByEmail(email)
        return NextResponse.json(
          { error: 'auth/email-already-in-use', uid: existing.uid },
          { status: 409 }
        )
      } catch {
        return NextResponse.json({ error: 'auth/email-already-in-use' }, { status: 409 })
      }
    }

    console.error('[crear-usuario]', err)
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}
