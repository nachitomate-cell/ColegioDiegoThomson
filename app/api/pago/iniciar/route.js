// ─────────────────────────────────────────────────────────────────────────────
// app/api/pago/iniciar/route.js
// POST /api/pago/iniciar
// Crea una transacción en Transbank WebPay Plus y devuelve la URL de pago.
//
// Body esperado: { cuotaId: string }
// Respuesta:     { url: string, token: string }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse }        from 'next/server'
import { adminDb }             from '../../../../firebase/adminConfig'
import { verificarOwnership }  from '../../../../lib/verificarOwnership'
import { getTransbankConfig }  from '../../../../lib/transbankConfig'

// ── URL base de la app ────────────────────────────────────────────────────────
// NEXT_PUBLIC_BASE_URL tiene prioridad; si no está, Vercel provee VERCEL_URL
// automáticamente en cada deployment (no requiere configuración manual).
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.trim()
  if (process.env.VERCEL_URL)           return `https://${process.env.VERCEL_URL.trim()}`
  return 'http://localhost:3000'
}

// ── Lazy-init del SDK (CJS via dynamic import) ────────────────────────────────
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

export async function POST(request) {
  try {
    // ── 0. Validar configuración Transbank ─────────────────────────────────────
    const config = getTransbankConfig()
    if (!config.ok) {
      return NextResponse.json({ error: config.error }, { status: 503 })
    }

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
    const esOwner = await verificarOwnership(request, cuota)
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

    const tx       = await getTx(config)
    const response = await tx.create(buyOrder, sessionId, amount, returnUrl)

    return NextResponse.json({ url: response.url, token: response.token, cuotaId })

  } catch (error) {
    console.error('[/api/pago/iniciar]', error?.message ?? error)
    return NextResponse.json(
      { error: 'Error al iniciar el pago. Intenta nuevamente.' },
      { status: 500 }
    )
  }
}
