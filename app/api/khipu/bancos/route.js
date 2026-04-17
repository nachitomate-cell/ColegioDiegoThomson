// ─────────────────────────────────────────────────────────────────────────────
// app/api/khipu/bancos/route.js
// Devuelve la lista de bancos disponibles para pagar con Khipu.
// Se cachea por 1 hora en el edge — la lista de bancos cambia muy poco.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiKey = process.env.KHIPU_SECRET
    if (!apiKey) {
      return NextResponse.json({ error: 'KHIPU_SECRET no configurado' }, { status: 500 })
    }

    const res = await fetch('https://api.khipu.com/v3/banks', {
      method:  'GET',
      headers: { 'x-api-key': apiKey },
      // Next.js cache: revalida cada hora (los bancos no cambian seguido)
      next: { revalidate: 3600 },
    })

    // Leer texto crudo primero — si Khipu devuelve HTML (clave inválida, etc.)
    // res.json() exploraría con un error de parse difícil de depurar.
    const rawText = await res.text()
    let data = {}
    try {
      data = JSON.parse(rawText)
    } catch {
      console.error('[/api/khipu/bancos] Respuesta no-JSON de Khipu:', rawText.slice(0, 200))
      throw new Error(
        res.status === 401 || res.status === 403
          ? 'API key de Khipu inválida o sin permisos. Revisa KHIPU_SECRET en .env.local.'
          : `Khipu respondió ${res.status} con contenido no válido.`
      )
    }

    if (!res.ok) {
      console.error('[/api/khipu/bancos] Error de Khipu:', data)
      throw new Error(data.message || data.detail || `Khipu respondió con status ${res.status}`)
    }

    return NextResponse.json({ banks: data.banks ?? [] })

  } catch (error) {
    console.error('[API /khipu/bancos] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener lista de bancos' },
      { status: 500 }
    )
  }
}
