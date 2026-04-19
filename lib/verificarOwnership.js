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
    if (!authHeader.startsWith('Bearer ')) {
      // [DEBUG_PAGO] Paso 1: sin header Authorization válido
      console.warn('[DEBUG_PAGO] verificarOwnership: sin header Authorization → false')
      return false
    }

    const idToken = authHeader.slice(7)
    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(idToken)
    } catch (tokenErr) {
      // [DEBUG_PAGO] Paso 2: token Firebase inválido o expirado
      console.warn('[DEBUG_PAGO] verificarOwnership: verifyIdToken falló →', tokenErr?.message)
      return false
    }
    const uid = decoded.uid
    // [DEBUG_PAGO] Paso 2 OK: token verificado
    console.log('[DEBUG_PAGO] verificarOwnership: token OK | uid:', uid)

    // Obtener el estudiante del usuario autenticado
    const userSnap = await adminDb.collection('Estudiantes').doc(uid).get()
    if (!userSnap.exists) {
      // [DEBUG_PAGO] Paso 3: no existe Estudiantes/{uid}
      console.warn('[DEBUG_PAGO] verificarOwnership: Estudiantes/' + uid + ' no existe → false')
      return false
    }

    const apoderadoRut = userSnap.data().apoderado_rut_limpio
    if (!apoderadoRut) {
      // [DEBUG_PAGO] Paso 4: falta campo apoderado_rut_limpio
      console.warn('[DEBUG_PAGO] verificarOwnership: campo apoderado_rut_limpio ausente en Estudiantes/' + uid + ' → false')
      return false
    }
    // [DEBUG_PAGO] Paso 3-4 OK
    console.log('[DEBUG_PAGO] verificarOwnership: apoderado_rut_limpio presente | cuota.es_voluntaria:', !!cuota.es_voluntaria, '| cuota.estudiante_id:', cuota.estudiante_id)

    // Cuota voluntaria CGPA: el apoderado_id debe coincidir
    if (cuota.es_voluntaria) {
      const ok = cuota.apoderado_id === apoderadoRut
      // [DEBUG_PAGO] Paso 5: cuota voluntaria
      console.log('[DEBUG_PAGO] verificarOwnership: cuota voluntaria | match:', ok)
      return ok
    }

    // Cuota mensual: ruta rápida si es del mismo estudiante
    if (cuota.estudiante_id === uid) {
      // [DEBUG_PAGO] Paso 6: match directo uid
      console.log('[DEBUG_PAGO] verificarOwnership: match directo uid → true')
      return true
    }

    // Verificar que el estudiante de la cuota pertenece al mismo apoderado (hermano)
    const estudianteSnap = await adminDb.collection('Estudiantes').doc(cuota.estudiante_id).get()
    if (!estudianteSnap.exists) {
      // [DEBUG_PAGO] Paso 7: estudiante de la cuota no existe
      console.warn('[DEBUG_PAGO] verificarOwnership: Estudiantes/' + cuota.estudiante_id + ' (de cuota) no existe → false')
      return false
    }

    const rutHermano = estudianteSnap.data().apoderado_rut_limpio
    const ok = rutHermano === apoderadoRut
    // [DEBUG_PAGO] Paso 7: verificación por hermano
    console.log('[DEBUG_PAGO] verificarOwnership: check hermano | match:', ok)
    return ok

  } catch (err) {
    console.error('[verificarOwnership] error:', err?.message)
    return false
  }
}
