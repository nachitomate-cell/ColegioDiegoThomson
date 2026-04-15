/**
 * ─────────────────────────────────────────────────────────────────────────────
 * scripts/seedDemo.js
 * Pobla Firestore con datos realistas para la demo del director.
 * Las cuentas se crean con el formato interno de email: RUT@portal.cdt
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

const db   = admin.firestore()
const auth = admin.auth()
const FieldValue = admin.firestore.FieldValue
const Timestamp  = admin.firestore.Timestamp

// ─── Constantes ───────────────────────────────────────────────────────────────
const ANIO  = 2025
const MESES = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTO = 42000
const EMAIL_DOMAIN = 'portal.cdt'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normaliza RUT eliminando puntos y espacios, mantiene guión y mayúsculas */
function normalizarRut(rut) {
  return rut.replace(/\./g, '').trim().toUpperCase()
}

/** Convierte RUT a email interno para Firebase Auth (igual que el login) */
function rutAEmail(rut) {
  return `${normalizarRut(rut).toLowerCase()}@${EMAIL_DOMAIN}`
}

function fechaVencimiento(mes, anio) {
  const mesIndex = MESES.indexOf(mes)
  const mesReal  = mesIndex + 3 // Marzo=2 en Date (0-based)
  return Timestamp.fromDate(new Date(anio, mesReal, 10))
}

function fechaPagoAleatoria(mes) {
  const mesIndex = MESES.indexOf(mes)
  const mesReal  = mesIndex + 3
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
    console.log(`  [creado]    RUT: ${rut} → email: ${email} → uid: ${user.uid}`)
    return user.uid
  }
}

// ─── Datos de demo ────────────────────────────────────────────────────────────
// RUTs válidos con dígito verificador correcto para que pasen la validación del login
const DEMO_APODERADOS = [
  {
    nombre:    'María Fernanda González Rojas',
    rut:       '12.345.678-5',
    telefono:  '+56912345678',
    estudiante: { nombre: 'Sofía González Pérez', curso: '3° Básico A' },
    pagados:    ['Marzo','Abril','Mayo','Junio'],
    enRevision: ['Julio'],
    atrasados:  ['Agosto','Septiembre'],
    pendientes: ['Octubre','Noviembre','Diciembre'],
  },
  {
    nombre:    'Carlos Andrés Muñoz Soto',
    rut:       '15.678.901-1',
    telefono:  '+56987654321',
    estudiante: { nombre: 'Diego Muñoz Torres', curso: '6° Básico B' },
    pagados:    ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre'],
    enRevision: [],
    atrasados:  [],
    pendientes: ['Noviembre','Diciembre'],
  },
  {
    nombre:    'Ana Patricia Herrera Valdés',
    rut:       '9.876.543-3',
    telefono:  '+56956789012',
    estudiante: { nombre: 'Valentina Herrera Soto', curso: '1° Medio A' },
    pagados:    ['Marzo'],
    enRevision: [],
    atrasados:  ['Abril','Mayo','Junio','Julio','Agosto','Septiembre'],
    pendientes: ['Octubre','Noviembre','Diciembre'],
  },
  {
    nombre:    'Roberto Ignacio Vargas Fuentes',
    rut:       '14.222.333-3',
    telefono:  '+56945678901',
    estudiante: { nombre: 'Matías Vargas Quiroz', curso: '4° Básico B' },
    pagados:    ['Marzo','Abril','Mayo'],
    enRevision: ['Junio'],
    atrasados:  ['Julio'],
    pendientes: ['Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    nombre:    'Patricia Loreto Sánchez Mora',
    rut:       '11.111.111-1',
    telefono:  '+56934567890',
    estudiante: { nombre: 'Isabella Sánchez Leal', curso: '2° Medio B' },
    pagados:    ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre'],
    enRevision: ['Octubre'],
    atrasados:  [],
    pendientes: ['Noviembre','Diciembre'],
  },
]

const PASSWORD_DEMO  = 'Demo2025!'

// ─── Admin de demo ────────────────────────────────────────────────────────────
const ADMIN_RUT      = '98.765.432-5'
const ADMIN_PASSWORD = 'Admin2025!'
const ADMIN_NOMBRE   = 'Secretaría - Finanzas'

// ─── Limpiar datos de demo previos ────────────────────────────────────────────
async function limpiarDemoAnterior() {
  console.log('\n🧹 Limpiando datos de demo anteriores...')
  const emails = [
    'demo.apoderado1@cdt.cl',
    'demo.apoderado2@cdt.cl',
    'demo.apoderado3@cdt.cl',
    'demo.apoderado4@cdt.cl',
    'demo.apoderado5@cdt.cl',
  ]
  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email)
      await auth.deleteUser(user.uid)
      console.log(`  [eliminado] ${email}`)
    } catch {
      // No existía, ignorar
    }
  }
}

// ─── Seed principal ───────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱 Iniciando seed de datos de demo...')

  await limpiarDemoAnterior()
  console.log('')

  const batch = db.batch()
  let docsCreados = 0

  for (const apo of DEMO_APODERADOS) {
    console.log(`👤 Procesando: ${apo.nombre}`)

    // 1. Crear usuario con email = RUT@portal.cdt (igual a como funciona el login)
    const uid = await crearOActualizarUsuario(apo.rut, PASSWORD_DEMO, apo.nombre)

    // 2. Crear estudiante
    const estRef = db.collection('Estudiantes').doc()
    batch.set(estRef, {
      nombre:        apo.estudiante.nombre,
      curso:         apo.estudiante.curso,
      apoderado_uid: uid,
      created_at:    FieldValue.serverTimestamp(),
    })
    docsCreados++

    // 3. Crear apoderado (doc ID = uid del usuario)
    const apoRef = db.collection('Apoderados').doc(uid)
    batch.set(apoRef, {
      nombre:          apo.nombre,
      rut:             apo.rut,
      telefono:        apo.telefono,
      email:           rutAEmail(apo.rut), // referencia interna
      estudiantes_ids: [estRef.id],
      created_at:      FieldValue.serverTimestamp(),
    })
    docsCreados++

    // 4. Crear cuotas
    for (const mes of MESES) {
      const cuotaRef = db.collection('Cuotas').doc()
      let estado, extra = {}

      if (apo.pagados.includes(mes)) {
        estado = 'pagado'
        extra  = {
          fecha_pago:          fechaPagoAleatoria(mes),
          aprobado_por:        'demo_admin',
          aprobado_nombre:     'Administración',
          transbank_auth_code: `TBK${Math.floor(100000 + Math.random() * 900000)}`,
        }
      } else if (apo.enRevision.includes(mes)) {
        estado = 'en_revision'
        extra  = {
          fecha_envio:     Timestamp.now(),
          comprobante_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Voucher.jpg/640px-Voucher.jpg',
        }
      } else if (apo.atrasados.includes(mes)) {
        estado = 'atrasado'
      } else {
        estado = 'pendiente'
      }

      batch.set(cuotaRef, {
        estudiante_id:     estRef.id,
        apoderado_uid:     uid,
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

  // ─── Crear admin ─────────────────────────────────────────────────────────────
  console.log(`\n👤 Procesando admin: ${ADMIN_NOMBRE}`)
  const adminUid = await crearOActualizarUsuario(ADMIN_RUT, ADMIN_PASSWORD, ADMIN_NOMBRE)
  await db.collection('Admins').doc(adminUid).set({
    nombre:     ADMIN_NOMBRE,
    rut:        ADMIN_RUT,
    created_at: FieldValue.serverTimestamp(),
  })
  console.log(`  [admin doc] Admins/${adminUid}`)

  console.log(`\n✅ Seed completado. ${docsCreados} documentos en Firestore.`)
  console.log(`\n🔑 ADMIN — RUT: ${ADMIN_RUT} · Clave: ${ADMIN_PASSWORD}`)
  console.log('\n📋 APODERADOS — clave: Demo2025!')
  console.log('─────────────────────────────────────────────────────────────────')
  DEMO_APODERADOS.forEach((a, i) => {
    const pag = a.pagados.length
    const atr = a.atrasados.length
    const rev = a.enRevision.length
    console.log(`  ${i+1}. RUT: ${a.rut.padEnd(15)} | ${a.nombre}`)
    console.log(`     💚 ${pag} pagada(s) · 🔴 ${atr} atrasada(s) · 🟡 ${rev} en revisión\n`)
  })
  console.log('─────────────────────────────────────────────────────────────────\n')
}

seed()
  .catch((err) => { console.error('❌ Error en seed:', err); process.exit(1) })
  .finally(() => process.exit(0))
