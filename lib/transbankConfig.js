// ─────────────────────────────────────────────────────────────────────────────
// lib/transbankConfig.js
// Valida y expone la configuración de Transbank WebPay Plus.
//
// Centraliza la lectura de env vars para que ambos endpoints (iniciar y
// confirmar) fallen con 503 explícito si faltan variables, en lugar de
// caer silenciosamente a credenciales de integración hardcodeadas.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lee las env vars de Transbank y valida que estén presentes y sean correctas.
 *
 * @returns {{ ok: true,  commerceCode: string, apiKey: string, isProduction: boolean }
 *          | { ok: false, error: string }}
 */
export function getTransbankConfig() {
  const commerceCode = process.env.TRANSBANK_COMMERCE_CODE
  const apiKey       = process.env.TRANSBANK_API_KEY
  const tbkEnv       = process.env.TRANSBANK_ENVIRONMENT

  if (!commerceCode || !apiKey || !tbkEnv) {
    console.error('[transbankConfig] Configuración Transbank incompleta', {
      hasCommerceCode: !!commerceCode,
      hasApiKey:       !!apiKey,
      hasEnvironment:  !!tbkEnv,
    })
    return { ok: false, error: 'Servicio de pago no disponible. Contacte a secretaría.' }
  }

  if (tbkEnv !== 'INTEGRATION' && tbkEnv !== 'PRODUCTION') {
    console.error('[transbankConfig] TRANSBANK_ENVIRONMENT inválido', { valor: tbkEnv })
    return { ok: false, error: 'Servicio de pago mal configurado. Contacte a secretaría.' }
  }

  return { ok: true, commerceCode, apiKey, isProduction: tbkEnv === 'PRODUCTION' }
}
