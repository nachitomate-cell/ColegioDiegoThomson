// ─────────────────────────────────────────────────────────────────────────────
// app/api/consentimiento/registrar/route.js
//
// Registra el consentimiento explícito de un apoderado en Firestore.
// Solo puede llamarse con un Bearer token Firebase válido.
//
// Escribe en: Consentimientos/{uid}
// Schema:
//   uid_apoderado            string
//   rut_apoderado            string
//   rut_estudiante_principal string
//   email_al_aceptar         string
//   version_politica         string
//   fecha_aceptacion         Timestamp (serverTimestamp)
//   ip_cliente               string
//   user_agent               string
//   acepto_politica          true
//   acepto_tratamiento_menor true
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse }       from 'next/server'
import { FieldValue }         from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '../../../../firebase/adminConfig'
import { POLITICA_PRIVACIDAD_VERSION } from '../../../../lib/constants'

export async function POST(request) {
  // ── 1. Verificar Bearer token ──────────────────────────────────────────────
  const authHeader = request.headers.get('authorization') ?? ''
  const idToken    = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!idToken) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let decodedToken
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken)
  } catch {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
  }

  const uid = decodedToken.uid

  // ── 2. Leer doc del estudiante para obtener ruts ───────────────────────────
  const estSnap = await adminDb.collection('Estudiantes').doc(uid).get()
  if (!estSnap.exists) {
    return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
  }

  const estData = estSnap.data()
  const rutApoderado   = estData.apoderado_rut_limpio ?? ''
  const rutEstudiante  = estData.rut_limpio ?? uid
  const emailApoderado = decodedToken.email ?? estData.apoderado_email ?? ''

  // ── 3. Capturar IP y user-agent ────────────────────────────────────────────
  const forwardedFor = request.headers.get('x-forwarded-for') ?? ''
  const ipCliente    = forwardedFor.split(',')[0].trim() || 'desconocida'
  const userAgent    = request.headers.get('user-agent') ?? 'desconocido'

  // ── 4. Escribir en Consentimientos/{uid} ──────────────────────────────────
  // set() con merge:false → sobreescribe si ya existe (nuevo consentimiento
  // por versión más reciente reemplaza al anterior).
  try {
    await adminDb.collection('Consentimientos').doc(uid).set({
      uid_apoderado:            uid,
      rut_apoderado:            rutApoderado,
      rut_estudiante_principal: rutEstudiante,
      email_al_aceptar:         emailApoderado,
      version_politica:         POLITICA_PRIVACIDAD_VERSION,
      fecha_aceptacion:         FieldValue.serverTimestamp(),
      ip_cliente:               ipCliente,
      user_agent:               userAgent,
      acepto_politica:          true,
      acepto_tratamiento_menor: true,
    })
  } catch (err) {
    console.error('[consentimiento/registrar] Error al escribir en Firestore:', err)
    return NextResponse.json({ error: 'No se pudo registrar el consentimiento' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, version: POLITICA_PRIVACIDAD_VERSION })
}
