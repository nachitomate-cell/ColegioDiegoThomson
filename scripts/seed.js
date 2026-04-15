// ─────────────────────────────────────────────────────────────────────────────
// scripts/seed.js
// Crea datos de prueba en Firebase Auth + Firestore.
//
// ANTES DE EJECUTAR:
//   1. Descarga serviceAccountKey.json desde:
//      Firebase Console → Project Settings → Service Accounts →
//      "Generate new private key" → guarda como scripts/serviceAccountKey.json
//
//   2. Edita APODERADO_RUT y APODERADO_PASSWORD si lo deseas (líneas 22-23).
//
//   3. Ejecuta: npm run seed
// ─────────────────────────────────────────────────────────────────────────────

const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json')

// ── CONFIGURACIÓN DEL APODERADO DE PRUEBA ─────────────────────────────────────
const APODERADO_RUT        = '12345678-5'   // RUT sin puntos, con guión — reemplaza con el RUT real
const APODERADO_PASSWORD   = 'Colegio2025!' // Contraseña inicial (cámbiala en producción)
const APODERADO_NOMBRE     = 'Carlos Fuentes Morales'
const APODERADO_EMAIL_REAL = 'c.fuentes@gmail.com' // Solo referencia, no se usa para login

// ── CONFIGURACIÓN DEL USUARIO ADMINISTRADOR ────────────────────────────────────
// Este usuario podrá acceder a /admin. El RUT se convierte en email igual que los apoderados.
const ADMIN_RUT      = '98765432-5'     // RUT del admin — reemplaza con el RUT real del funcionario
const ADMIN_PASSWORD = 'Admin2025!'
const ADMIN_NOMBRE   = 'Secretaría Finanzas'

// Dominio interno para Firebase Auth — debe coincidir con app/login/page.jsx
const EMAIL_DOMAIN = 'portal.cdt'

// ─────────────────────────────────────────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

/** Normaliza RUT: elimina puntos, mayúsculas → "12.345.678-9" → "12345678-9" */
function normalizarRut(rut) {
  return rut.replace(/\./g, '').trim().toUpperCase()
}

/** Valida el dígito verificador chileno */
function validarRut(rut) {
  const clean  = normalizarRut(rut)
  const guion  = clean.lastIndexOf('-')
  if (guion <= 0) return false

  const cuerpo = clean.slice(0, guion)
  const dv     = clean.slice(guion + 1)

  if (!/^\d+$/.test(cuerpo)) return false
  if (!/^[\dKk]$/.test(dv))  return false

  let suma     = 0
  let multiplo = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma     += parseInt(cuerpo[i]) * multiplo
    multiplo  = multiplo === 7 ? 2 : multiplo + 1
  }

  const resto      = suma % 11
  const dvEsperado = resto === 0 ? '0' : resto === 1 ? 'K' : String(11 - resto)
  return dv.toUpperCase() === dvEsperado
}

/** Deriva email interno de Firebase Auth desde RUT */
function rutAEmail(rut) {
  return `${normalizarRut(rut).toLowerCase()}@${EMAIL_DOMAIN}`
}

// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  // ── Validar RUTs antes de hacer nada ──────────────────────────────────────
  if (!validarRut(APODERADO_RUT)) {
    console.error(`ERROR: El RUT de apoderado "${APODERADO_RUT}" tiene un dígito verificador inválido.`)
    process.exit(1)
  }
  if (!validarRut(ADMIN_RUT)) {
    console.error(`ERROR: El RUT de admin "${ADMIN_RUT}" tiene un dígito verificador inválido.`)
    process.exit(1)
  }

  const emailInterno = rutAEmail(APODERADO_RUT)
  console.log('Iniciando seed...')
  console.log(`  RUT:   ${APODERADO_RUT}`)
  console.log(`  Email: ${emailInterno}`)

  // ── 1. Crear usuario en Firebase Auth ─────────────────────────────────────
  // Si ya existe, lo recuperamos en lugar de fallar.
  let uid
  try {
    const userRecord = await admin.auth().createUser({
      email:         emailInterno,
      password:      APODERADO_PASSWORD,
      displayName:   APODERADO_NOMBRE,
      emailVerified: true,
    })
    uid = userRecord.uid
    console.log(`  Usuario Auth creado → UID: ${uid}`)
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await admin.auth().getUserByEmail(emailInterno)
      uid = existing.uid
      console.log(`  Usuario Auth ya existía → UID: ${uid}`)
    } else {
      throw err
    }
  }

  // ── 2. Crear documentos de estudiantes ────────────────────────────────────
  const sofiaRef = db.collection('Estudiantes').doc()
  const mateoRef = db.collection('Estudiantes').doc()

  await sofiaRef.set({
    nombre:        'Sofía Fuentes',
    curso:         '7° Básico A',
    apoderado_uid: uid,
    created_at:    admin.firestore.FieldValue.serverTimestamp(),
  })
  console.log(`  Estudiante: Sofía Fuentes → ${sofiaRef.id}`)

  await mateoRef.set({
    nombre:        'Mateo Fuentes',
    curso:         '4° Básico B',
    apoderado_uid: uid,
    created_at:    admin.firestore.FieldValue.serverTimestamp(),
  })
  console.log(`  Estudiante: Mateo Fuentes → ${mateoRef.id}`)

  // ── 3. Crear documento del apoderado (ID = UID de Firebase Auth) ───────────
  await db.collection('Apoderados').doc(uid).set({
    nombre:          APODERADO_NOMBRE,
    email:           APODERADO_EMAIL_REAL,
    rut:             normalizarRut(APODERADO_RUT),
    estudiantes_ids: [sofiaRef.id, mateoRef.id],
    created_at:      admin.firestore.FieldValue.serverTimestamp(),
  })
  console.log(`  Apoderado Firestore creado → UID: ${uid}`)

  // ── 4. Crear cuotas 2025 para Sofía ───────────────────────────────────────
  const meses   = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const estados = ['pagado','pagado','en_revision','pendiente','pendiente','pendiente','pendiente','pendiente','atrasado','pendiente']
  const batch   = db.batch()

  meses.forEach((mes, i) => {
    const cuotaRef = db.collection('Cuotas').doc()
    batch.set(cuotaRef, {
      estudiante_id:     sofiaRef.id,
      mes,
      anio:              2025,
      monto:             85000,
      fecha_vencimiento: admin.firestore.Timestamp.fromDate(
        new Date(`2025-${String(i + 3).padStart(2, '0')}-10`)
      ),
      estado:            estados[i],
      comprobante_url:   null,
      fecha_pago:        null,
      fecha_envio:       null,
      created_at:        admin.firestore.FieldValue.serverTimestamp(),
    })
  })

  await batch.commit()
  console.log('  10 cuotas creadas para Sofía (Marzo–Diciembre 2025)')

  // ── 5. Crear usuario administrador en Firebase Auth ────────────────────────
  const adminEmail = rutAEmail(ADMIN_RUT)
  let adminUid
  try {
    const adminRecord = await admin.auth().createUser({
      email:         adminEmail,
      password:      ADMIN_PASSWORD,
      displayName:   ADMIN_NOMBRE,
      emailVerified: true,
    })
    adminUid = adminRecord.uid
    console.log(`  Usuario Admin Auth creado → UID: ${adminUid}`)
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await admin.auth().getUserByEmail(adminEmail)
      adminUid = existing.uid
      console.log(`  Usuario Admin ya existía → UID: ${adminUid}`)
    } else {
      throw err
    }
  }

  // ── 6. Crear documento en colección Admins ────────────────────────────────
  // Las reglas de Firestore verifican que exista Admins/{uid} para dar acceso admin.
  await db.collection('Admins').doc(adminUid).set({
    nombre:     ADMIN_NOMBRE,
    rut:        normalizarRut(ADMIN_RUT),
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  })
  console.log(`  Documento Admins/${adminUid} creado`)

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\nSeed completado exitosamente.')
  console.log({
    apoderado: { rut: APODERADO_RUT, email: emailInterno, password: APODERADO_PASSWORD, uid },
    adminUser: { rut: ADMIN_RUT,     email: adminEmail,   password: ADMIN_PASSWORD,     uid: adminUid },
    sofiaId:   sofiaRef.id,
    mateoId:   mateoRef.id,
  })

  process.exit(0)
}

seed().catch((err) => {
  console.error('ERROR en seed:', err.message)
  process.exit(1)
})
