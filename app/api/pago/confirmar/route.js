// ─────────────────────────────────────────────────────────────────────────────
// app/api/pago/confirmar/route.js
// Transbank redirige aquí después de que el usuario completa el pago.
// Puede venir como GET (query param) o POST (form-urlencoded body).
//
// La API de Transbank devuelve JSON en snake_case:
//   response_code, buy_order, authorization_code, card_detail.card_number
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse }  from 'next/server'
import { adminDb }       from '../../../../firebase/adminConfig'
import admin             from '../../../../firebase/adminConfig'

// ── Lazy loading de Transbank ────────────────────────────────────────────────
let _tx = null
async function getTx() {
  if (_tx) return _tx
  const tbk        = await import('transbank-sdk')
  const mod        = tbk.default ?? tbk
  const WebpayPlus = mod.WebpayPlus
  const Environment = mod.Environment
  const Options    = mod.Options

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

// ── Lógica compartida de commit ──────────────────────────────────────────────
async function commitToken(tokenWs) {
  const tx       = await getTx()
  const response = await tx.commit(tokenWs)

  // Transbank devuelve snake_case: response_code, buy_order, authorization_code
  const aprobado = response.response_code === 0 && response.status === 'AUTHORIZED'

  if (aprobado) {
    const cuotaId   = response.buy_order
    const cuotasRef = adminDb.collection('Cuotas')
    const snapshot  = await cuotasRef
      .where(admin.firestore.FieldPath.documentId(), '>=', cuotaId)
      .where(admin.firestore.FieldPath.documentId(), '<',  cuotaId + '\uf8ff')
      .limit(1)
      .get()

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        estado:                   'pagado',
        fecha_pago:               admin.firestore.FieldValue.serverTimestamp(),
        comprobante_url:          null,
        transbank_auth_code:      response.authorization_code,
        transbank_card_number:    response.card_detail?.card_number ?? null,
        transbank_transaction_id: tokenWs,
        transbank_amount:         response.amount,
      })
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=true` +
      `&monto=${response.amount}` +
      `&auth=${response.authorization_code}` +
      `&cuotaId=${cuotaId}`
    )
  } else {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false` +
      `&motivo=rechazado&code=${response.response_code}`
    )
  }
}

// ── POST: Transbank envía token_ws en body form-urlencoded ───────────────────
export async function POST(request) {
  try {
    let tokenWs
    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      tokenWs = new URLSearchParams(text).get('token_ws')
    } else {
      const body = await request.json().catch(() => ({}))
      tokenWs = body.token_ws
    }

    if (!tokenWs) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false&motivo=cancelado`
      )
    }

    return await commitToken(tokenWs)
  } catch (error) {
    console.error('[API /pago/confirmar POST] Error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false&motivo=error`
    )
  }
}

// ── GET: Transbank redirige con token_ws o TBK_TOKEN en query params ─────────
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const tbkToken = searchParams.get('TBK_TOKEN')
  const tokenWs  = searchParams.get('token_ws')

  if (tbkToken) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false&motivo=cancelado`
    )
  }

  if (tokenWs) {
    try {
      return await commitToken(tokenWs)
    } catch (error) {
      console.error('[API /pago/confirmar GET] Error:', error)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false&motivo=error`
      )
    }
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false&motivo=error`
  )
}
