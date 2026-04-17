// app/api/pago/debug/route.js — DESHABILITADO
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Endpoint deshabilitado' }, { status: 403 })
}
