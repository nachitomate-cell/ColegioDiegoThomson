// ─────────────────────────────────────────────────────────────────────────────
// app/api/admin/confirmar-pago-manual/route.js
// POST /api/admin/confirmar-pago-manual
//
// Confirma manualmente una cuota pendiente o atrasada.
// Usado cuando el apoderado pagó por fuera de las pasarelas (efectivo,
// transferencia, cheque) o cuando el webhook automático falló.
//
// Seguridad:
//   1. Verifica ID token de Firebase → 401 si inválido
//   2. Determina rol efectivo (admin o secretaria) → 403 si ninguno
//   3. Valida campos obligatorios
//   4. Verifica estado de la cuota (no ya pagada, no en revisión)
//   5. Transacción atómica: update Cuotas + create AuditoriaPagos
//
// Body esperado:
//   { cuota_id, medio_pago, fecha_pago, numero_comprobante, observacion, comprobante_manual_url? }
//
// Responde: { ok, cuota_id } | { error }
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse }            from 'next/server'
import { adminAuth, adminDb }      from '../../../../firebase/adminConfig'
import admin                       from '../../../../firebase/adminConfig'
import { enviarComprobantePago }   from '../../../../lib/email/enviarComprobantePago'

const MEDIOS_VALIDOS = ['transferencia', 'efectivo', 'cheque', 'webpay_diferido', 'khipu_diferido', 'otro']

/**
 * Determina el rol efectivo del usuario autenticado.
 * Admin: via custom claim O doc en /Admins/{uid}
 * Secretaria: solo via custom claim role='secretaria'
 */
async function getRolEfectivo(uid, decodedToken) {
  if (decodedToken.role === 'admin')      return 'admin'
  if (decodedToken.role === 'secretaria') return 'secretaria'
  const adminSnap = await adminDb.collection('Admins').doc(uid).get()
  if (adminSnap.exists)                   return 'admin'
  return null
}

export async function POST(request) {
  try {
    // ── 1. Verificar token ────────────────────────────────────────────────────
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

    // ── 2. Verificar rol ──────────────────────────────────────────────────────
    const rol = await getRolEfectivo(uid, decoded)
    if (!rol) {
      return NextResponse.json({ error: 'Sin permisos de administración' }, { status: 403 })
    }

    // ── 3. Validar body ───────────────────────────────────────────────────────
    let body
    try { body = await request.json() } catch {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }
    const { cuota_id, medio_pago, fecha_pago, numero_comprobante, observacion, comprobante_manual_url } = body

    if (!cuota_id || typeof cuota_id !== 'string') {
      return NextResponse.json({ error: 'cuota_id es requerido' }, { status: 400 })
    }
    if (!medio_pago || !MEDIOS_VALIDOS.includes(medio_pago)) {
      return NextResponse.json({ error: `Medio de pago inválido. Valores válidos: ${MEDIOS_VALIDOS.join(', ')}` }, { status: 400 })
    }
    if (!fecha_pago) {
      return NextResponse.json({ error: 'Fecha de pago es requerida' }, { status: 400 })
    }
    if (!observacion || observacion.trim().length < 10) {
      return NextResponse.json({ error: 'La observación debe tener al menos 10 caracteres' }, { status: 400 })
    }
    if (medio_pago !== 'efectivo' && !numero_comprobante?.trim()) {
      return NextResponse.json({ error: 'El número de comprobante es obligatorio para este medio de pago' }, { status: 400 })
    }

    const fechaPagoDate = new Date(fecha_pago)
    if (isNaN(fechaPagoDate.getTime())) {
      return NextResponse.json({ error: 'Fecha de pago inválida' }, { status: 400 })
    }

    // ── 4. Leer cuota ─────────────────────────────────────────────────────────
    const cuotaRef  = adminDb.collection('Cuotas').doc(cuota_id)
    const cuotaSnap = await cuotaRef.get()
    if (!cuotaSnap.exists) {
      return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
    }
    const cuota = cuotaSnap.data()

    // ── 5. Verificar estado ───────────────────────────────────────────────────
    if (cuota.estado === 'pagado') {
      return NextResponse.json({ error: 'La cuota ya está confirmada como pagada' }, { status: 409 })
    }
    if (cuota.estado === 'en_revision') {
      return NextResponse.json(
        { error: 'La cuota tiene un comprobante subido. Resuélvela desde "Comprobantes en revisión"' },
        { status: 409 }
      )
    }
    if (!['pendiente', 'atrasado'].includes(cuota.estado)) {
      return NextResponse.json({ error: `Estado inesperado: ${cuota.estado}` }, { status: 400 })
    }

    // ── 6. Metadatos del admin ────────────────────────────────────────────────
    const adminNombre = decoded.name || decoded.email?.split('@')[0] || uid.slice(0, 8)
    const ipCaller    = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                     || request.headers.get('x-real-ip')
                     || 'desconocida'
    const userAgent   = request.headers.get('user-agent') || 'desconocido'

    // ── 7. Transacción atómica ────────────────────────────────────────────────
    const auditRef = adminDb.collection('AuditoriaPagos').doc()

    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(cuotaRef)
      if (!snap.exists) throw new Error('CUOTA_NO_EXISTE')
      const estadoActual = snap.data().estado
      if (estadoActual === 'pagado')      throw new Error('YA_PAGADA')
      if (estadoActual === 'en_revision') throw new Error('EN_REVISION')

      // Update de la cuota
      t.update(cuotaRef, {
        estado:                 'pagado',
        fecha_pago:             admin.firestore.Timestamp.fromDate(fechaPagoDate),
        metodo_pago:            medio_pago,
        metodo_confirmacion:    'manual_desde_admin',
        confirmado_por:         uid,
        confirmado_por_nombre:  adminNombre,
        confirmado_por_rol:     rol,
        confirmado_en:          admin.firestore.FieldValue.serverTimestamp(),
        numero_comprobante:     numero_comprobante?.trim() || null,
        observacion_manual:     observacion.trim(),
        comprobante_manual_url: comprobante_manual_url || null,
        // Compatibilidad con campo existente (tooltip en tabla "Todas")
        aprobado_por:           uid,
        aprobado_nombre:        adminNombre,
      })

      // Registro de auditoría
      t.set(auditRef, {
        cuota_id,
        estudiante_id:      cuota.estudiante_id    || null,
        apoderado_id:       cuota.apoderado_id     || null,
        accion:             'confirmacion_manual',
        admin_uid:          uid,
        admin_nombre:       adminNombre,
        admin_rol:          rol,
        metodo_pago:        medio_pago,
        numero_comprobante: numero_comprobante?.trim() || null,
        observacion:        observacion.trim(),
        comprobante_url:    comprobante_manual_url || null,
        monto:              cuota.monto,
        timestamp:          admin.firestore.FieldValue.serverTimestamp(),
        ip_caller:          ipCaller,
        user_agent_caller:  userAgent,
      })
    })

    console.log(`[ConfirmarPagoManual] Cuota ${cuota_id} confirmada → ${medio_pago} | admin: ${adminNombre} (${rol})`)

    // ── 8. Enviar email de comprobante (best-effort, nunca bloquea la respuesta)
    try {
      const estudianteId = cuota.estudiante_id
      if (!estudianteId) {
        console.warn('[ConfirmarPagoManual] cuota sin estudiante_id, no se envía email:', cuota_id)
      } else {
        const estSnap = await adminDb.collection('Estudiantes').doc(estudianteId).get()
        if (!estSnap.exists) {
          console.warn('[ConfirmarPagoManual] estudiante no encontrado para email:', estudianteId)
        } else {
          const est            = estSnap.data()
          const apoderadoEmail = est.apoderado_email || null
          if (!apoderadoEmail) {
            console.warn('[ConfirmarPagoManual] apoderado sin email registrado, no se envía comprobante',
              { estudianteId, cuota_id })
          } else {
            const concepto = cuota.es_voluntaria
              ? (cuota.concepto || 'Aporte voluntario')
              : `Mensualidad ${cuota.mes} ${cuota.anio}`
            // Capitalizar medio de pago para mostrar en el email
            const medioPagoDisplay = medio_pago.charAt(0).toUpperCase() + medio_pago.slice(1).replace(/_/g, ' ')
            await enviarComprobantePago({
              apoderadoEmail,
              apoderadoNombre:  est.apoderado_nombre || est.nombre || 'Apoderado',
              estudianteNombre: est.nombre           || '—',
              concepto,
              monto:            cuota.monto,
              fechaPago:        fechaPagoDate,
              medioPago:        medioPagoDisplay,
              transactionId:    numero_comprobante?.trim() || cuota_id,
            })
            console.log('[ConfirmarPagoManual] Comprobante enviado a:', apoderadoEmail)
          }
        }
      }
    } catch (emailErr) {
      // El email es best-effort: un fallo aquí NUNCA afecta la confirmación del pago.
      console.error('[ConfirmarPagoManual] Error enviando comprobante por email:', emailErr.message)
    }

    // ── 9. Respuesta ──────────────────────────────────────────────────────────
    // El PDF se genera en el cliente tras recibir { ok: true }.
    return NextResponse.json({ ok: true, cuota_id })

  } catch (error) {
    // Errores semánticos de la transacción
    if (error.message === 'YA_PAGADA') {
      return NextResponse.json({ error: 'La cuota ya está confirmada como pagada' }, { status: 409 })
    }
    if (error.message === 'EN_REVISION') {
      return NextResponse.json({ error: 'La cuota está en revisión, resuélvela desde "Comprobantes"' }, { status: 409 })
    }
    if (error.message === 'CUOTA_NO_EXISTE') {
      return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
    }
    console.error('[API /confirmar-pago-manual] Error:', error)
    return NextResponse.json({ error: 'Error interno al procesar la confirmación' }, { status: 500 })
  }
}
