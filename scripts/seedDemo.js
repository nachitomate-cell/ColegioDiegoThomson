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
 *   nombre, rut, rut_limpio, curso,
 *   apoderado_nombre, apoderado_email, apoderado_rut, apoderado_rut_limpio,
 *   monto_cuota, es_becado, requiere_cambio_clave, created_at
 *
 * Estructura de familias:
 *   Familia A — Jorge García Muñoz (padre de 2 hermanos)
 *   Familia B — Ricardo Pérez Soto (padre de 3 hermanos)
 *   Familia C — Carmen Lagos Moreno (madre de 2 mellizos)
 *   8 estudiantes únicos (un solo hijo por apoderado)
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

/**
 * Calcula el dígito verificador chileno (módulo 11) para un número de RUT.
 * @param {number|string} num  — solo los dígitos, sin DV ni puntos
 * @returns {string}  '0'..'9' | 'K'
 */
function calcularDV(num) {
  const digits  = String(num).split('').reverse()
  const factors = [2, 3, 4, 5, 6, 7]
  const sum     = digits.reduce((acc, d, i) => acc + Number(d) * factors[i % 6], 0)
  const r       = 11 - (sum % 11)
  if (r === 11) return '0'
  if (r === 10) return 'K'
  return String(r)
}

/**
 * Formatea un número de RUT como "12.345.678-5".
 * @param {number|string} num
 */
function formatRut(num) {
  const s      = String(num)
  const dv     = calcularDV(num)
  const parts  = []
  let i = s.length
  while (i > 0) {
    parts.unshift(s.slice(Math.max(0, i - 3), i))
    i -= 3
  }
  return `${parts.join('.')}-${dv}`
}

/**
 * Quita puntos, guión y espacios; normaliza a mayúsculas.
 * Igual que migracion.js + verificarOwnership.js.
 * Ejemplo: "12.345.678-K" → "12345678K"
 */
function limpiarRut(rut) {
  return String(rut).replace(/[.\-\s]/g, '').trim().toUpperCase()
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
  const dia      = Math.floor(Math.random() * 7) + 1
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

// ─── Apoderados ───────────────────────────────────────────────────────────────
// rutNum: solo los dígitos, sin DV. El DV se calcula con calcularDV().
// RUTs generados con módulo-11 verificado.
//
//  12345678 → DV 5 → 12.345.678-5  (Jorge García Muñoz)
//  11222333 → DV 9 → 11.222.333-9  (Ricardo Pérez Soto)
//  13456789 → DV 9 → 13.456.789-9  (Carmen Lagos Moreno)
//  14567890 → DV 0 → 14.567.890-0  (Marco Ríos Espinoza)
//  15678901 → DV 1 → 15.678.901-1  (Sonia Flores Medina)
//  16789012 → DV 1 → 16.789.012-1  (Miguel Guzmán Pinto)
//   7654321 → DV 6 →  7.654.321-6  (Luis Torres Vega)
//   9876543 → DV 3 →  9.876.543-3  (Jorge López Díaz)
//  11345678 → DV 7 → 11.345.678-7  (Elena Peña Salazar)
//  10123456 → DV 8 → 10.123.456-8  (Carmen Araya Cárdenas)
//   8765432 → DV K →  8.765.432-K  (Francisco Castro Reyes)

const _APO_RAW = {
  // ── Familias ──────────────────────────────────────────────────────────────
  familiaA: { rutNum: 12345678, nombre: 'Jorge García Muñoz',           email: 'jorge.garcia.m@gmail.com' },
  familiaB: { rutNum: 11222333, nombre: 'Ricardo Pérez Soto',            email: 'ricardo.perez.s@gmail.com' },
  familiaC: { rutNum: 13456789, nombre: 'Carmen Lagos Moreno',           email: 'carmen.lagos.m@gmail.com' },
  // ── Solos ─────────────────────────────────────────────────────────────────
  luisTorres:      { rutNum:  7654321, nombre: 'Luis Alberto Torres Vega',     email: 'luis.torres.v@yahoo.com' },
  jorgeLopez:      { rutNum:  9876543, nombre: 'Jorge Enrique López Díaz',     email: 'jorge.lopez.d@gmail.com' },
  elenaPena:       { rutNum: 11345678, nombre: 'Elena Beatriz Peña Salazar',   email: 'elena.pena.s@gmail.com' },
  marcoRios:       { rutNum: 14567890, nombre: 'Marco Antonio Ríos Espinoza',  email: 'marco.rios.e@hotmail.com' },
  soniaFlores:     { rutNum: 15678901, nombre: 'Sonia Inés Flores Medina',     email: 'sonia.flores.m@gmail.com' },
  miguelGuzman:    { rutNum: 16789012, nombre: 'Miguel Ángel Guzmán Pinto',    email: 'miguel.guzman.p@gmail.com' },
  carmenAraya:     { rutNum: 10123456, nombre: 'Carmen Gloria Araya Cárdenas', email: 'carmen.araya.c@gmail.com' },
  franciscoCastro: { rutNum:  8765432, nombre: 'Francisco Javier Castro Reyes',email: 'francisco.castro.r@gmail.com' },
}

// Pre-calcular rut y rut_limpio para cada apoderado
const APODERADOS = Object.fromEntries(
  Object.entries(_APO_RAW).map(([k, a]) => {
    const rut     = formatRut(a.rutNum)
    return [k, { ...a, rut, rut_limpio: limpiarRut(rut) }]
  })
)

// ─── 15 Estudiantes ficticios ─────────────────────────────────────────────────
//
// Estructura:
//   Familia A  → 2 hermanos  (García Soto)
//   Familia B  → 3 hermanos  (Pérez Muñoz)
//   Familia C  → 2 mellizos  (Rojas Lagos)
//   8 solos    → un hijo por apoderado
//
// RUTs de estudiantes verificados con módulo-11:
//   15.123.456-9   16.234.567-2   17.345.678-6   18.456.789-K   19.567.890-1
//   20.678.901-8   21.789.012-8   22.890.123-7   14.901.234-6   15.012.345-3
//   16.123.456-7   17.234.567-0   18.345.678-4   19.456.789-8   20.567.890-5
//
const DEMO_ESTUDIANTES = [

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILIA A — apoderado: Jorge García Muñoz (12.345.678-5)
  // 2 hermanos: María José y Tomás García Soto
  // ══════════════════════════════════════════════════════════════════════════
  {
    // A1 — Buen pagador
    rut:       '15.123.456-9',
    nombre:    'María José García Soto',
    curso:     '3° Básico A',
    apoderado: APODERADOS.familiaA,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     ['Marzo', 'Abril'],
    enRevision:  [],
    atrasados:   [],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // A2 — Un mes atrasado
    rut:       '16.234.567-2',
    nombre:    'Tomás García Soto',
    curso:     '6° Básico B',
    apoderado: APODERADOS.familiaA,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     ['Marzo'],
    enRevision:  [],
    atrasados:   ['Abril'],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILIA B — apoderado: Ricardo Pérez Soto (11.222.333-9)
  // 3 hermanos: Sofía, Matías y Elena Pérez Muñoz
  // ══════════════════════════════════════════════════════════════════════════
  {
    // B1 — Morosa grave: nada pagado
    rut:       '17.345.678-6',
    nombre:    'Sofía Pérez Muñoz',
    curso:     '8° Básico A',
    apoderado: APODERADOS.familiaB,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     [],
    enRevision:  [],
    atrasados:   ['Marzo', 'Abril'],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // B2 — Comprobante en revisión
    rut:       '18.456.789-K',
    nombre:    'Matías Pérez Muñoz',
    curso:     '4° Básico B',
    apoderado: APODERADOS.familiaB,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     ['Marzo'],
    enRevision:  ['Abril'],
    atrasados:   [],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // B3 — Becado, al día
    rut:       '19.567.890-1',
    nombre:    'Elena Pérez Muñoz',
    curso:     '7° Básico A',
    apoderado: APODERADOS.familiaB,
    monto_cuota: 60000,
    es_becado:   true,
    pagados:     ['Marzo', 'Abril'],
    enRevision:  [],
    atrasados:   [],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILIA C — apoderado: Carmen Lagos Moreno (13.456.789-9)
  // 2 mellizos: Benjamín y Isidora Rojas Lagos
  // ══════════════════════════════════════════════════════════════════════════
  {
    // C1 — Sin pagos aún
    rut:       '20.678.901-8',
    nombre:    'Benjamín Rojas Lagos',
    curso:     'Kinder A',
    apoderado: APODERADOS.familiaC,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     [],
    enRevision:  [],
    atrasados:   ['Marzo', 'Abril'],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // C2 — Un mes pagado, un mes atrasado
    rut:       '21.789.012-8',
    nombre:    'Isidora Rojas Lagos',
    curso:     'Kinder B',
    apoderado: APODERADOS.familiaC,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     ['Marzo'],
    enRevision:  [],
    atrasados:   ['Abril'],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SOLOS — un hijo por apoderado (8 estudiantes)
  // ══════════════════════════════════════════════════════════════════════════
  {
    // S1 — Comprobante en revisión
    rut:       '22.890.123-7',
    nombre:    'Camila Torres Vega',
    curso:     '7° Básico A',
    apoderado: APODERADOS.luisTorres,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     ['Marzo'],
    enRevision:  ['Abril'],
    atrasados:   [],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // S2 — Todo atrasado
    rut:       '14.901.234-6',
    nombre:    'Fernanda López Díaz',
    curso:     '8° Básico B',
    apoderado: APODERADOS.jorgeLopez,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     [],
    enRevision:  [],
    atrasados:   ['Marzo', 'Abril'],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // S3 — Becado parcial, excelente pagador
    rut:       '15.012.345-3',
    nombre:    'Andrés Peña Salazar',
    curso:     '2° Básico A',
    apoderado: APODERADOS.elenaPena,
    monto_cuota: 45000,
    es_becado:   true,
    pagados:     ['Marzo', 'Abril'],
    enRevision:  [],
    atrasados:   [],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // S4 — Solo marzo pagado
    rut:       '16.123.456-7',
    nombre:    'Catalina Ríos Espinoza',
    curso:     '5° Básico A',
    apoderado: APODERADOS.marcoRios,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     ['Marzo'],
    enRevision:  [],
    atrasados:   ['Abril'],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // S5 — Muy atrasado
    rut:       '17.234.567-0',
    nombre:    'Joaquín Flores Medina',
    curso:     '8° Básico B',
    apoderado: APODERADOS.soniaFlores,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     [],
    enRevision:  [],
    atrasados:   ['Marzo', 'Abril'],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // S6 — Kinder, al día
    rut:       '18.345.678-4',
    nombre:    'Renata Guzmán Pinto',
    curso:     'Kinder A',
    apoderado: APODERADOS.miguelGuzman,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     ['Marzo', 'Abril'],
    enRevision:  [],
    atrasados:   [],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // S7 — Becado parcial, un mes atrasado
    rut:       '19.456.789-8',
    nombre:    'Felipe Araya Cárdenas',
    curso:     '6° Básico A',
    apoderado: APODERADOS.carmenAraya,
    monto_cuota: 65000,
    es_becado:   true,
    pagados:     ['Marzo'],
    enRevision:  [],
    atrasados:   ['Abril'],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  },
  {
    // S8 — Comprobante en revisión
    rut:       '20.567.890-5',
    nombre:    'Antonia Castro Reyes',
    curso:     '6° Básico A',
    apoderado: APODERADOS.franciscoCastro,
    monto_cuota: MONTO_NORMAL,
    es_becado:   false,
    pagados:     ['Marzo'],
    enRevision:  ['Abril'],
    atrasados:   [],
    pendientes:  ['Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
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
  console.log('   Familias: A (2 hermanos) · B (3 hermanos) · C (2 mellizos) · 8 solos\n')

  // 1. Limpiar todo
  console.log('🧹 Limpiando datos anteriores...')
  await limpiarCuentasAuth()
  await limpiarColeccion('Estudiantes')
  await limpiarColeccion('Cuotas')
  console.log('')

  // 2. Crear estudiantes y cuotas
  const batch     = db.batch()
  let docsCreados = 0

  for (const est of DEMO_ESTUDIANTES) {
    const apo = est.apoderado
    console.log(`👤 ${est.nombre}  (${est.rut})  →  ${est.curso}`)
    console.log(`   apoderado: ${apo.nombre}  RUT: ${apo.rut}`)

    const uid      = await crearOActualizarUsuario(est.rut, PASSWORD_DEMO, est.nombre)
    const rutLimpio = limpiarRut(est.rut)

    // ── Estudiantes/{uid} ──────────────────────────────────────────────────
    const estRef = db.collection('Estudiantes').doc(uid)
    batch.set(estRef, {
      nombre:                est.nombre,
      rut:                   est.rut,
      rut_limpio:            rutLimpio,
      curso:                 est.curso,
      apoderado_nombre:      apo.nombre,
      apoderado_email:       apo.email,
      apoderado_rut:         apo.rut,
      apoderado_rut_limpio:  apo.rut_limpio,
      monto_cuota:           est.monto_cuota,
      es_becado:             est.es_becado,
      requiere_cambio_clave: false,
      created_at:            FieldValue.serverTimestamp(),
    })
    docsCreados++

    // ── Cuotas ─────────────────────────────────────────────────────────────
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

  // ─── Resumen ──────────────────────────────────────────────────────────────
  console.log(`\n✅ Seed completado: ${DEMO_ESTUDIANTES.length} estudiantes, ${docsCreados} documentos Firestore.\n`)
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log(`🔑 ADMIN     RUT: ${ADMIN_RUT}  |  Clave: ${ADMIN_PASSWORD}`)
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log(`📋 ESTUDIANTES — clave única para todos: ${PASSWORD_DEMO}\n`)

  // Familias
  const groups = [
    { label: 'FAMILIA A', key: 'familiaA' },
    { label: 'FAMILIA B', key: 'familiaB' },
    { label: 'FAMILIA C', key: 'familiaC' },
  ]
  for (const g of groups) {
    const apo  = APODERADOS[g.key]
    const hijos = DEMO_ESTUDIANTES.filter(e => e.apoderado === apo)
    console.log(`  ── ${g.label} — ${apo.nombre} (${apo.rut})  ✉ ${apo.email}`)
    hijos.forEach(e => {
      const beca = e.es_becado ? ` 🎓 BECADO ($${e.monto_cuota.toLocaleString('es-CL')})` : ''
      console.log(`     • ${e.rut.padEnd(15)}  ${e.nombre}  (${e.curso})${beca}`)
      console.log(`       💚 ${e.pagados.length} pag  🔴 ${e.atrasados.length} atr  🟡 ${e.enRevision.length} rev`)
    })
    console.log('')
  }

  console.log('  ── SOLOS')
  const solos = DEMO_ESTUDIANTES.filter(e =>
    !['familiaA','familiaB','familiaC'].map(k => APODERADOS[k]).includes(e.apoderado)
  )
  solos.forEach((e, i) => {
    const beca = e.es_becado ? ` 🎓 BECADO ($${e.monto_cuota.toLocaleString('es-CL')})` : ''
    console.log(`  ${String(i+1).padStart(2)}. ${e.rut.padEnd(15)}  ${e.nombre}  (${e.curso})${beca}`)
    console.log(`      ✉  ${e.apoderado.email}  (apoderado: ${e.apoderado.nombre})`)
    console.log(`      💚 ${e.pagados.length} pagada(s)   🔴 ${e.atrasados.length} atrasada(s)   🟡 ${e.enRevision.length} en revisión\n`)
  })

  console.log('══════════════════════════════════════════════════════════════════════\n')
}

seed()
  .catch((err) => { console.error('❌ Error en seed:', err); process.exit(1) })
  .finally(() => process.exit(0))
