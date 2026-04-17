// ─────────────────────────────────────────────────────────────────────────────
// app/api/khipu/iniciar/route.js
// Crea un cobro en Khipu API v3 y devuelve la payment_url.
//
// Cambios vs v2:
//   • Endpoint: https://api.khipu.com/v3/payments  (ya no khipu.com/api/2.0)
//   • Auth:     header x-api-key: {KHIPU_SECRET}   (ya no HMAC receiver_id:hash)
//   • Body:     JSON                                (ya no form-urlencoded)
//   • KHIPU_RECEIVER_ID ya no es necesario
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse }         from 'next/server'
import { adminDb }             from '../../../../firebase/adminConfig'
import { verificarOwnership }  from '../../../../lib/verificarOwnership'

const KHIPU_V3_URL = 'https://payment-api.khipu.com/v3/payments'

export async function POST(request) {
  try {
    const { cuotaId, bankId } = await request.json()
    if (!cuotaId) {
      return NextResponse.json({ error: 'cuotaId es requerido' }, { status: 400 })
    }

    // ── Verificar cuota ────────────────────────────────────────────────────────
    const cuotaSnap = await adminDb.collection('Cuotas').doc(cuotaId).get()
    if (!cuotaSnap.exists) {
      return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
    }
    const cuota = cuotaSnap.data()
    if (!['pendiente', 'atrasado'].includes(cuota.estado)) {
      return NextResponse.json({ error: 'La cuota no está pendiente de pago' }, { status: 409 })
    }

    // ── Verificar que el usuario autenticado es dueño de la cuota ─────────────
    const esOwner = await verificarOwnership(request, cuota)
    if (!esOwner) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const apiKey = process.env.KHIPU_SECRET
    if (!apiKey) {
      throw new Error('KHIPU_SECRET no está configurado en las variables de entorno.')
    }

    // ── Derivar base URL desde la request (funciona en localhost y Vercel) ────
    // NEXT_PUBLIC_BASE_URL puede estar vacía o apuntar a localhost en Vercel.
    // Usamos los headers de la request como fuente de verdad.
    const envUrl  = (process.env.NEXT_PUBLIC_BASE_URL || '').trim()
    const esLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1') || envUrl === ''
    let baseUrl
    if (esLocal) {
      const host  = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
      const proto = request.headers.get('x-forwarded-proto') || 'http'
      baseUrl = `${proto}://${host}`
    } else {
      baseUrl = envUrl
    }

    // ── Construir asunto según tipo de cuota ──────────────────────────────────
    let subject
    if (cuota.es_voluntaria) {
      // Cuota CGPA: no tiene estudiante_id
      subject = `${cuota.concepto || 'Aporte voluntario'} — Colegio Diego Thomson`
    } else {
      // Cuota mensual: buscar nombre del estudiante
      let nombreEstudiante = 'Estudiante'
      if (cuota.estudiante_id) {
        const estSnap = await adminDb.collection('Estudiantes').doc(cuota.estudiante_id).get()
        if (estSnap.exists) {
          nombreEstudiante = estSnap.data().nombre || nombreEstudiante
        }
      }
      subject = `Mensualidad ${cuota.mes} ${cuota.anio} — ${nombreEstudiante}`
    }

    // ── Llamar API Khipu v3 ───────────────────────────────────────────────────
    // notify_url solo se incluye si la URL es pública (no localhost).
    const esLocalUrl = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

    const body = {
      subject,
      currency:       'CLP',
      amount:         cuota.monto,
      transaction_id: cuotaId,
      return_url:     `${baseUrl}/pago/resultado?success=true&khipu=true&cuotaId=${cuotaId}`,
      cancel_url:     `${baseUrl}/pago/resultado?success=false&motivo=cancelado&khipu=true`,
      ...(!esLocalUrl ? { notify_url: `${baseUrl}/api/khipu/confirmar` } : {}),
      // bank_id es opcional: si el apoderado ya eligió su banco en el portal,
      // Khipu salta la pantalla de selección de banco y va directo al pago.
      ...(bankId ? { bank_id: bankId } : {}),
    }

    const res = await fetch(KHIPU_V3_URL, {
      method:  'POST',
      headers: {
        'x-api-key':    apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    // Parseo seguro — Khipu puede devolver HTML si el API key es inválido
    const rawText = await res.text()
    let data = {}
    try {
      data = JSON.parse(rawText)
    } catch {
      console.error('[Khipu Iniciar] Respuesta no-JSON de Khipu:', rawText.slice(0, 200))
      throw new Error(
        res.status === 401 || res.status === 403
          ? 'API key de Khipu inválida o sin permisos. Revisa KHIPU_SECRET en .env.local.'
          : `Khipu respondió ${res.status} con contenido no válido.`
      )
    }

    if (!res.ok) {
      console.error('[Khipu Iniciar] Error de Khipu:', data)
      throw new Error(data.message || data.detail || `Khipu respondió con status ${res.status}`)
    }

    if (!data.payment_url) {
      throw new Error('Khipu no devolvió una URL de pago.')
    }

    return NextResponse.json({
      payment_id:  data.payment_id,
      payment_url: data.payment_url,
      cuotaId,
    })

  } catch (error) {
    console.error('[API /khipu/iniciar] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno al iniciar el pago con Khipu' },
      { status: 500 }
    )
  }
}
