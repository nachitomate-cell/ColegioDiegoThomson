// ─────────────────────────────────────────────────────────────────────────────
// lib/verificarOwnership.js
// Verifica que el usuario autenticado tiene derecho a pagar la cuota indicada.
//
// Flujo:
//   1. Extrae el ID token del header Authorization: Bearer <token>
//   2. Lo verifica con Firebase Admin → obtiene uid del usuario
//   3. Busca el estudiante del usuario → obtiene apoderado_rut_limpio
//   4. Verifica que la cuota pertenece a un hijo de ese apoderado
// ─────────────────────────────────────────────────────────────────────────────
import { adminAuth, adminDb } from '../firebase/adminConfig'

/**
 * @param {Request} request  - Next.js Request object
 * @param {object}  cuota    - Datos del documento Cuota de Firestore
 * @returns {Promise<boolean>}
 */
export async function verificarOwnership(request, cuota) {
  try {
    const authHeader = request.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return false

    const idToken = authHeader.slice(7)
    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid     = decoded.uid

    // Obtener el estudiante del usuario autenticado
    const userSnap = await adminDb.collection('Estudiantes').doc(uid).get()
    if (!userSnap.exists) return false

    const apoderadoRut = userSnap.data().apoderado_rut_limpio
    if (!apoderadoRut) return false

    // Cuota voluntaria CGPA: el apoderado_id debe coincidir
    if (cuota.es_voluntaria) {
      return cuota.apoderado_id === apoderadoRut
    }

    // Cuota mensual: ruta rápida si es del mismo estudiante
    if (cuota.estudiante_id === uid) return true

    // Verificar que el estudiante de la cuota pertenece al mismo apoderado (hermano)
    const estudianteSnap = await adminDb.collection('Estudiantes').doc(cuota.estudiante_id).get()
    if (!estudianteSnap.exists) return false

    return estudianteSnap.data().apoderado_rut_limpio === apoderadoRut

  } catch (err) {
    console.error('[verificarOwnership] error:', err?.message)
    return false
  }
}
