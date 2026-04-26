// ─────────────────────────────────────────────────────────────────────────────
// app/api/admin/procesar-revision/route.js
// POST /api/admin/procesar-revision
//
// Aprueba o rechaza una cuota en estado 'en_revision'.
// Reemplaza el updateDoc directo del cliente para agregar auditoría
// y el campo metodo_confirmacion al flujo existente.
//
// Body: { cuota_id, accion: 'aprobar'|'rechazar', observacion? }
// Responde: { ok, cuota_id, accion } | { error }
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse }       from 'next/server'
import { adminAuth, adminDb } from '../../../../firebase/adminConfig'
import admin                  from '../../../../firebase/adminConfig'
import { getRolEfectivo }     from '../../../../lib/admin/auth'

export async function POST(request) {
  try {
    // ── 1. Autenticación ─────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.slice(7))
    } catch {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    const uid = decoded.uid

    // ── 2. Rol ───────────────────────────────────────────────────────────────
    const rol = await getRolEfectivo(uid, decoded)
    if (!rol) {
      return NextResponse.json({ error: 'Sin permisos de administración' }, { status: 403 })
    }

    // ── 3. Body ──────────────────────────────────────────────────────────────
    let body
    try { body = await request.json() } catch {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }
    const { cuota_id, accion, observacion } = body

    if (!cuota_id || typeof cuota_id !== 'string') {
      return NextResponse.json({ error: 'cuota_id es requerido' }, { status: 400 })
    }
    if (!['aprobar', 'rechazar'].includes(accion)) {
      return NextResponse.json({ error: 'accion debe ser "aprobar" o "rechazar"' }, { status: 400 })
    }

    // ── 4. Leer cuota ─────────────────────────────────────────────────────────
    const cuotaRef  = adminDb.collection('Cuotas').doc(cuota_id)
    const cuotaSnap = await cuotaRef.get()
    if (!cuotaSnap.exists) {
      return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
    }
    const cuota = cuotaSnap.data()

    if (cuota.estado !== 'en_revision') {
      return NextResponse.json(
        { error: `La cuota está en estado "${cuota.estado}", no en revisión` },
        { status: 409 }
      )
    }

    // ── 5. Metadatos ─────────────────────────────────────────────────────────
    const adminNombre = decoded.name || decoded.email?.split('@')[0] || uid.slice(0, 8)
    const ipCaller    = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                     || request.headers.get('x-real-ip')
                     || 'desconocida'
    const userAgent   = request.headers.get('user-agent') || 'desconocido'

    // ── 6. Transacción atómica ────────────────────────────────────────────────
    const auditRef = adminDb.collection('AuditoriaPagos').doc()

    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(cuotaRef)
      if (!snap.exists || snap.data().estado !== 'en_revision') {
        throw new Error('ESTADO_INVALIDO')
      }

      if (accion === 'aprobar') {
        t.update(cuotaRef, {
          estado:                'pagado',
          fecha_pago:            admin.firestore.FieldValue.serverTimestamp(),
          aprobado_por:          uid,
          aprobado_nombre:       adminNombre,
          metodo_confirmacion:   'revision_comprobante',
          confirmado_por:        uid,
          confirmado_por_nombre: adminNombre,
          confirmado_por_rol:    rol,
          confirmado_en:         admin.firestore.FieldValue.serverTimestamp(),
        })
      } else {
        // Rechazar: vuelve a pendiente y limpia el comprobante
        t.update(cuotaRef, {
          estado:          'pendiente',
          comprobante_url: null,
          fecha_envio:     null,
        })
      }

      t.set(auditRef, {
        cuota_id,
        estudiante_id:      cuota.estudiante_id || null,
        apoderado_id:       cuota.apoderado_id  || null,
        accion:             accion === 'aprobar' ? 'aprobacion_revision' : 'rechazo_revision',
        admin_uid:          uid,
        admin_nombre:       adminNombre,
        admin_rol:          rol,
        metodo_pago:        accion === 'aprobar' ? (cuota.metodo_pago || 'comprobante_apoderado') : null,
        numero_comprobante: cuota.comprobante_url || null,
        observacion:        observacion?.trim()
                           || (accion === 'aprobar'
                               ? 'Comprobante validado por secretaría'
                               : 'Comprobante rechazado por secretaría'),
        comprobante_url:    cuota.comprobante_url || null,
        monto:              cuota.monto,
        timestamp:          admin.firestore.FieldValue.serverTimestamp(),
        ip_caller:          ipCaller,
        user_agent_caller:  userAgent,
      })
    })

    console.log(`[ProcesarRevision] Cuota ${cuota_id} → ${accion} | admin: ${adminNombre} (${rol})`)

    return NextResponse.json({ ok: true, cuota_id, accion })

  } catch (error) {
    if (error.message === 'ESTADO_INVALIDO') {
      return NextResponse.json({ error: 'La cuota ya no está en revisión' }, { status: 409 })
    }
    console.error('[API /procesar-revision] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
