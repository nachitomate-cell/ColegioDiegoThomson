// ─────────────────────────────────────────────────────────────────────────────
// app/api/pago/confirmar/route.js
// POST /api/pago/confirmar
//
// Transbank redirige a esta URL después de que el usuario completa el pago.
// Transbank envía el token_ws en el BODY del POST (no en query params).
//
// Flujo:
//   1. Recibir token_ws desde Transbank
//   2. Llamar a tx.commit(token) para obtener el resultado real de la transacción
//   3. Verificar responseCode === 0 (aprobado) y status === 'AUTHORIZED'
//   4. Actualizar Firestore: cuota.estado = 'pagado', cuota.fecha_pago = now
//   5. Redirigir al apoderado a /pago/resultado con los parámetros del resultado
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse }             from 'next/server'
import { adminDb }                  from '../../../../firebase/adminConfig'
import admin                        from '../../../../firebase/adminConfig'

// ── Lazy loading de Transbank (evita errores durante build) ──────────────────
let _tx = null
async function getTx() {
  if (_tx) return _tx
  const tbk = await import('transbank-sdk')
  const mod         = tbk.default ?? tbk
  const WebpayPlus  = mod.WebpayPlus
  const Environment = mod.Environment
  const Options     = mod.Options

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
    // Transbank envía el token en el body como form-data o JSON
    let tokenWs
    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      tokenWs = formData.get('token_ws')
    } else {
      const body = await request.json().catch(() => ({}))
      tokenWs = body.token_ws
    }

    if (!tokenWs) {
      // Transbank también puede enviar TBK_TOKEN si el usuario abandona el pago
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false&motivo=cancelado`
      )
    }

    // ── Confirmar la transacción con Transbank ────────────────────────────────
    const tx = await getTx()
    const response = await tx.commit(tokenWs)

    // response.responseCode === 0  → pago aprobado
    // response.responseCode !== 0  → rechazado o error bancario
    // response.status === 'AUTHORIZED' o 'FAILED' o 'NULLIFIED'
    const aprobado = response.responseCode === 0 && response.status === 'AUTHORIZED'

    if (aprobado) {
      // ── Actualizar Firestore usando Admin SDK ─────────────────────────────
      // buyOrder contiene el cuotaId (truncado a 26 chars)
      const cuotaId = response.buyOrder

      // Buscar la cuota por buyOrder (puede ser truncado, consultar por prefijo)
      // Como usamos cuotaId.slice(0,26) al crear, buscamos cuotas cuyos IDs empiecen con buyOrder
      const cuotasRef = adminDb.collection('Cuotas')
      const snapshot  = await cuotasRef
        .where(admin.firestore.FieldPath.documentId(), '>=', cuotaId)
        .where(admin.firestore.FieldPath.documentId(), '<', cuotaId + '\uf8ff')
        .limit(1)
        .get()

      if (!snapshot.empty) {
        const cuotaDoc = snapshot.docs[0]
        await cuotaDoc.ref.update({
          estado:          'pagado',
          fecha_pago:      admin.firestore.FieldValue.serverTimestamp(),
          comprobante_url: null, // pago online no requiere comprobante manual
          // Guardar metadatos de Transbank para trazabilidad
          transbank_auth_code:     response.authorizationCode,
          transbank_card_number:   response.cardDetail?.cardNumber ?? null,
          transbank_transaction_id: tokenWs,
          transbank_amount:        response.amount,
        })
      }

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=true` +
        `&monto=${response.amount}` +
        `&auth=${response.authorizationCode}` +
        `&cuotaId=${cuotaId}`
      )
    } else {
      // Pago rechazado o error bancario
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false` +
        `&motivo=rechazado&code=${response.responseCode}`
      )
    }

  } catch (error) {
    console.error('[API /pago/confirmar] Error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false&motivo=error`
    )
  }
}

// También aceptar GET en caso de que Transbank redirija con query params
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const tbkToken = searchParams.get('TBK_TOKEN')

  if (tbkToken) {
    // El usuario cancel√≥ el pago en el formulario de Transbank
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false&motivo=cancelado`
    )
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_BASE_URL}/pago/resultado?success=false&motivo=error`
  )
}
