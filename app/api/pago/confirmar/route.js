// ─────────────────────────────────────────────────────────────────────────────
// app/api/pago/confirmar/route.js
// Transbank redirige aquí después de que el usuario completa el pago.
// Puede venir como POST (form-urlencoded) o GET (query param).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse }           from 'next/server'
import { adminDb }               from '../../../../firebase/adminConfig'
import admin                     from '../../../../firebase/adminConfig'
import { getTransbankConfig }    from '../../../../lib/transbankConfig'
import { enviarComprobantePago } from '../../../../lib/email/enviarComprobantePago'

// ── URL base ──────────────────────────────────────────────────────────────────
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.trim()
  if (process.env.VERCEL_URL)           return `https://${process.env.VERCEL_URL.trim()}`
  return 'http://localhost:3000'
}

// ── Lazy-init del SDK ─────────────────────────────────────────────────────────
let _tx = null
async function getTx(config) {
  if (_tx) return _tx
  const tbk = await import('transbank-sdk')
  const mod  = tbk.default ?? tbk
  const env  = config.isProduction ? mod.Environment.Production : mod.Environment.Integration
  console.log('[Transbank] SDK inicializado en modo:', config.isProduction ? 'PROD' : 'INT')
  _tx = new mod.WebpayPlus.Transaction(new mod.Options(config.commerceCode, config.apiKey, env))
  return _tx
}

// ── Commit con reintentos (Transbank puede tardar en autorizar) ───────────────
async function commitConReintentos(tx, tokenWs, maxIntentos = 4) {
  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      console.log(`[Transbank] commit intento ${intento}/${maxIntentos} → token:`, tokenWs?.slice(0, 20))
      const response = await tx.commit(tokenWs)
      console.log('[Transbank] commit OK en intento', intento, '| status:', response.status)
      return response
    } catch (err) {
      const is422 = err?.message?.includes('422') || err?.httpCode === 422 || err?.status === 422
      console.warn(`[Transbank] commit intento ${intento} falló | 422:${is422} | msg:`, err?.message)
      if (is422 && intento < maxIntentos) {
        // Esperar antes de reintentar: 1s, 2s, 3s
        await new Promise(r => setTimeout(r, intento * 1000))
        continue
      }
      throw err
    }
  }
}

// ── Lógica compartida de commit ───────────────────────────────────────────────
async function commitToken(tokenWs, config) {
  const base = getBaseUrl()

  let response
  try {
    const tx = await getTx(config)
    response = await commitConReintentos(tx, tokenWs)
    console.log('[Transbank] commit final | status:', response.status, '| amount:', response.amount)
  } catch (err) {
    console.error('[Transbank] commit falló todos los reintentos | msg:', err?.message)
    return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=error`)
  }

  const aprobado = response.response_code === 0 && response.status === 'AUTHORIZED'

  if (aprobado) {
    const cuotaId  = response.buy_order
    const cuotaRef = adminDb.collection('Cuotas').doc(cuotaId)

    // Transacción atómica: evita marcar como pagada dos veces si Transbank
    // redirige o reintenta el webhook más de una vez (idempotencia).
    let cuotaYaPagada = false
    let cuotaData     = null

    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(cuotaRef)
      if (!snap.exists) {
        console.error('[Transbank] cuota no encontrada para buy_order:', cuotaId)
        return
      }
      if (snap.data().estado === 'pagado') {
        cuotaYaPagada = true
        console.warn('[Transbank] cuota ya estaba pagada, ignorando duplicado:', cuotaId)
        return
      }
      cuotaData = snap.data()
      t.update(cuotaRef, {
        estado:                   'pagado',
        fecha_pago:               admin.firestore.FieldValue.serverTimestamp(),
        comprobante_url:          null,
        transbank_auth_code:      response.authorization_code,
        transbank_card_number:    response.card_detail?.card_number ?? null,
        transbank_transaction_id: tokenWs,
        transbank_amount:         response.amount,
      })
    })

    // ── Enviar email de comprobante (best-effort, nunca bloquea el pago) ──────
    if (!cuotaYaPagada && cuotaData) {
      try {
        const estudianteId = cuotaData.estudiante_id
        if (!estudianteId) {
          console.warn('[Webpay] cuota sin estudiante_id, no se envía email:', cuotaId)
        } else {
          const estSnap = await adminDb.collection('Estudiantes').doc(estudianteId).get()
          if (!estSnap.exists) {
            console.warn('[Webpay] estudiante no encontrado para email:', estudianteId)
          } else {
            const est            = estSnap.data()
            const apoderadoEmail = est.apoderado_email || null
            if (!apoderadoEmail) {
              console.warn('[Webpay] apoderado sin email registrado, no se envía comprobante',
                { estudianteId, cuotaId })
            } else {
              const concepto = cuotaData.es_voluntaria
                ? (cuotaData.concepto || 'Aporte voluntario')
                : `Mensualidad ${cuotaData.mes} ${cuotaData.anio}`
              await enviarComprobantePago({
                apoderadoEmail,
                apoderadoNombre:  est.apoderado_nombre || est.nombre || 'Apoderado',
                estudianteNombre: est.nombre           || '—',
                concepto,
                monto:            response.amount,
                fechaPago:        new Date(),
                medioPago:        'Webpay',
                transactionId:    response.authorization_code || tokenWs,
              })
              console.log('[Webpay] Comprobante enviado a:', apoderadoEmail)
            }
          }
        }
      } catch (emailErr) {
        // El email es best-effort: un fallo aquí NUNCA revierte el pago.
        console.error('[Webpay] Error enviando comprobante por email:', emailErr.message)
      }
    }

    return NextResponse.redirect(
      `${base}/pago/resultado?success=true` +
      `&monto=${response.amount}` +
      `&auth=${response.authorization_code}` +
      `&cuotaId=${cuotaId}`
    )
  } else {
    console.warn('[Transbank] pago rechazado | response_code:', response.response_code, '| status:', response.status)
    return NextResponse.redirect(
      `${base}/pago/resultado?success=false&motivo=rechazado&code=${response.response_code}`
    )
  }
}

// ── POST: Transbank envía token_ws en body form-urlencoded ────────────────────
export async function POST(request) {
  const base = getBaseUrl()

  // ── 0. Validar configuración Transbank ───────────────────────────────────────
  const config = getTransbankConfig()
  if (!config.ok) {
    console.error('[/pago/confirmar POST] Config inválida, redirigiendo a error')
    return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=error`)
  }

  try {
    const contentType = request.headers.get('content-type') ?? ''
    const url         = new URL(request.url)
    let tokenWs

    // 1. Intentar leer del body (form-urlencoded o JSON)
    try {
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await request.text()
        tokenWs = new URLSearchParams(text).get('token_ws')
      } else if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData()
        tokenWs = formData.get('token_ws')
      } else {
        // Transbank a veces envía sin content-type explícito — probar texto directo
        const text = await request.text()
        tokenWs = new URLSearchParams(text).get('token_ws')
          ?? JSON.parse(text || '{}').token_ws
      }
    } catch { /* continuar */ }

    // 2. Fallback: buscar en query string (algunos redirects vienen como GET enmascarado)
    if (!tokenWs) tokenWs = url.searchParams.get('token_ws')

    console.log('[/pago/confirmar POST] contentType:', contentType, '| token_ws:', tokenWs ? tokenWs.slice(0, 20) + '...' : 'NULL')

    if (!tokenWs) {
      console.warn('[/pago/confirmar POST] sin token_ws → cancelado')
      return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=cancelado`)
    }

    return await commitToken(tokenWs, config)
  } catch (error) {
    console.error('[/pago/confirmar POST] Error inesperado:', error?.message ?? error)
    return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=error`)
  }
}

// ── GET: Transbank redirige con token_ws o TBK_TOKEN en query params ──────────
export async function GET(request) {
  const base = getBaseUrl()

  // ── 0. Validar configuración Transbank ───────────────────────────────────────
  const config = getTransbankConfig()
  if (!config.ok) {
    console.error('[/pago/confirmar GET] Config inválida, redirigiendo a error')
    return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=error`)
  }

  const { searchParams } = new URL(request.url)
  const tbkToken = searchParams.get('TBK_TOKEN')
  const tokenWs  = searchParams.get('token_ws')

  if (tbkToken) {
    console.warn('[/pago/confirmar GET] TBK_TOKEN recibido → cancelado por usuario')
    return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=cancelado`)
  }

  if (tokenWs) {
    console.log('[/pago/confirmar GET] token_ws recibido:', tokenWs?.slice(0, 20), '...')
    try {
      return await commitToken(tokenWs, config)
    } catch (error) {
      console.error('[/pago/confirmar GET] Error inesperado:', error?.message ?? error)
      return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=error`)
    }
  }

  return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=error`)
}
