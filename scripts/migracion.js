// ─────────────────────────────────────────────────────────────────────────────
// scripts/migracion.js
// Migración masiva desde Excel → Firebase Auth + Firestore
//
// ARQUITECTURA: El ESTUDIANTE es la entidad central (igual que seedDemo.js).
//   Auth email  → {rut_limpio}@colegiodiegothompson.cl
//   Auth UID    → ID del doc Estudiantes/{uid}
//   Cuotas      → estudiante_id = uid
//
// EJECUTAR:
//   npm run migrate
//
// REQUISITO: el archivo estudiantes.xlsx debe estar en la raíz del proyecto.
// ─────────────────────────────────────────────────────────────────────────────

const admin     = require('firebase-admin')
const XLSX      = require('xlsx')
const path      = require('path')
const fs        = require('fs')

// Carga variables de .env.local (igual que seedDemo.js)
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

// ─── Constantes ───────────────────────────────────────────────────────────────
const EMAIL_DOMAIN = 'colegiodiegothompson.cl'
const MONTO_FULL   = 97500   // Monto completo; por debajo = becado
const ANIO         = 2026
const MESES        = [
  'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
// Índice de mes en Date (0-based): Marzo = 2, Abril = 3, …, Diciembre = 11
const MES_A_INDICE = {
  Marzo: 2, Abril: 3, Mayo: 4, Junio: 5, Julio: 6,
  Agosto: 7, Septiembre: 8, Octubre: 9, Noviembre: 10, Diciembre: 11,
}

// ─── Inicializar Firebase Admin ───────────────────────────────────────────────
// Prioridad 1: serviceAccountKey.json (si existe en scripts/)
// Prioridad 2: variables de entorno en .env.local
const serviceKeyPath = path.resolve(__dirname, 'serviceAccountKey.json')

if (fs.existsSync(serviceKeyPath)) {
  admin.initializeApp({ credential: admin.credential.cert(require(serviceKeyPath)) })
  console.log('ℹ️  Autenticación: serviceAccountKey.json')
} else {
  const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_PRIVATE_KEY_ID,
          FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL,
          FIREBASE_ADMIN_CLIENT_ID } = process.env

  if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_PRIVATE_KEY) {
    console.error('❌ No se encontró serviceAccountKey.json ni variables de entorno.')
    console.error('   Consulta las instrucciones al final de este archivo.')
    process.exit(1)
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      type:           'service_account',
      project_id:     FIREBASE_ADMIN_PROJECT_ID,
      private_key_id: FIREBASE_ADMIN_PRIVATE_KEY_ID,
      private_key:    FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email:   FIREBASE_ADMIN_CLIENT_EMAIL,
      client_id:      FIREBASE_ADMIN_CLIENT_ID,
    }),
  })
  console.log('ℹ️  Autenticación: variables de entorno (.env.local)')
}

const db         = admin.firestore()
const auth       = admin.auth()
const FieldValue = admin.firestore.FieldValue
const Timestamp  = admin.firestore.Timestamp

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * "22.333.444-5" → "223334445"
 * Elimina puntos Y guion para construir email y contraseña.
 */
function limpiarRut(rut) {
  return String(rut).replace(/[.\-\s]/g, '').trim()
}

/** "223334445" → "223334445@colegiodiegothompson.cl" */
function rutAEmail(rutLimpio) {
  return `${rutLimpio.toLowerCase()}@${EMAIL_DOMAIN}`
}

/**
 * Primeros 6 dígitos del RUT limpio como contraseña inicial.
 * Firebase Auth exige mínimo 6 caracteres.
 * "223334445" → "223334"
 */
function passwordInicial(rutLimpio) {
  return rutLimpio.slice(0, 6)
}

/** Devuelve un Firestore Timestamp para el día 10 del mes dado. */
function timestampVencimiento(mes) {
  return Timestamp.fromDate(new Date(ANIO, MES_A_INDICE[mes], 10))
}

/** "10 de Marzo de 2026" */
function textoVencimiento(mes) {
  return `10 de ${mes} de ${ANIO}`
}

// ─── Función principal ────────────────────────────────────────────────────────
async function migrar() {
  // ── 1. Cargar Excel ────────────────────────────────────────────────────────
  const excelPath = path.resolve(process.cwd(), 'estudiantes.xlsx')

  if (!fs.existsSync(excelPath)) {
    console.error(`\n❌ Archivo no encontrado: ${excelPath}`)
    console.error('   Coloca "estudiantes.xlsx" en la raíz del proyecto y vuelve a ejecutar.\n')
    process.exit(1)
  }

  const wb   = XLSX.readFile(excelPath)
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const filas = XLSX.utils.sheet_to_json(ws, { defval: '' })

  console.log(`\n📊 Excel cargado: ${filas.length} fila(s) encontrada(s).\n`)
  console.log('─────────────────────────────────────────────────────────────────\n')

  // ── 2. Validar cabeceras ────────────────────────────────────────────────────
  const CABECERAS_REQUERIDAS = [
    'RUT_Estudiante', 'Nombre_Estudiante', 'Curso',
    'Nombre_Apoderado', 'Correo_Apoderado', 'Valor_Cuota_2026',
  ]
  if (filas.length > 0) {
    const presentes = Object.keys(filas[0])
    const faltantes = CABECERAS_REQUERIDAS.filter(c => !presentes.includes(c))
    if (faltantes.length > 0) {
      console.error('❌ El Excel no tiene las columnas esperadas. Faltan:')
      faltantes.forEach(c => console.error(`   · ${c}`))
      console.error('\n   Asegúrate de que la primera fila tenga exactamente estos nombres de columna.')
      process.exit(1)
    }
  }

  // ── 3. Procesar fila por fila ───────────────────────────────────────────────
  const resultados = {
    creados:   0,
    omitidos:  0,  // Auth ya existía (re-ejecución del script)
    errores:   [],
  }

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    const rut  = String(fila.RUT_Estudiante || '').trim()

    // Saltar filas vacías
    if (!rut) {
      console.warn(`⚠️  Fila ${i + 2}: RUT vacío, saltando.`)
      resultados.omitidos++
      continue
    }

    const rutLimpio       = limpiarRut(rut)
    const nombre          = String(fila.Nombre_Estudiante || '').trim()
    const curso           = String(fila.Curso || '').trim()
    const apoderadoNombre = String(fila.Nombre_Apoderado || '').trim()
    const apoderadoEmail  = String(fila.Correo_Apoderado || '').trim()
    const montoCuota      = Number(fila.Valor_Cuota_2026) || MONTO_FULL
    const esBecado        = montoCuota < MONTO_FULL

    const email    = rutAEmail(rutLimpio)
    const password = passwordInicial(rutLimpio)

    console.log(`[${String(i + 1).padStart(3, '0')}/${filas.length}] ${nombre}`)
    console.log(`         RUT: ${rut}  →  email: ${email}  |  clave inicial: ${password} (6 dígitos)`)
    if (esBecado) console.log(`         🎓 BECADO ($${montoCuota.toLocaleString('es-CL')} < $${MONTO_FULL.toLocaleString('es-CL')})`)

    try {
      // ── Paso A: Firebase Auth ─────────────────────────────────────────────
      let uid
      let authNuevo = true

      try {
        const userRecord = await auth.createUser({
          email,
          password,
          displayName:   nombre,
          emailVerified: false,
        })
        uid = userRecord.uid
        console.log(`         ✅ Auth creado  → uid: ${uid}`)
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-exists') {
          // El usuario ya existe (re-ejecución del script): recuperar UID y continuar
          const existing = await auth.getUserByEmail(email)
          uid = existing.uid
          authNuevo = false
          console.log(`         ⚠️  Auth ya existía → uid: ${uid} (actualizando Firestore…)`)
        } else {
          // Error real (RUT inválido, email malformado, etc.) → reportar y seguir
          throw authErr
        }
      }

      // ── Paso B + C: Firestore batch ───────────────────────────────────────
      // 1 doc Estudiantes + 10 Cuotas = 11 operaciones (muy por debajo del límite de 500)
      const batch = db.batch()

      // Paso B: Estudiantes/{uid}
      const estRef = db.collection('Estudiantes').doc(uid)
      batch.set(estRef, {
        nombre,
        rut,                               // "22.333.444-5" (formato original)
        rut_limpio:            rutLimpio,   // "223334445"    (para búsquedas)
        curso,
        apoderado_nombre:      apoderadoNombre,
        apoderado_email:       apoderadoEmail,
        monto_cuota:           montoCuota,
        es_becado:             esBecado,
        requiere_cambio_clave: true,
        created_at:            FieldValue.serverTimestamp(),
      })

      // Paso C: 10 Cuotas
      for (const mes of MESES) {
        const cuotaRef = db.collection('Cuotas').doc()
        batch.set(cuotaRef, {
          estudiante_id:     uid,
          mes,
          anio:              ANIO,
          monto:             montoCuota,
          vencimiento:       textoVencimiento(mes),      // "10 de Marzo de 2026"
          fecha_vencimiento: timestampVencimiento(mes),  // Firestore Timestamp (para queries)
          estado:            'pendiente',
          comprobante_url:   null,
          fecha_pago:        null,
          fecha_envio:       null,
          created_at:        FieldValue.serverTimestamp(),
        })
      }

      await batch.commit()
      console.log(`         ✅ Firestore: 1 estudiante + 10 cuotas guardadas`)

      if (authNuevo) {
        resultados.creados++
      } else {
        resultados.omitidos++
      }

    } catch (err) {
      console.error(`         ❌ ERROR: ${err.message}`)
      resultados.errores.push({
        fila:   i + 2,
        rut,
        nombre,
        error:  err.message,
        codigo: err.code || 'UNKNOWN',
      })
    }

    console.log('')
  }

  // ── 4. Resumen final ──────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                   RESUMEN DE MIGRACIÓN')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  ✅ Estudiantes nuevos creados:  ${resultados.creados}`)
  console.log(`  ⚠️  Actualizados (ya existían): ${resultados.omitidos}`)
  console.log(`  ❌ Errores (requieren revisión): ${resultados.errores.length}`)
  console.log('═══════════════════════════════════════════════════════════════')

  if (resultados.errores.length > 0) {
    console.log('\n  Detalle de errores:\n')
    resultados.errores.forEach(e => {
      console.error(`  · Fila ${e.fila} | ${e.rut} | ${e.nombre}`)
      console.error(`    Código: ${e.codigo}`)
      console.error(`    Mensaje: ${e.error}\n`)
    })

    // Guardar log de errores para corrección manual
    const logPath = path.resolve(process.cwd(), 'migracion-errores.json')
    fs.writeFileSync(logPath, JSON.stringify(resultados.errores, null, 2), 'utf-8')
    console.log(`  📄 Log de errores exportado en: migracion-errores.json`)
    console.log('     Corrige esos RUTs en el Excel y vuelve a ejecutar el script.')
    console.log('     El script es idempotente: los ya creados se actualizan sin duplicarse.\n')
  } else {
    console.log('\n  🎉 Migración completada sin errores.\n')
  }
}

// ─── Ejecutar ──────────────────────────────────────────────────────────────────
migrar()
  .catch(err => {
    console.error('\n❌ Error fatal no capturado:', err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
