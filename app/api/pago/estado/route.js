// ─────────────────────────────────────────────────────────────────────────────
// app/api/pago/estado/route.js
// GET /api/pago/estado?cuota_id=<id>
// Devuelve el estado actual de una cuota para polling desde la página de
// confirmación. Solo expone 3 campos; nunca datos internos de la cuota.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse }          from 'next/server'
import { adminDb }               from '../../../../firebase/adminConfig'
import { verificarOwnership }    from '../../../../lib/verificarOwnership'

export async function GET(request) {
  try {
    // 1. Verificar que viene un header Authorization (sin hacer llamada de red)
    const authHeader = request.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ') || authHeader.length < 15) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Verificar que cuota_id está presente
    const cuotaId = new URL(request.url).searchParams.get('cuota_id')
    if (!cuotaId) {
      return NextResponse.json({ error: 'cuota_id es requerido' }, { status: 400 })
    }

    // 3. Verificar que la cuota existe
    const cuotaSnap = await adminDb.collection('Cuotas').doc(cuotaId).get()
    if (!cuotaSnap.exists) {
      return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
    }
    const cuota = cuotaSnap.data()

    // 4. Verificar que el apoderado autenticado es dueño de la cuota
    //    (verificarOwnership también valida la firma del token Firebase)
    const esOwner = await verificarOwnership(request, cuota)
    if (!esOwner) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // 5. Devolver solo los 3 campos especificados — nunca datos extra
    return NextResponse.json({
      estado:      cuota.estado      ?? null,
      fecha_pago:  cuota.fecha_pago?.toDate?.()?.toISOString() ?? null,
      metodo_pago: cuota.metodo_pago ?? null,
    })

  } catch (error) {
    console.error('[/api/pago/estado] Error:', error?.message ?? error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
