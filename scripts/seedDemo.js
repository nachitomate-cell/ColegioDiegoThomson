/**
 * ─────────────────────────────────────────────────────────────────────────────
 * scripts/seedDemo.js
 * Pobla Firestore con 15 estudiantes ficticios para demo / desarrollo.
 *
 * ARQUITECTURA: La entidad central es el ESTUDIANTE.
 *   Auth email  = {rut_limpio}@colegiodiegothompson.cl
 *   Doc ID      = Firebase Auth UID  →  Estudiantes/{uid}
 *   Cuotas      = estudiante_id = uid
 *
 * Campos espejados con migracion.js:
 *   nombre, rut, rut_limpio, curso, apoderado_nombre, apoderado_email,
 *   monto_cuota, es_becado, requiere_cambio_clave, created_at
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

const db         = admin.firestore()
const auth       = admin.auth()
const FieldValue = admin.firestore.FieldValue
const Timestamp  = admin.firestore.Timestamp

// ─── Constantes ───────────────────────────────────────────────────────────────
const ANIO          = 2026
const MESES         = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTO_NORMAL  = 97500
const EMAIL_DOMAIN  = 'colegiodiegothompson.cl'
const PASSWORD_DEMO = 'Demo2026!'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "22.333.444-5" → "223334445"  (igual que migracion.js) */
function limpiarRut(rut) {
  return String(rut).replace(/[.\-\s]/g, '').trim()
}

function rutAEmail(rut) {
  return `${limpiarRut(rut).toLowerCase()}@${EMAIL_DOMAIN}`
}

function fechaVencimiento(mes) {
  const mesIndex = MESES.indexOf(mes)
  const mesReal  = mesIndex + 2   // Marzo = índice 2 (0-based)
  return Timestamp.fromDate(new Date(ANIO, mesReal, 10))
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
    await auth.updateUser(existing.uid, { password, displayName: nombre })
    console.log(`  [actualizado] ${rut} → uid: ${existing.uid}`)
    return existing.uid
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      const user = await auth.createUser({ email, password, displayName: nombre })
      console.log(`  [creado]      ${rut} → uid: ${user.uid}`)
      return user.uid
    }
    throw e
  }
}

// ─── 15 Estudiantes ficticios ─────────────────────────────────────────────────
//
// RUTs verificados con el algoritmo módulo-11 estándar chileno:
//   15.123.456-9 ✓   16.234.567-2 ✓   17.345.678-6 ✓   18.456.789-K ✓
//   19.567.890-1 ✓   20.678.901-8 ✓   21.789.012-8 ✓   22.890.123-7 ✓
//   14.901.234-6 ✓   15.012.345-3 ✓   16.123.456-7 ✓   17.234.567-0 ✓
//   18.345.678-4 ✓   19.456.789-8 ✓   20.567.890-5 ✓
//
const DEMO_ESTUDIANTES = [
  {
    // 1 — Buen pagador: ambas cuotas vencidas pagadas
    rut:              '15.123.456-9',
    nombre:           'Sofía González Pérez',
    curso:            '3° Básico A',
    apoderado_nombre: 'María Fernanda González Rojas',
    apoderado_email:  'maria.gonzalez.r@gmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          ['Marzo','Abril'],
    enRevision:       [],
    atrasados:        [],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 2 — Un mes atrasado
    rut:              '16.234.567-2',
    nombre:           'Diego Muñoz Torres',
    curso:            '6° Básico B',
    apoderado_nombre: 'Carlos Andrés Muñoz Soto',
    apoderado_email:  'carlos.munoz.s@gmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          ['Marzo'],
    enRevision:       [],
    atrasados:        ['Abril'],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 3 — Morosa grave: nada pagado
    rut:              '17.345.678-6',
    nombre:           'Valentina Herrera Soto',
    curso:            '8° Básico A',
    apoderado_nombre: 'Ana Patricia Herrera Valdés',
    apoderado_email:  'ana.herrera.v@gmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          [],
    enRevision:       [],
    atrasados:        ['Marzo','Abril'],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 4 — Comprobante en revisión
    rut:              '18.456.789-K',
    nombre:           'Matías Vargas Quiroz',
    curso:            '4° Básico B',
    apoderado_nombre: 'Roberto Ignacio Vargas Fuentes',
    apoderado_email:  'roberto.vargas.f@gmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          ['Marzo'],
    enRevision:       ['Abril'],
    atrasados:        [],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 5 — Becada, al día
    rut:              '19.567.890-1',
    nombre:           'Isabella Sánchez Leal',
    curso:            '7° Básico A',
    apoderado_nombre: 'Patricia Loreto Sánchez Mora',
    apoderado_email:  'patricia.sanchez.m@outlook.com',
    monto_cuota:      60000,
    es_becado:        true,
    pagados:          ['Marzo','Abril'],
    enRevision:       [],
    atrasados:        [],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 6 — Kinder, sin pagos aún (recién matriculado)
    rut:              '20.678.901-8',
    nombre:           'Nicolás Rojas Fuentes',
    curso:            'Kinder A',
    apoderado_nombre: 'Andrea Carolina Rojas Castro',
    apoderado_email:  'andrea.rojas.c@gmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          [],
    enRevision:       [],
    atrasados:        ['Marzo','Abril'],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 7 — 1° Básico, un mes pagado un mes atrasado
    rut:              '21.789.012-8',
    nombre:           'Camila Torres Vega',
    curso:            '1° Básico A',
    apoderado_nombre: 'Luis Alberto Torres Vega',
    apoderado_email:  'luis.torres.v@yahoo.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          ['Marzo'],
    enRevision:       [],
    atrasados:        ['Abril'],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 8 — Comprobante abril en revisión
    rut:              '22.890.123-7',
    nombre:           'Sebastián Morales Castro',
    curso:            '7° Básico A',
    apoderado_nombre: 'Claudia Andrea Morales Castro',
    apoderado_email:  'claudia.morales.c@gmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          ['Marzo'],
    enRevision:       ['Abril'],
    atrasados:        [],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 9 — 8° Básico, critico: todo atrasado
    rut:              '14.901.234-6',
    nombre:           'Fernanda López Díaz',
    curso:            '8° Básico B',
    apoderado_nombre: 'Jorge Enrique López Díaz',
    apoderado_email:  'jorge.lopez.d@gmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          [],
    enRevision:       [],
    atrasados:        ['Marzo','Abril'],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 10 — Becado parcial, excelente pagador
    rut:              '15.012.345-3',
    nombre:           'Andrés Peña Salazar',
    curso:            '2° Básico A',
    apoderado_nombre: 'Elena Beatriz Peña Salazar',
    apoderado_email:  'elena.pena.s@gmail.com',
    monto_cuota:      45000,
    es_becado:        true,
    pagados:          ['Marzo','Abril'],
    enRevision:       [],
    atrasados:        [],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 11 — 5° Básico, solo marzo pagado
    rut:              '16.123.456-7',
    nombre:           'Catalina Ríos Espinoza',
    curso:            '5° Básico A',
    apoderado_nombre: 'Marco Antonio Ríos Espinoza',
    apoderado_email:  'marco.rios.e@hotmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          ['Marzo'],
    enRevision:       [],
    atrasados:        ['Abril'],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 12 — 8° Básico, muy atrasado
    rut:              '17.234.567-0',
    nombre:           'Joaquín Flores Medina',
    curso:            '8° Básico B',
    apoderado_nombre: 'Sonia Inés Flores Medina',
    apoderado_email:  'sonia.flores.m@gmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          [],
    enRevision:       [],
    atrasados:        ['Marzo','Abril'],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 13 — Kinder, al día
    rut:              '18.345.678-4',
    nombre:           'Renata Guzmán Pinto',
    curso:            'Kinder A',
    apoderado_nombre: 'Miguel Ángel Guzmán Pinto',
    apoderado_email:  'miguel.guzman.p@gmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          ['Marzo','Abril'],
    enRevision:       [],
    atrasados:        [],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 14 — 6° Básico, becado parcial, un mes atrasado
    rut:              '19.456.789-8',
    nombre:           'Felipe Araya Cárdenas',
    curso:            '6° Básico A',
    apoderado_nombre: 'Carmen Gloria Araya Cárdenas',
    apoderado_email:  'carmen.araya.c@gmail.com',
    monto_cuota:      65000,
    es_becado:        true,
    pagados:          ['Marzo'],
    enRevision:       [],
    atrasados:        ['Abril'],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // 15 — 6° Básico A, comprobante en revisión
    rut:              '20.567.890-5',
    nombre:           'Antonia Castro Reyes',
    curso:            '6° Básico A',
    apoderado_nombre: 'Francisco Javier Castro Reyes',
    apoderado_email:  'francisco.castro.r@gmail.com',
    monto_cuota:      MONTO_NORMAL,
    es_becado:        false,
    pagados:          ['Marzo'],
    enRevision:       ['Abril'],
    atrasados:        [],
    pendientes:       ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
]

// ─── Admin de demo ────────────────────────────────────────────────────────────
const ADMIN_RUT      = '98.765.432-5'
const ADMIN_PASSWORD = 'Admin2026!'
const ADMIN_NOMBRE   = 'Secretaría - Finanzas'

// ─── Helpers de limpieza ──────────────────────────────────────────────────────
async function limpiarColeccion(nombre) {
  const snap = await db.collection(nombre).get()
  if (snap.empty) return
  // Firestore limita a 500 ops por batch; dividimos si es necesario
  const chunks = []
  for (let i = 0; i < snap.docs.length; i += 490) chunks.push(snap.docs.slice(i, i + 490))
  for (const chunk of chunks) {
    const batch = db.batch()
    chunk.forEach(d => batch.delete(d.ref))
    await batch.commit()
  }
  console.log(`  [limpiado]  ${nombre} (${snap.size} docs)`)
}

async function limpiarCuentasAuth() {
  // Eliminar todos los usuarios del dominio interno para evitar UIDs huérfanos
  const emailsAEliminar = DEMO_ESTUDIANTES.map(e => rutAEmail(e.rut))
  emailsAEliminar.push(rutAEmail(ADMIN_RUT))

  for (const email of emailsAEliminar) {
    try {
      const user = await auth.getUserByEmail(email)
      await auth.deleteUser(user.uid)
      console.log(`  [eliminado] Auth: ${email}`)
    } catch {
      // No existía — ignorar
    }
  }
}

// ─── Seed principal ───────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱 Iniciando seed — 15 estudiantes ficticios (Colegio Diego Thomson)\n')

  // 1. Limpiar todo
  console.log('🧹 Limpiando datos anteriores...')
  await limpiarCuentasAuth()
  await limpiarColeccion('Estudiantes')
  await limpiarColeccion('Cuotas')
  console.log('')

  // 2. Crear estudiantes y cuotas
  const batch      = db.batch()
  let docsCreados  = 0

  for (const est of DEMO_ESTUDIANTES) {
    console.log(`👤 ${est.nombre}  (${est.rut})  →  ${est.curso}`)

    const uid      = await crearOActualizarUsuario(est.rut, PASSWORD_DEMO, est.nombre)
    const rutLimpio = limpiarRut(est.rut)

    // ── Estudiantes/{uid} ──────────────────────────────────────────────────────
    const estRef = db.collection('Estudiantes').doc(uid)
    batch.set(estRef, {
      nombre:                est.nombre,
      rut:                   est.rut,
      rut_limpio:            rutLimpio,
      curso:                 est.curso,
      apoderado_nombre:      est.apoderado_nombre,
      apoderado_email:       est.apoderado_email,
      monto_cuota:           est.monto_cuota,
      es_becado:             est.es_becado,
      requiere_cambio_clave: false,        // demo: sin forzar cambio de clave
      created_at:            FieldValue.serverTimestamp(),
    })
    docsCreados++

    // ── Cuotas ─────────────────────────────────────────────────────────────────
    for (const mes of MESES) {
      const cuotaRef = db.collection('Cuotas').doc()
      let estado = 'pendiente'
      let extra  = {}

      if (est.pagados.includes(mes)) {
        estado = 'pagado'
        extra  = {
          fecha_pago:          fechaPagoAleatoria(mes),
          aprobado_por:        'demo_admin',
          aprobado_nombre:     'Secretaría - Finanzas',
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
      }

      batch.set(cuotaRef, {
        estudiante_id:     uid,
        mes,
        anio:              ANIO,
        monto:             est.monto_cuota,
        estado,
        fecha_vencimiento: fechaVencimiento(mes),
        created_at:        FieldValue.serverTimestamp(),
        ...extra,
      })
      docsCreados++
    }
  }

  await batch.commit()

  // 3. Admin
  console.log(`\n👤 Procesando admin: ${ADMIN_NOMBRE}`)
  const adminUid = await crearOActualizarUsuario(ADMIN_RUT, ADMIN_PASSWORD, ADMIN_NOMBRE)
  await db.collection('Admins').doc(adminUid).set({
    nombre:     ADMIN_NOMBRE,
    rut:        ADMIN_RUT,
    created_at: FieldValue.serverTimestamp(),
  })
  console.log(`  [admin doc] Admins/${adminUid}`)

  // ─── Resumen ──────────────────────────────────────────────────────────────────
  console.log(`\n✅ Seed completado: ${DEMO_ESTUDIANTES.length} estudiantes, ${docsCreados} documentos Firestore.\n`)
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log(`🔑 ADMIN     RUT: ${ADMIN_RUT}  |  Clave: ${ADMIN_PASSWORD}`)
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log(`📋 ESTUDIANTES — clave única para todos: ${PASSWORD_DEMO}\n`)

  DEMO_ESTUDIANTES.forEach((e, i) => {
    const pag  = e.pagados.length
    const atr  = e.atrasados.length
    const rev  = e.enRevision.length
    const beca = e.es_becado ? ` 🎓 BECADO ($${e.monto_cuota.toLocaleString('es-CL')})` : ''
    console.log(`  ${String(i+1).padStart(2)}. ${e.rut.padEnd(15)}  ${e.nombre}  (${e.curso})${beca}`)
    console.log(`      ✉  ${e.apoderado_email}`)
    console.log(`      💚 ${pag} pagada(s)   🔴 ${atr} atrasada(s)   🟡 ${rev} en revisión\n`)
  })
  console.log('══════════════════════════════════════════════════════════════════════\n')
}

seed()
  .catch((err) => { console.error('❌ Error en seed:', err); process.exit(1) })
  .finally(() => process.exit(0))
