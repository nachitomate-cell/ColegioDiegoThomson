// ─────────────────────────────────────────────────────────────────────────────
// app/api/pago/iniciar/route.js
// POST /api/pago/iniciar
// Crea una transacción en Transbank WebPay Plus y devuelve la URL de pago.
//
// Body esperado: { cuotaId: string }
// Respuesta:     { url: string, token: string }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse }         from 'next/server'
import { adminDb }             from '../../../../firebase/adminConfig'
import { verificarOwnership }  from '../../../../lib/verificarOwnership'

// ── URL base de la app ────────────────────────────────────────────────────────
// NEXT_PUBLIC_BASE_URL tiene prioridad; si no está, Vercel provee VERCEL_URL
// automáticamente en cada deployment (no requiere configuración manual).
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

// ── Lazy-init del SDK (CJS via dynamic import) ────────────────────────────────
let _tx = null
async function getTx() {
  if (_tx) return _tx
  const tbk         = await import('transbank-sdk')
  const mod         = tbk.default ?? tbk
  const { commerceCode, apiKey, isProduction } = getTbkCredentials()
  const env         = isProduction ? mod.Environment.Production : mod.Environment.Integration

  console.log('[Transbank] init | code:', commerceCode, '| env:', isProduction ? 'PROD' : 'INT')

  _tx = new mod.WebpayPlus.Transaction(new mod.Options(commerceCode, apiKey, env))
  return _tx
}

export async function POST(request) {
  try {
    const { cuotaId } = await request.json()

    if (!cuotaId || typeof cuotaId !== 'string') {
      return NextResponse.json({ error: 'cuotaId es requerido' }, { status: 400 })
    }

    // ── 1. Verificar cuota ────────────────────────────────────────────────────
    const cuotaSnap = await adminDb.collection('Cuotas').doc(cuotaId).get()

    if (!cuotaSnap.exists) {
      return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
    }

    const cuota = cuotaSnap.data()
    if (!['pendiente', 'atrasado'].includes(cuota.estado)) {
      return NextResponse.json(
        { error: `La cuota está en estado "${cuota.estado}" y no puede pagarse` },
        { status: 409 }
      )
    }

    // ── 2. Verificar que el usuario autenticado es dueño de la cuota ──────────
    // [DEBUG_PAGO] Log antes de verificar ownership
    console.log('[DEBUG_PAGO] Iniciando pago', {
      pasarela:                 'Transbank WebPay Plus',
      monto:                    cuota.monto,
      cuotaId,
      cuotaEstado:              cuota.estado,
      cuotaEstudianteId:        cuota.estudiante_id ?? 'N/A',
      hasCommerceCode:          !!process.env.TRANSBANK_COMMERCE_CODE,
      hasApiKey:                !!process.env.TRANSBANK_API_KEY,
      tbkEnvironment:           process.env.TRANSBANK_ENVIRONMENT || 'no definido (fallback a integración)',
      usingFallbackCredentials: !process.env.TRANSBANK_COMMERCE_CODE || !process.env.TRANSBANK_API_KEY,
      hasAuthHeader:            request.headers.has('authorization'),
    })

    const esOwner = await verificarOwnership(request, cuota)

    // [DEBUG_PAGO] Log resultado de ownership
    console.log('[DEBUG_PAGO] Resultado verificarOwnership:', esOwner)

    if (!esOwner) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // ── 3. Crear transacción ──────────────────────────────────────────────────
    // buyOrder:  solo alfanumérico, máx 26 chars (IDs Firestore = 20 chars ✓)
    // sessionId: solo alfanumérico, máx 61 chars
    // returnUrl: debe ser HTTPS accesible públicamente
    const buyOrder  = cuotaId.slice(0, 26)
    const sessionId = `cdt${cuotaId}`.slice(0, 61)
    const amount    = cuota.monto
    const returnUrl = `${getBaseUrl()}/api/pago/confirmar`

    console.log('[Transbank] create →', { buyOrder, sessionId, amount, returnUrl })

    // [DEBUG_PAGO] Wrap de la llamada a la pasarela con logging detallado
    let response
    try {
      const tx = await getTx()
      console.log('[DEBUG_PAGO] Llamando tx.create a Transbank', { buyOrder, amount, returnUrl })
      response = await tx.create(buyOrder, sessionId, amount, returnUrl)
      console.log('[DEBUG_PAGO] Respuesta OK de Transbank', {
        status: response.status ?? 'N/A',
        tokenPrefix: response.token?.slice(0, 20),
        url: response.url,
      })
    } catch (error) {
      console.error('[DEBUG_PAGO] Error pasarela Transbank', {
        message:     error.message,
        httpStatus:  error.response?.status ?? error.httpCode ?? error.status ?? 'N/A',
        httpBody:    error.response?.data   ?? error.responseText ?? 'N/A',
        httpHeaders: error.response?.headers ?? 'N/A',
        stack:       error.stack,
      })
      throw error
    }

    console.log('[Transbank] create OK → token:', response.token?.slice(0, 20), '...')

    return NextResponse.json({ url: response.url, token: response.token, cuotaId })

  } catch (error) {
    console.error('[API /pago/iniciar] Error:', error?.message ?? error)
    return NextResponse.json(
      { error: error?.message ?? 'Error al iniciar el pago. Intenta nuevamente.' },
      { status: 500 }
    )
  }
}
