/**
 * ─────────────────────────────────────────────────────────────────────────────
 * scripts/seedDemo.js
 * Pobla Firestore con datos realistas para la demo del director.
 *
 * ARQUITECTURA: La entidad central es el ESTUDIANTE.
 * - Auth email  = rut_estudiante@portal.cdt
 * - Doc ID      = Firebase Auth UID  (Estudiantes/{uid})
 * - Cuotas      = estudiante_id = uid
 *
 * Ejecutar con:
 *   npm run seed:demo
 * ─────────────────────────────────────────────────────────────────────────────
 */

const admin = require('firebase-admin')
const path  = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

// ─── Inicializar Admin SDK ────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type:           'service_account',
      project_id:     process.env.FIREBASE_ADMIN_PROJECT_ID,
      private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
      private_key:    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email:   process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      client_id:      process.env.FIREBASE_ADMIN_CLIENT_ID,
    }),
  })
}

const db       = admin.firestore()
const auth     = admin.auth()
const FieldValue = admin.firestore.FieldValue
const Timestamp  = admin.firestore.Timestamp

// ─── Constantes ───────────────────────────────────────────────────────────────
const ANIO         = 2026
const MESES        = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTO        = 87000
const EMAIL_DOMAIN = 'portal.cdt'
const PASSWORD_DEMO = 'Demo2026!'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizarRut(rut) {
  return rut.replace(/\./g, '').trim().toUpperCase()
}

function rutAEmail(rut) {
  return `${normalizarRut(rut).toLowerCase()}@${EMAIL_DOMAIN}`
}

function fechaVencimiento(mes, anio) {
  const mesIndex = MESES.indexOf(mes)
  const mesReal  = mesIndex + 2  // Marzo = índice 2 en Date (0-based)
  return Timestamp.fromDate(new Date(anio, mesReal, 10))
}

function fechaPagoAleatoria(mes) {
  const mesIndex = MESES.indexOf(mes)
  const mesReal  = mesIndex + 2
  const dia = Math.floor(Math.random() * 7) + 1
  return Timestamp.fromDate(new Date(ANIO, mesReal - 1, dia))
}

async function crearOActualizarUsuario(rut, password, nombre) {
  const email = rutAEmail(rut)
  try {
    const existing = await auth.getUserByEmail(email)
    console.log(`  [ya existe] RUT: ${rut} → uid: ${existing.uid}`)
    return existing.uid
  } catch {
    const user = await auth.createUser({ email, password, displayName: nombre })
    console.log(`  [creado]    RUT: ${rut} → uid: ${user.uid}`)
    return user.uid
  }
}

// ─── Datos de demo ────────────────────────────────────────────────────────────
//
// RUTs del ESTUDIANTE — todos tienen dígito verificador correcto.
// Verificados con el algoritmo módulo 11 estándar chileno.
//
//  20.123.456-5 ✓   21.234.567-9 ✓   19.765.432-5 ✓
//  20.876.543-4 ✓   18.987.654-8 ✓
//
const DEMO_ESTUDIANTES = [
  {
    // Buen historial: 8 pagadas, 2 pendientes
    rut:             '20.123.456-5',
    nombre:          'Sofía González Pérez',
    curso:           '3° Básico A',
    apoderado_nombre:'María Fernanda González Rojas',
    pagados:         ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre'],
    enRevision:      [],
    atrasados:       [],
    pendientes:      ['Noviembre','Diciembre'],
  },
  {
    // Comprobante en revisión + algunos atrasados
    rut:             '21.234.567-9',
    nombre:          'Diego Muñoz Torres',
    curso:           '6° Básico B',
    apoderado_nombre:'Carlos Andrés Muñoz Soto',
    pagados:         ['Marzo','Abril','Mayo','Junio'],
    enRevision:      ['Julio'],
    atrasados:       ['Agosto','Septiembre'],
    pendientes:      ['Octubre','Noviembre','Diciembre'],
  },
  {
    // Morosa: solo 1 pagada, 6 atrasadas
    rut:             '19.765.432-5',
    nombre:          'Valentina Herrera Soto',
    curso:           '1° Medio A',
    apoderado_nombre:'Ana Patricia Herrera Valdés',
    pagados:         ['Marzo'],
    enRevision:      [],
    atrasados:       ['Abril','Mayo','Junio','Julio','Agosto','Septiembre'],
    pendientes:      ['Octubre','Noviembre','Diciembre'],
  },
  {
    rut:             '20.876.543-4',
    nombre:          'Matías Vargas Quiroz',
    curso:           '4° Básico B',
    apoderado_nombre:'Roberto Ignacio Vargas Fuentes',
    pagados:         ['Marzo','Abril','Mayo'],
    enRevision:      ['Junio'],
    atrasados:       ['Julio'],
    pendientes:      ['Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    rut:             '18.987.654-8',
    nombre:          'Isabella Sánchez Leal',
    curso:           '2° Medio B',
    apoderado_nombre:'Patricia Loreto Sánchez Mora',
    pagados:         ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre'],
    enRevision:      ['Octubre'],
    atrasados:       [],
    pendientes:      ['Noviembre','Diciembre'],
  },
]

// ─── Admin de demo ────────────────────────────────────────────────────────────
const ADMIN_RUT      = '98.765.432-5'
const ADMIN_PASSWORD = 'Admin2026!'
const ADMIN_NOMBRE   = 'Secretaría - Finanzas'

// ─── Limpiar colecciones (excepto Admins) ─────────────────────────────────────
async function limpiarColeccion(nombre) {
  const snap = await db.collection(nombre).get()
  if (snap.empty) return
  const batch = db.batch()
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  console.log(`  [limpiado]  ${nombre} (${snap.size} docs)`)
}

async function limpiarCuentasAntiguas() {
  // Eliminar cuentas Auth de apoderados (arquitectura anterior)
  const rutsApoderados = [
    '12345678-5', '15678901-1', '9876543-3', '14222333-3', '11111111-1',
  ]
  // Eliminar también cuentas de estudiantes (en caso de re-seed)
  const rutsEstudiantes = DEMO_ESTUDIANTES.map(e =>
    normalizarRut(e.rut).toLowerCase()
  )

  for (const rut of [...rutsApoderados, ...rutsEstudiantes]) {
    const email = `${rut}@${EMAIL_DOMAIN}`
    try {
      const user = await auth.getUserByEmail(email)
      await auth.deleteUser(user.uid)
      console.log(`  [eliminado] Auth: ${email}`)
    } catch {
      // No existía
    }
  }
}

// ─── Seed principal ───────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱 Iniciando seed de datos de demo (arquitectura Estudiante)...\n')

  // 1. Limpiar datos anteriores
  console.log('🧹 Limpiando datos anteriores...')
  await limpiarCuentasAntiguas()
  await limpiarColeccion('Apoderados')
  await limpiarColeccion('Estudiantes')
  await limpiarColeccion('Cuotas')
  console.log('')

  // 2. Crear estudiantes y sus cuotas
  const batch = db.batch()
  let docsCreados = 0

  for (const est of DEMO_ESTUDIANTES) {
    console.log(`👤 Procesando estudiante: ${est.nombre} (${est.rut})`)

    // Auth account → email = rut_estudiante@portal.cdt
    const uid = await crearOActualizarUsuario(est.rut, PASSWORD_DEMO, est.nombre)

    // Estudiantes/{uid} — el uid ES el doc ID
    const estRef = db.collection('Estudiantes').doc(uid)
    batch.set(estRef, {
      nombre:            est.nombre,
      rut:               est.rut,
      curso:             est.curso,
      apoderado_nombre:  est.apoderado_nombre,
      apoderado_rut:     null,
      beca:              false,
      monto_cuota:       MONTO,
      requiere_cambio_clave: false, // demo — no forzar cambio de clave
      created_at:        FieldValue.serverTimestamp(),
    })
    docsCreados++

    // Cuotas — estudiante_id = uid
    for (const mes of MESES) {
      const cuotaRef = db.collection('Cuotas').doc()
      let estado, extra = {}

      if (est.pagados.includes(mes)) {
        estado = 'pagado'
        extra  = {
          fecha_pago:          fechaPagoAleatoria(mes),
          aprobado_por:        'demo_admin',
          aprobado_nombre:     'Administración',
          transbank_auth_code: `TBK${Math.floor(100000 + Math.random() * 900000)}`,
        }
      } else if (est.enRevision.includes(mes)) {
        estado = 'en_revision'
        extra  = {
          fecha_envio:     Timestamp.now(),
          comprobante_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Voucher.jpg/640px-Voucher.jpg',
        }
      } else if (est.atrasados.includes(mes)) {
        estado = 'atrasado'
      } else {
        estado = 'pendiente'
      }

      batch.set(cuotaRef, {
        estudiante_id:     uid,
        mes,
        anio:              ANIO,
        monto:             MONTO,
        estado,
        fecha_vencimiento: fechaVencimiento(mes, ANIO),
        created_at:        FieldValue.serverTimestamp(),
        ...extra,
      })
      docsCreados++
    }
  }

  await batch.commit()

  // 3. Crear admin
  console.log(`\n👤 Procesando admin: ${ADMIN_NOMBRE}`)
  const adminUid = await crearOActualizarUsuario(ADMIN_RUT, ADMIN_PASSWORD, ADMIN_NOMBRE)
  await db.collection('Admins').doc(adminUid).set({
    nombre:     ADMIN_NOMBRE,
    rut:        ADMIN_RUT,
    created_at: FieldValue.serverTimestamp(),
  })
  console.log(`  [admin doc] Admins/${adminUid}`)

  // ─── Resumen ─────────────────────────────────────────────────────────────────
  console.log(`\n✅ Seed completado. ${docsCreados} documentos en Firestore.\n`)
  console.log('─────────────────────────────────────────────────────────────────')
  console.log(`🔑 ADMIN   → RUT: ${ADMIN_RUT}  |  Clave: ${ADMIN_PASSWORD}`)
  console.log('─────────────────────────────────────────────────────────────────')
  console.log(`📋 ESTUDIANTES — clave demo: ${PASSWORD_DEMO}`)
  DEMO_ESTUDIANTES.forEach((e, i) => {
    const pag = e.pagados.length
    const atr = e.atrasados.length
    const rev = e.enRevision.length
    console.log(`  ${i+1}. ${e.rut.padEnd(15)} | ${e.nombre} (${e.curso})`)
    console.log(`     💚 ${pag} pagada(s)  🔴 ${atr} atrasada(s)  🟡 ${rev} en revisión\n`)
  })
  console.log('─────────────────────────────────────────────────────────────────\n')
}

seed()
  .catch((err) => { console.error('❌ Error en seed:', err); process.exit(1) })
  .finally(() => process.exit(0))
