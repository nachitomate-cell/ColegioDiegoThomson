// ─────────────────────────────────────────────────────────────────────────────
// functions/index.js
// Firebase Cloud Functions para el Portal de Pagos — Colegio Diego Thomson
//
// Funciones implementadas:
//   1. marcarCuotasAtrasadas  — Cron diario: pasa cuotas vencidas a 'atrasado'
//   2. onCuotaAprobada        — Trigger Firestore: envía email cuando el admin aprueba
//   3. onCuotaRechazada       — Trigger Firestore: envía email cuando el admin rechaza
//
// DESPLIEGUE:
//   1. cd functions && npm install
//   2. firebase functions:config:set sendgrid.key="SG.xxxx" sendgrid.from="pagos@colegiodiegothomson.cl"
//   3. firebase deploy --only functions
// ─────────────────────────────────────────────────────────────────────────────

const { onSchedule }           = require('firebase-functions/v2/scheduler')
const { onDocumentUpdated }    = require('firebase-functions/v2/firestore')
// const { defineSecret }         = require('firebase-functions/params')
const admin                    = require('firebase-admin')
// const sgMail                   = require('@sendgrid/mail')

admin.initializeApp()
const db = admin.firestore()

// Secrets de Cloud Functions (se configuran con: firebase functions:secrets:set SENDGRID_API_KEY)
// const sendgridApiKey  = defineSecret('SENDGRID_API_KEY')
// const sendgridFrom    = defineSecret('SENDGRID_FROM_EMAIL')

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN 1: marcarCuotasAtrasadas
// Cron: se ejecuta todos los días a las 08:00 (hora de Chile, America/Santiago)
// Busca cuotas con estado 'pendiente' cuya fecha_vencimiento ya pasó
// y las actualiza a 'atrasado'.
// ─────────────────────────────────────────────────────────────────────────────
exports.marcarCuotasAtrasadas = onSchedule(
  {
    schedule:  '0 8 * * *',         // Cada día a las 08:00
    timeZone:  'America/Santiago',
    region:    'us-central1',
    memory:    '256MiB',
  },
  async () => {
    const ahora    = admin.firestore.Timestamp.now()
    const snapshot = await db
      .collection('Cuotas')
      .where('estado', '==', 'pendiente')
      .where('fecha_vencimiento', '<', ahora)
      .get()

    if (snapshot.empty) {
      console.log('[marcarCuotasAtrasadas] No hay cuotas para marcar.')
      return
    }

    // Actualizar en lotes de 500 (límite de Firestore batch)
    const chunks = []
    const docs   = snapshot.docs
    for (let i = 0; i < docs.length; i += 500) {
      chunks.push(docs.slice(i, i + 500))
    }

    let totalActualizadas = 0
    for (const chunk of chunks) {
      const batch = db.batch()
      chunk.forEach((doc) => {
        batch.update(doc.ref, {
          estado:      'atrasado',
          actualizado: ahora,
        })
        totalActualizadas++
      })
      await batch.commit()
    }

    console.log(`[marcarCuotasAtrasadas] ${totalActualizadas} cuotas marcadas como atrasadas.`)
  }
)


/* ─────────────────────────────────────────────────────────────────────────────
// PENDIENTE: Activar cuando se tenga la cuenta de Sendgrid y el correo definido.
// FUNCIÓN 2 & 3: Triggers de Firestore para notificaciones por email
// ─────────────────────────────────────────────────────────────────────────────
exports.notificarCambioEstadoCuota = onDocumentUpdated(
  {
    document: 'Cuotas/{cuotaId}',
    region:   'us-central1',
    secrets:  [sendgridApiKey, sendgridFrom],
  },
  async (event) => { ... } // Oculto temporalmente
);
*/
