// ─────────────────────────────────────────────────────────────────────────────
// app/api/khipu/confirmar/route.js
// Webhook IPN de Khipu v3. Khipu llama a esta ruta vía POST cuando el pago
// se completa. El body JSON incluye payment_id y transaction_id directamente
// (no hay notification_token en v3). Se verifica con GET /v3/payments/{id}.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse }           from 'next/server'
import { adminDb }               from '../../../../firebase/adminConfig'
import admin                     from '../../../../firebase/adminConfig'
import { enviarComprobantePago } from '../../../../lib/email/enviarComprobantePago'

const KHIPU_V3_URL = 'https://payment-api.khipu.com/v3/payments'

export async function POST(request) {
  try {
    const rawBody = await request.text()
    let parsedBody = null
    try { parsedBody = JSON.parse(rawBody) } catch { parsedBody = null }

    if (!parsedBody) {
      console.error('[Khipu Webhook] Body no es JSON válido:', rawBody.slice(0, 200))
      return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
    }

    const payment_id = parsedBody.payment_id
    const cuotaId    = parsedBody.transaction_id

    if (!payment_id) {
      console.error('[Khipu Webhook] payment_id ausente en el body')
      return NextResponse.json({ error: 'payment_id ausente' }, { status: 400 })
    }

    const apiKey = process.env.KHIPU_SECRET
    if (!apiKey) {
      console.error('[Khipu Confirmar] KHIPU_SECRET no configurado.')
      return new NextResponse('Error de configuración', { status: 500 })
    }

    // ── Verificar pago con Khipu v3 ───────────────────────────────────────────
    // Khipu v3 envía el payload completo en el webhook, pero verificamos
    // contra la API para no confiar ciegamente en el body entrante.
    const verifyRes = await fetch(
      `${KHIPU_V3_URL}/${encodeURIComponent(payment_id)}`,
      {
        method:  'GET',
        headers: { 'x-api-key': apiKey },
      }
    )

    const rawText = await verifyRes.text()
    let data = {}
    try {
      data = JSON.parse(rawText)
    } catch {
      console.error('[Khipu Webhook] Respuesta no-JSON al verificar payment_id:', rawText.slice(0, 200))
      return NextResponse.json({ error: 'Respuesta inválida de Khipu' }, { status: 502 })
    }

    if (!verifyRes.ok) {
      console.error('[Khipu Webhook] payment_id no válido:', { payment_id, status: verifyRes.status, data })
      return NextResponse.json({ error: 'Pago no verificado' }, { status: 400 })
    }

    // transaction_id viene de Khipu (es el cuotaId que enviamos al crear el cobro).
    // Usamos el valor verificado por la API, no el del webhook.
    const verifiedCuotaId = data.transaction_id ?? cuotaId
    if (!verifiedCuotaId) {
      // Notificación no relacionada con este sistema — responder 200 para no reintentos
      return new NextResponse('OK', { status: 200 })
    }

    // ── Marcar cuota como pagada si el status es "done" ──────────────────────
    // Transacción atómica: evita doble escritura si Khipu reintenta el webhook.
    if (data.status === 'done') {
      const cuotaRef = adminDb.collection('Cuotas').doc(verifiedCuotaId)

      let cuotaYaPagada  = false
      let cuotaData      = null

      await adminDb.runTransaction(async (t) => {
        const snap = await t.get(cuotaRef)
        if (!snap.exists) return
        if (snap.data().estado === 'pagado') {
          cuotaYaPagada = true
          console.warn('[Khipu] cuota ya estaba pagada, ignorando duplicado:', verifiedCuotaId)
          return
        }
        cuotaData = snap.data()
        t.update(cuotaRef, {
          estado:           'pagado',
          fecha_pago:       admin.firestore.FieldValue.serverTimestamp(),
          comprobante_url:  null,
          khipu_payment_id: data.payment_id,
          khipu_amount:     data.amount,
          aprobado_por:     'online',
          aprobado_nombre:  'Khipu',
          metodo_pago:      'khipu',
        })
      })
      console.log(`[Khipu] Cuota ${verifiedCuotaId} marcada como PAGADA (payment_id: ${data.payment_id})`)

      // ── Enviar email de comprobante (best-effort, nunca bloquea el pago) ────
      if (!cuotaYaPagada && cuotaData) {
        try {
          const estudianteId = cuotaData.estudiante_id
          if (!estudianteId) {
            console.warn('[Khipu] cuota sin estudiante_id, no se envía email:', verifiedCuotaId)
          } else {
            const estSnap = await adminDb.collection('Estudiantes').doc(estudianteId).get()
            if (!estSnap.exists) {
              console.warn('[Khipu] estudiante no encontrado para email:', estudianteId)
            } else {
              const est            = estSnap.data()
              const apoderadoEmail = est.apoderado_email || null
              if (!apoderadoEmail) {
                console.warn('[Khipu] apoderado sin email registrado, no se envía comprobante',
                  { estudianteId, cuotaId: verifiedCuotaId })
              } else {
                const concepto = cuotaData.es_voluntaria
                  ? (cuotaData.concepto || 'Aporte voluntario')
                  : `Mensualidad ${cuotaData.mes} ${cuotaData.anio}`
                const emailResult = await enviarComprobantePago({
                  apoderadoEmail,
                  apoderadoNombre:  est.apoderado_nombre || est.nombre || 'Apoderado',
                  estudianteNombre: est.nombre           || '—',
                  concepto,
                  monto:            cuotaData.monto,
                  fechaPago:        new Date(),
                  medioPago:        'Khipu',
                  transactionId:    data.payment_id,
                })
                if (emailResult.ok) {
                  console.log('[Khipu] Comprobante enviado a:', apoderadoEmail, '| id:', emailResult.id)
                } else {
                  console.error('[Khipu] Resend rechazó el email:', emailResult.error)
                }
              }
            }
          }
        } catch (emailErr) {
          // El email es best-effort: un fallo aquí NUNCA revierte el pago.
          console.error('[Khipu] Error enviando comprobante por email:', emailErr.message)
        }
      }
    }

    // Khipu requiere STATUS 200 para no reintentar la notificación
    return new NextResponse('OK', { status: 200 })

  } catch (error) {
    console.error('[API /khipu/confirmar] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
