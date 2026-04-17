// app/api/pago/debug/route.js  — TEMPORAL, eliminar antes de producción real
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const tbk = await import('transbank-sdk')
    const mod = tbk.default ?? tbk

    const commerceCode = process.env.TRANSBANK_COMMERCE_CODE ?? '597055555532'
    const apiKey       = process.env.TRANSBANK_API_KEY       ?? '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C'
    const isProduction = process.env.TRANSBANK_ENVIRONMENT === 'PRODUCTION'
    const baseUrl      = process.env.NEXT_PUBLIC_BASE_URL
                      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const env = isProduction ? mod.Environment.Production : mod.Environment.Integration
    const tx  = new mod.WebpayPlus.Transaction(new mod.Options(commerceCode, apiKey, env))

    const returnUrl = `${baseUrl}/api/pago/confirmar`
    const buyOrder  = `debug${Date.now().toString(36)}`
    const sessionId = `cdtdbg${Date.now().toString(36)}`

    const created = await tx.create(buyOrder, sessionId, 100, returnUrl)

    return NextResponse.json({
      ok: true,
      env: {
        TRANSBANK_ENVIRONMENT:  process.env.TRANSBANK_ENVIRONMENT ?? '(no seteado → INTEGRATION)',
        TRANSBANK_COMMERCE_CODE: commerceCode,
        NEXT_PUBLIC_BASE_URL:   process.env.NEXT_PUBLIC_BASE_URL ?? '(no seteado)',
        VERCEL_URL:             process.env.VERCEL_URL           ?? '(no seteado)',
        baseUrl,
        returnUrl,
      },
      transbank: {
        token: created.token,
        url:   created.url,
      },
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error:    err?.message ?? String(err),
      httpCode: err?.httpCode ?? err?.status ?? 'N/A',
    }, { status: 500 })
  }
}
