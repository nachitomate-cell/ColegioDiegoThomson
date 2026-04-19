// TODO: ELIMINAR ESTE ENDPOINT DESPUÉS DEL DIAGNÓSTICO
// app/api/debug/env-check/route.js
// Diagnóstico temporal de variables de entorno — protegido con header secreto.
// Nunca imprime los valores reales de las keys, solo su presencia.
import { NextResponse } from 'next/server'

const DEBUG_TOKEN = process.env.DEBUG_TOKEN ?? 'cdt-debug-2026'

export async function GET(request) {
  // Protección mínima: header secreto
  const headerToken = request.headers.get('x-debug-token')
  if (headerToken !== DEBUG_TOKEN) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const present = (val) => (val ? 'present' : 'missing')

  return NextResponse.json({
    transbank: {
      commerceCode:  present(process.env.TRANSBANK_COMMERCE_CODE),
      apiKey:        present(process.env.TRANSBANK_API_KEY),
      environment:   process.env.TRANSBANK_ENVIRONMENT || 'missing (usará credenciales de integración hardcodeadas)',
      usingFallback: !process.env.TRANSBANK_COMMERCE_CODE || !process.env.TRANSBANK_API_KEY,
    },
    khipu: {
      receiverId: present(process.env.KHIPU_RECEIVER_ID),
      secret:     present(process.env.KHIPU_SECRET),
    },
    firebase: {
      projectId:      present(process.env.FIREBASE_ADMIN_PROJECT_ID),
      privateKeyId:   present(process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID),
      privateKey:     present(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
      clientEmail:    present(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
      clientId:       present(process.env.FIREBASE_ADMIN_CLIENT_ID),
    },
    app: {
      baseUrl:    process.env.NEXT_PUBLIC_BASE_URL || 'missing (usará VERCEL_URL)',
      vercelUrl:  present(process.env.VERCEL_URL),
      nodeEnv:    process.env.NODE_ENV || 'missing',
    },
  })
}
