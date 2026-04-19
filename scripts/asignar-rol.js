// ─────────────────────────────────────────────────────────────────────────────
// scripts/asignar-rol.js
// Asigna un custom claim de rol a un usuario de Firebase Auth.
//
// Uso:
//   node scripts/asignar-rol.js <uid> <rol>
//
// Roles válidos: admin | secretaria
//
// Ejemplos:
//   node scripts/asignar-rol.js AbCdEfGhIjKlMnOp admin
//   node scripts/asignar-rol.js AbCdEfGhIjKlMnOp secretaria
//
// Para QUITAR el rol:
//   node scripts/asignar-rol.js <uid> quitar
//
// Requiere: GOOGLE_APPLICATION_CREDENTIALS o serviceAccountKey en el mismo dir.
// ─────────────────────────────────────────────────────────────────────────────

const admin = require('firebase-admin')
const path  = require('path')

// ── Inicializar Admin SDK ─────────────────────────────────────────────────────
// Intenta con GOOGLE_APPLICATION_CREDENTIALS; si no, busca la service account
// en el mismo directorio que este script.
if (!admin.apps.length) {
  let credential
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = admin.credential.applicationDefault()
    } else {
      const keyPath = path.join(__dirname, 'serviceAccountKey.json')
      const key     = require(keyPath)
      credential    = admin.credential.cert(key)
    }
  } catch (e) {
    console.error('❌ No se pudo cargar la service account key:', e.message)
    console.error('   Coloca serviceAccountKey.json en scripts/ o define GOOGLE_APPLICATION_CREDENTIALS.')
    process.exit(1)
  }
  admin.initializeApp({ credential })
}

// ── Parsear argumentos ────────────────────────────────────────────────────────
const [,, uid, rol] = process.argv

if (!uid || !rol) {
  console.error('Uso: node scripts/asignar-rol.js <uid> <rol>')
  console.error('      rol: admin | secretaria | quitar')
  process.exit(1)
}

const ROLES_VALIDOS = ['admin', 'secretaria', 'quitar']
if (!ROLES_VALIDOS.includes(rol)) {
  console.error(`❌ Rol inválido: "${rol}". Válidos: ${ROLES_VALIDOS.join(', ')}`)
  process.exit(1)
}

// ── Ejecutar ──────────────────────────────────────────────────────────────────
async function main() {
  // Verificar que el usuario existe
  let userRecord
  try {
    userRecord = await admin.auth().getUser(uid)
  } catch {
    console.error(`❌ Usuario no encontrado: ${uid}`)
    process.exit(1)
  }

  const claimsActuales = userRecord.customClaims ?? {}
  const nuevosClaims   = rol === 'quitar'
    ? { ...claimsActuales, role: null }
    : { ...claimsActuales, role: rol }

  // Limpiar nulls
  Object.keys(nuevosClaims).forEach((k) => {
    if (nuevosClaims[k] === null) delete nuevosClaims[k]
  })

  await admin.auth().setCustomUserClaims(uid, nuevosClaims)

  const nombre = userRecord.displayName || userRecord.email || uid
  if (rol === 'quitar') {
    console.log(`✅ Rol eliminado para ${nombre} (${uid})`)
    console.log('   Claims actuales:', nuevosClaims)
  } else {
    console.log(`✅ Rol "${rol}" asignado a ${nombre} (${uid})`)
    console.log('   El usuario debe cerrar sesión y volver a ingresar para ver el nuevo rol.')
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
