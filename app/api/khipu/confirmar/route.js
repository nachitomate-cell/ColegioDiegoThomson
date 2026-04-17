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
    // Khipu v3 puede enviar el token como form-urlencoded o como JSON.
    const contentType = request.headers.get('content-type') ?? ''
    let notification_token = null

    if (contentType.includes('application/json')) {
      const json = await request.json()
      notification_token = json.notification_token ?? null
    } else {
      // form-urlencoded (comportamiento legacy / fallback)
      const text = await request.text()
      notification_token = new URLSearchParams(text).get('notification_token')
    }

    if (!notification_token) {
      return NextResponse.json({ error: 'notification_token ausente' }, { status: 400 })
    }

    const apiKey = process.env.KHIPU_SECRET
    if (!apiKey) {
      console.error('[Khipu Confirmar] KHIPU_SECRET no configurado.')
      return new NextResponse('Error de configuración', { status: 500 })
    }

    // ── Verificar pago con Khipu v3 ───────────────────────────────────────────
    // Khipu v3 permite verificar por notification_token (query param) o por
    // payment_id (path param: GET /v3/payments/{id}).
    // Intentamos primero con notification_token; si falla usamos payment_id.
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
      console.error('[Khipu Webhook] Error verificando token:', data)
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
          estado:          'pagado',
          fecha_pago:      admin.firestore.FieldValue.serverTimestamp(),
          comprobante_url: null,
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
