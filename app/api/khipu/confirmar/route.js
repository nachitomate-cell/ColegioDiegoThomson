// ─────────────────────────────────────────────────────────────────────────────
// app/api/khipu/confirmar/route.js
// Webhook IPN de Khipu v3. Khipu llama a esta ruta vía POST cuando el pago
// cambia de estado. Se verifica con GET /v3/payments?notification_token=...
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { adminDb }      from '../../../../firebase/adminConfig'
import admin            from '../../../../firebase/adminConfig'

const KHIPU_V3_URL = 'https://payment-api.khipu.com/v3/payments'

export async function POST(request) {
  try {
    // TODO: remover tras diagnóstico
    // Leer el body UNA SOLA VEZ como texto crudo (el stream no se puede releer).
    const rawBody = await request.text()
    let parsedBody = null
    try { parsedBody = JSON.parse(rawBody) } catch { parsedBody = null }

    console.log('[DEBUG_KHIPU_WEBHOOK] Recibido', {
      method:      request.method,
      contentType: request.headers.get('content-type'),
      khipuHeaders: {
        hasSignature:     !!request.headers.get('x-khipu-signature'),
        notificationId:   request.headers.get('x-khipu-notification-id') || null,
        khipuVersion:     request.headers.get('x-khipu-api-version') || null,
      },
      bodyKeys:       parsedBody ? Object.keys(parsedBody) : 'no-json',
      bodyPreview:    rawBody.substring(0, 300),
      rawBodyLength:  rawBody.length,
    })

    // Determinar notification_token desde el body ya leído
    const contentType = request.headers.get('content-type') ?? ''
    let notification_token = null

    if (contentType.includes('application/json')) {
      notification_token = parsedBody?.notification_token ?? null
    } else {
      // form-urlencoded (comportamiento legacy / fallback)
      notification_token = new URLSearchParams(rawBody).get('notification_token')
    }

    if (!notification_token) {
      console.error('[DEBUG_KHIPU_WEBHOOK] Rechazado 400', {
        razon:           'notification_token ausente',
        contentType,
        parsedBodyKeys:  parsedBody ? Object.keys(parsedBody) : 'no-json',
        rawBodyPreview:  rawBody.substring(0, 200),
      })
      return NextResponse.json({ error: 'notification_token ausente' }, { status: 400 })
    }

    const apiKey = process.env.KHIPU_SECRET
    if (!apiKey) {
      console.error('[Khipu Confirmar] KHIPU_SECRET no configurado.')
      return new NextResponse('Error de configuración', { status: 500 })
    }

    // ── Verificar pago con Khipu v3 ───────────────────────────────────────────
    const verifyRes = await fetch(
      `${KHIPU_V3_URL}?notification_token=${encodeURIComponent(notification_token)}`,
      {
        method:  'GET',
        headers: { 'x-api-key': apiKey },
      }
    )

    // Parseo seguro — evita error de JSON.parse si Khipu devuelve HTML
    const rawText = await verifyRes.text()
    let data = {}
    try {
      data = JSON.parse(rawText)
    } catch {
      console.error('[Khipu Webhook] Respuesta no-JSON al verificar token:', rawText.slice(0, 200))
      return NextResponse.json({ error: 'Respuesta inválida de Khipu' }, { status: 502 })
    }

    if (!verifyRes.ok) {
      console.error('[DEBUG_KHIPU_WEBHOOK] Rechazado 400', {
        razon:        'token inválido según Khipu',
        khipuStatus:  verifyRes.status,
        khipuData:    JSON.stringify(data).substring(0, 300),
      })
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

    const cuotaId = data.transaction_id
    if (!cuotaId) {
      // Notificación no relacionada con este sistema — responder 200 para no reintentos
      return new NextResponse('OK', { status: 200 })
    }

    // ── Marcar cuota como pagada si el status es "done" ──────────────────────
    // Transacción atómica: evita doble escritura si Khipu reintenta el webhook.
    if (data.status === 'done') {
      const cuotaRef = adminDb.collection('Cuotas').doc(cuotaId)

      await adminDb.runTransaction(async (t) => {
        const snap = await t.get(cuotaRef)
        if (!snap.exists) return
        if (snap.data().estado === 'pagado') {
          console.warn('[Khipu] cuota ya estaba pagada, ignorando duplicado:', cuotaId)
          return
        }
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
      console.log(`[Khipu] Cuota ${cuotaId} marcada como PAGADA (payment_id: ${data.payment_id})`)
    }

    // Khipu requiere STATUS 200 para no reintentar la notificación
    return new NextResponse('OK', { status: 200 })

  } catch (error) {
    console.error('[API /khipu/confirmar] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
