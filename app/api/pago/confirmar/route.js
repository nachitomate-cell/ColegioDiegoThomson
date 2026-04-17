// ─────────────────────────────────────────────────────────────────────────────
// app/api/pago/confirmar/route.js
// Transbank redirige aquí después de que el usuario completa el pago.
// Puede venir como POST (form-urlencoded) o GET (query param).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { adminDb }      from '../../../../firebase/adminConfig'
import admin            from '../../../../firebase/adminConfig'

// ── URL base ──────────────────────────────────────────────────────────────────
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.trim()
  if (process.env.VERCEL_URL)           return `https://${process.env.VERCEL_URL.trim()}`
  return 'http://localhost:3000'
}

// ── Credenciales Transbank con fallback a integración ────────────────────────
function getTbkCredentials() {
  return {
    commerceCode: process.env.TRANSBANK_COMMERCE_CODE ?? '597055555532',
    apiKey:       process.env.TRANSBANK_API_KEY       ?? '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
    isProduction: process.env.TRANSBANK_ENVIRONMENT   === 'PRODUCTION',
  }
}

// ── Lazy-init del SDK ─────────────────────────────────────────────────────────
let _tx = null
async function getTx() {
  if (_tx) return _tx
  const tbk         = await import('transbank-sdk')
  const mod         = tbk.default ?? tbk
  const { commerceCode, apiKey, isProduction } = getTbkCredentials()
  const env         = isProduction ? mod.Environment.Production : mod.Environment.Integration

  console.log('[Transbank/confirmar] init | code:', commerceCode, '| env:', isProduction ? 'PROD' : 'INT')

  _tx = new mod.WebpayPlus.Transaction(new mod.Options(commerceCode, apiKey, env))
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
async function commitToken(tokenWs) {
  const base = getBaseUrl()

  let response
  try {
    const tx = await getTx()
    response = await commitConReintentos(tx, tokenWs)
    console.log('[Transbank] commit final response:', JSON.stringify(response))
  } catch (err) {
    console.error('[Transbank] commit falló todos los reintentos | msg:', err?.message)
    return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=error`)
  }

  const aprobado = response.response_code === 0 && response.status === 'AUTHORIZED'

  if (aprobado) {
    const cuotaId = response.buy_order

    // Buscar la cuota por ID exacto (buy_order = cuotaId.slice(0,26) y IDs Firestore = 20 chars)
    const cuotaRef = adminDb.collection('Cuotas').doc(cuotaId)
    const snap     = await cuotaRef.get()

    if (snap.exists) {
      await cuotaRef.update({
        estado:                   'pagado',
        fecha_pago:               admin.firestore.FieldValue.serverTimestamp(),
        comprobante_url:          null,
        transbank_auth_code:      response.authorization_code,
        transbank_card_number:    response.card_detail?.card_number ?? null,
        transbank_transaction_id: tokenWs,
        transbank_amount:         response.amount,
      })
    } else {
      console.error('[Transbank] cuota no encontrada para buy_order:', cuotaId)
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

    return await commitToken(tokenWs)
  } catch (error) {
    console.error('[/pago/confirmar POST] Error inesperado:', error?.message ?? error)
    return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=error`)
  }
}

// ── GET: Transbank redirige con token_ws o TBK_TOKEN en query params ──────────
export async function GET(request) {
  const base = getBaseUrl()
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
      return await commitToken(tokenWs)
    } catch (error) {
      console.error('[/pago/confirmar GET] Error inesperado:', error?.message ?? error)
      return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=error`)
    }
  }

  return NextResponse.redirect(`${base}/pago/resultado?success=false&motivo=error`)
}
