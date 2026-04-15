// ─────────────────────────────────────────────────────────────────────────────
// scripts/firestore-schema.js
// Documentación del esquema Firestore + script de seed para desarrollo.
//
// CÓMO USAR EL SEED:
//   node scripts/seed.js
//   (requiere firebase-admin: npm install --save-dev firebase-admin)
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
 * │  ID del documento: Auto-generado por Firestore                          │
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
 *       match /Apoderados/{uid} {
 *         allow read: if request.auth != null && request.auth.uid == uid;
 *         allow write: if false;
 *       }
 *       match /Estudiantes/{estudianteId} {
 *         allow read: if request.auth != null &&
 *           get(/databases/$(database)/documents/Apoderados/$(request.auth.uid))
 *             .data.estudiantes_ids.hasAny([estudianteId]);
 *         allow write: if false;
 *       }
 *       match /Cuotas/{cuotaId} {
 *         allow read: if request.auth != null &&
 *           get(/databases/$(database)/documents/Apoderados/$(request.auth.uid))
 *             .data.estudiantes_ids.hasAny([resource.data.estudiante_id]);
 *         allow update: if request.auth != null &&
 *           request.resource.data.estado == 'en_revision' &&
 *           request.resource.data.keys().hasOnly(['estado', 'comprobante_url', 'fecha_envio']);
 *         allow create, delete: if false;
 *       }
 *     }
 *   }
 */
