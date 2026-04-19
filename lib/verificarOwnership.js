// ─────────────────────────────────────────────────────────────────────────────
// lib/verificarOwnership.js
// Verifica que el usuario autenticado tiene derecho a pagar la cuota indicada.
//
// Flujo:
//   1. Extrae el ID token del header Authorization: Bearer <token>
//   2. Lo verifica con Firebase Admin → obtiene uid del usuario
//   3. Busca el estudiante del usuario → obtiene su RUT de apoderado
//   4. Verifica que la cuota pertenece a un hijo de ese apoderado
//
// Nota sobre apoderado_rut_limpio vs apoderado_rut:
//   Algunos documentos Estudiantes tienen solo apoderado_rut (con formato
//   "12.345.678-9") y carecen de apoderado_rut_limpio. Se normaliza con
//   limpiarRut() para comparar de forma robusta en ambos casos.
// ─────────────────────────────────────────────────────────────────────────────
import { adminAuth, adminDb } from '../firebase/adminConfig'

/**
 * Normaliza un RUT chileno eliminando puntos, guiones y espacios,
 * y convirtiendo el dígito verificador a mayúscula.
 * Permite comparar "12.345.678-k" con "12345678K" correctamente.
 * @param {string|null|undefined} rut
 * @returns {string}
 */
function limpiarRut(rut) {
  return (rut ?? '').replace(/[\.\-\s]/g, '').toUpperCase().trim()
}

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

    // Cuota mensual propia: si el estudiante_id coincide con el uid autenticado,
    // autorizar directamente sin necesitar el RUT del apoderado.
    // Este check va ANTES de leer apoderado_rut para no bloquear documentos
    // que tengan ese campo ausente pero sí sean el dueño legítimo de la cuota.
    if (!cuota.es_voluntaria && cuota.estudiante_id === uid) return true

    const userData = userSnap.data()

    // Para cuotas de hermanos o voluntarias necesitamos el RUT del apoderado.
    // Preferir apoderado_rut_limpio; si está ausente, derivarlo de apoderado_rut.
    const apoderadoRut = limpiarRut(
      userData.apoderado_rut_limpio ?? userData.apoderado_rut
    )
    if (!apoderadoRut) return false

    // Cuota voluntaria CGPA: el apoderado_id debe coincidir
    if (cuota.es_voluntaria) {
      return limpiarRut(cuota.apoderado_id) === apoderadoRut
    }

    // Verificar que el estudiante de la cuota pertenece al mismo apoderado (hermano)
    const estudianteSnap = await adminDb.collection('Estudiantes').doc(cuota.estudiante_id).get()
    if (!estudianteSnap.exists) return false

    const siblingData = estudianteSnap.data()
    const siblingRut  = limpiarRut(siblingData.apoderado_rut_limpio ?? siblingData.apoderado_rut)
    return siblingRut !== '' && siblingRut === apoderadoRut

  } catch (err) {
    console.error('[verificarOwnership] error:', err?.message)
    return false
  }
}
