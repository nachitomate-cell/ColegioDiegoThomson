// ─────────────────────────────────────────────────────────────────────────────
// app/api/admin/crear-usuario/route.js
//
// Crea un usuario en Firebase Auth usando el Admin SDK (server-side).
// Ventaja clave: NO inicia sesión como el nuevo usuario, por lo que el
// admin que hace la solicitud NO pierde su sesión activa.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { adminAuth, adminDb } from '../../../../firebase/adminConfig'

export async function POST(request) {
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

  // Verificar que quien llama es un admin registrado en Firestore.
  const authHeader = request.headers.get('Authorization') ?? ''
  const idToken    = authHeader.replace('Bearer ', '').trim()

  if (!idToken) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const decoded   = await adminAuth.verifyIdToken(idToken)
    const adminSnap = await adminDb.collection('Admins').doc(decoded.uid).get()
    if (!adminSnap.exists) {
      return NextResponse.json({ error: 'Acceso denegado: no eres admin' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
  }

  try {
    // Crear el usuario en Firebase Auth con el Admin SDK.
    // A diferencia del SDK cliente, esto NO cambia la sesión activa.
    const newUser = await adminAuth.createUser({ email, password })
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
