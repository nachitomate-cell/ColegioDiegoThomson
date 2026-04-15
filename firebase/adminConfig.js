// ─────────────────────────────────────────────────────────────────────────────
// firebase/adminConfig.js
// Inicialización del Firebase Admin SDK para uso en API Routes de servidor.
// Usa el patrón singleton para evitar reinicializar en cada request.
// ─────────────────────────────────────────────────────────────────────────────
import admin from 'firebase-admin'

// Leer el serviceAccount desde variable de entorno (más seguro que importar el archivo)
// La private_key viene con \\n literales en env, hay que convertirlos a \n reales
function getServiceAccount() {
  return {
    type: 'service_account',
    project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
    private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  }
}

// Singleton: solo inicializa si no existe ya una instancia
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount()),
  })
}

export const adminDb   = admin.firestore()
export const adminAuth = admin.auth()
export default admin
