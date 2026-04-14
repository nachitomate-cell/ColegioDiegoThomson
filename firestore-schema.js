// ─────────────────────────────────────────────────────────────────────────────
// scripts/firestore-schema.js
// Documentación del esquema Firestore + script de seed para desarrollo.
//
// CÓMO USAR:
//   node scripts/firestore-schema.js
//   (requiere firebase-admin: npm install firebase-admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ESQUEMA COMPLETO DE FIRESTORE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Colección: Apoderados                                                   │
 * │  ID del documento: Firebase Auth UID (creado al registrar el usuario)    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  Campo              │ Tipo       │ Descripción                           │
 * ├─────────────────────┼────────────┼───────────────────────────────────────┤
 * │  nombre             │ string     │ "Carlos Fuentes Morales"              │
 * │  email              │ string     │ "c.fuentes@gmail.com"                 │
 * │  rut                │ string     │ "12345678-9" (solo referencia)        │
 * │  estudiantes_ids    │ string[]   │ ["est_abc123", "est_def456"]          │
 * │  created_at         │ Timestamp  │ serverTimestamp()                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Colección: Estudiantes                                                  │
 * │  ID del documento: Auto-generado por Firestore (o ID manual con addDoc) │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  Campo              │ Tipo       │ Descripción                           │
 * ├─────────────────────┼────────────┼───────────────────────────────────────┤
 * │  nombre             │ string     │ "Sofía Fuentes"                       │
 * │  curso              │ string     │ "7° Básico A"                         │
 * │  apoderado_uid      │ string     │ UID del apoderado (ref. inversa)      │
 * │  created_at         │ Timestamp  │ serverTimestamp()                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Colección: Cuotas                                                       │
 * │  ID del documento: Auto-generado por Firestore                          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  Campo              │ Tipo            │ Descripción                      │
 * ├─────────────────────┼─────────────────┼──────────────────────────────────┤
 * │  estudiante_id      │ string          │ ID del documento en Estudiantes   │
 * │  mes                │ string          │ "Junio"                           │
 * │  anio               │ number          │ 2025                              │
 * │  monto              │ number          │ 85000 (CLP, sin decimales)        │
 * │  fecha_vencimiento  │ Timestamp       │ Firestore Timestamp               │
 * │  estado             │ string (enum)   │ 'pendiente' | 'pagado' |         │
 * │                     │                 │ 'en_revision' | 'atrasado'        │
 * │  comprobante_url    │ string | null   │ URL de Firebase Storage           │
 * │  fecha_pago         │ Timestamp | null│ Cuando se confirma el pago        │
 * │  fecha_envio        │ Timestamp | null│ Cuando el apoderado envía compro. │
 * │  created_at         │ Timestamp       │ serverTimestamp()                 │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ÍNDICE COMPUESTO REQUERIDO (crear en Firestore Console):
 *   Colección:  Cuotas
 *   Campo 1:    estudiante_id    (Ascending)
 *   Campo 2:    fecha_vencimiento (Ascending)
 *   Scope:      Collection
 *
 * REGLAS DE SEGURIDAD (firestore.rules) — ejemplo mínimo:
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *
 *       // Apoderado solo puede leer su propio documento
 *       match /Apoderados/{uid} {
 *         allow read: if request.auth != null && request.auth.uid == uid;
 *         allow write: if false; // Solo admin via SDK
 *       }
 *
 *       // Estudiantes: el apoderado puede leer los de su lista
 *       match /Estudiantes/{estudianteId} {
 *         allow read: if request.auth != null &&
 *           exists(/databases/$(database)/documents/Apoderados/$(request.auth.uid)) &&
 *           get(/databases/$(database)/documents/Apoderados/$(request.auth.uid))
 *             .data.estudiantes_ids.hasAny([estudianteId]);
 *         allow write: if false;
 *       }
 *
 *       // Cuotas: apoderado puede leer y actualizar (solo campos permitidos)
 *       match /Cuotas/{cuotaId} {
 *         allow read: if request.auth != null &&
 *           // Verificar que el estudiante_id pertenece al apoderado
 *           get(/databases/$(database)/documents/Apoderados/$(request.auth.uid))
 *             .data.estudiantes_ids.hasAny([resource.data.estudiante_id]);
 *
 *         // Solo puede actualizar estado a 'en_revision' y agregar comprobante_url
 *         allow update: if request.auth != null &&
 *           request.resource.data.estado == 'en_revision' &&
 *           request.resource.data.keys().hasOnly(['estado', 'comprobante_url', 'fecha_envio']);
 *
 *         allow create, delete: if false;
 *       }
 *     }
 *   }
 *
 * REGLAS DE STORAGE (storage.rules) — ejemplo mínimo:
 *
 *   rules_version = '2';
 *   service firebase.storage {
 *     match /b/{bucket}/o {
 *       match /comprobantes/{cuotaId}/{archivo} {
 *         allow read:  if request.auth != null;
 *         allow write: if request.auth != null
 *                      && request.resource.size < 5 * 1024 * 1024   // 5 MB
 *                      && request.resource.contentType.matches('image/.*|application/pdf');
 *       }
 *     }
 *   }
 */

// ─── SCRIPT DE SEED (para poblar datos de prueba) ────────────────────────────
// Descomentar y ejecutar: node scripts/firestore-schema.js

/*
const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json') // Descarga desde Firebase Console

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

async function seed() {
  // ── 1. Crear estudiantes ───────────────────────────────────────────────────
  const sofiaRef = db.collection('Estudiantes').doc()
  const mateoRef = db.collection('Estudiantes').doc()

  await sofiaRef.set({
    nombre:       'Sofía Fuentes',
    curso:        '7° Básico A',
    apoderado_uid: 'REEMPLAZAR_CON_UID_REAL', // ← UID de Firebase Auth
    created_at:   admin.firestore.FieldValue.serverTimestamp(),
  })

  await mateoRef.set({
    nombre:       'Mateo Fuentes',
    curso:        '4° Básico B',
    apoderado_uid: 'REEMPLAZAR_CON_UID_REAL',
    created_at:   admin.firestore.FieldValue.serverTimestamp(),
  })

  // ── 2. Crear apoderado ────────────────────────────────────────────────────
  await db.collection('Apoderados').doc('REEMPLAZAR_CON_UID_REAL').set({
    nombre:          'Carlos Fuentes Morales',
    email:           'c.fuentes@gmail.com',
    rut:             '12345678-9',
    estudiantes_ids: [sofiaRef.id, mateoRef.id],
    created_at:      admin.firestore.FieldValue.serverTimestamp(),
  })

  // ── 3. Crear cuotas para Sofía ────────────────────────────────────────────
  const meses = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const estados = ['pagado','pagado','en_revision','pendiente','pendiente','pendiente','pendiente','pendiente','atrasado','pendiente']
  const batch = db.batch()

  meses.forEach((mes, i) => {
    const cuotaRef = db.collection('Cuotas').doc()
    batch.set(cuotaRef, {
      estudiante_id:     sofiaRef.id,
      mes,
      anio:              2025,
      monto:             85000,
      fecha_vencimiento: admin.firestore.Timestamp.fromDate(new Date(`2025-${String(i + 3).padStart(2,'0')}-10`)),
      estado:            estados[i],
      comprobante_url:   null,
      fecha_pago:        null,
      fecha_envio:       null,
      created_at:        admin.firestore.FieldValue.serverTimestamp(),
    })
  })

  await batch.commit()
  console.log('✅ Seed completado:', { sofiaId: sofiaRef.id, mateoId: mateoRef.id })
  process.exit(0)
}

seed().catch((err) => { console.error(err); process.exit(1) })
*/
