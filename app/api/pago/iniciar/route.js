// ─────────────────────────────────────────────────────────────────────────────
// app/api/pago/iniciar/route.js
// POST /api/pago/iniciar
// Crea una transacción en Transbank WebPay Plus y devuelve la URL de pago.
//
// Body esperado: { cuotaId: string }
// Respuesta:     { url: string, token: string }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse }  from 'next/server'
import { adminDb }       from '../../../../firebase/adminConfig'

// ── Inicializar WebPay Plus con lazy loading ─────────────────────────────────
// Se importa dinámicamente para evitar errores durante el build de Next.js.
// transbank-sdk es CommonJS: el dynamic import lo envuelve en { default: module }
let _tx = null
async function getTx() {
  if (_tx) return _tx
  const tbk = await import('transbank-sdk')
  // CJS interop: named exports pueden estar en tbk o en tbk.default
  const mod         = tbk.default ?? tbk
  const WebpayPlus  = mod.WebpayPlus
  const Environment = mod.Environment
  const Options     = mod.Options  // Options es export de nivel superior, NO de WebpayPlus

  const env = process.env.TRANSBANK_ENVIRONMENT === 'PRODUCTION'
    ? Environment.Production
    : Environment.Integration

  _tx = new WebpayPlus.Transaction(
    new Options(
      process.env.TRANSBANK_COMMERCE_CODE,
      process.env.TRANSBANK_API_KEY,
      env
    )
  )
  return _tx
}

export async function POST(request) {
  try {
    const { cuotaId } = await request.json()

    if (!cuotaId || typeof cuotaId !== 'string') {
      return NextResponse.json({ error: 'cuotaId es requerido' }, { status: 400 })
    }

    // ── 1. Verificar que la cuota existe y está pendiente/atrasada ────────────
    // Se usa Admin SDK para no requerir auth en el servidor
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

    // ── 2. Crear la transacción en Transbank ──────────────────────────────────
    // buyOrder: identificador único de la orden (máx 26 chars alfanumérico)
    // sessionId: referencia interna (máx 61 chars)
    // amount:    monto en pesos CLP (entero, sin decimales)
    // returnUrl: URL donde Transbank redirigirá con el token tras el pago
    const buyOrder  = cuotaId.slice(0, 26)
    const sessionId = `cdt_${cuotaId}`.slice(0, 61)
    const amount    = cuota.monto
    const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/pago/confirmar`

    const tx = await getTx()
    const response = await tx.create(buyOrder, sessionId, amount, returnUrl)

    return NextResponse.json({
      url:     response.url,
      token:   response.token,
      cuotaId,
    })

  } catch (error) {
    console.error('[API /pago/iniciar] Error:', error)
    return NextResponse.json(
      { error: 'Error al iniciar el pago. Intenta nuevamente.' },
      { status: 500 }
    )
  }
}
