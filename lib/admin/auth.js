// ─────────────────────────────────────────────────────────────────────────────
// lib/admin/auth.js
// Módulo compartido de autorización para las API routes del panel admin.
//
// Exporta:
//   getRolEfectivo(uid, decodedToken) → 'admin' | 'secretaria' | null
//
// Antes existía copiada literalmente en confirmar-pago-manual/route.js y
// procesar-revision/route.js. Centralizada aquí para que cualquier cambio
// de lógica de roles afecte a todos los endpoints por igual.
// ─────────────────────────────────────────────────────────────────────────────
import { adminDb } from '../../firebase/adminConfig'

/**
 * Determina el rol efectivo del usuario autenticado.
 *
 * Jerarquía de verificación:
 *   1. Custom claim 'admin'      → rol = 'admin'
 *   2. Custom claim 'secretaria' → rol = 'secretaria'
 *   3. Presencia en /Admins/{uid} → rol = 'admin'  (fallback sin claim)
 *   4. Ninguno                   → null
 *
 * @param {string} uid           UID de Firebase Auth
 * @param {object} decodedToken  Token decodificado por adminAuth.verifyIdToken()
 * @returns {Promise<'admin'|'secretaria'|null>}
 */
export async function getRolEfectivo(uid, decodedToken) {
  if (decodedToken.role === 'admin')      return 'admin'
  if (decodedToken.role === 'secretaria') return 'secretaria'
  const adminSnap = await adminDb.collection('Admins').doc(uid).get()
  if (adminSnap.exists)                   return 'admin'
  return null
}
