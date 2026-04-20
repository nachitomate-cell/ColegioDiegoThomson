// ─────────────────────────────────────────────────────────────────────────────
// lib/constants.js
// Datos institucionales del colegio y versión de la política de privacidad.
//
// ⚠  Completar los valores {{PLACEHOLDER}} con datos reales antes de la demo
//    con el cliente. Buscar "{{" en este archivo para localizarlos.
// ─────────────────────────────────────────────────────────────────────────────

// Responsable del tratamiento de datos
export const COLEGIO_INFO = {
  razonSocial: '{{RAZON_SOCIAL_COLEGIO}}',        // ej. "Sociedad Educacional Ejemplo S.A."
  rut:         '{{RUT_COLEGIO}}',                  // ej. "76.123.456-7"
  direccion:   '{{DIRECCION_COLEGIO}}',            // ej. "Av. Ejemplo 1234"
  comuna:      '{{COMUNA}}',                       // ej. "Estación Central"
  region:      '{{REGION}}',                       // ej. "Región Metropolitana"
  email:       '{{EMAIL_INSTITUCIONAL}}',          // ej. "secretaria@colegiodiegothomson.cl"
  telefono:    '{{TELEFONO}}',                     // ej. "+56 2 2345 6789"
  emailDPO:    '{{EMAIL_DPO_O_RESPONSABLE_DATOS}}',// ej. "privacidad@colegiodiegothomson.cl"
}

// Encargado del tratamiento (desarrollador del portal)
export const ENCARGADO_INFO = {
  nombre: 'Ignacio Mateluna',
  rut:    '{{RUT_DESARROLLADOR}}',
  email:  '{{EMAIL_DESARROLLADOR}}',
}

// ─────────────────────────────────────────────────────────────────────────────
// VERSIÓN DE POLÍTICA DE PRIVACIDAD
//
// Incrementar este valor cuando se realicen cambios MATERIALES a la política.
// Los apoderados con una versión anterior serán solicitados de reconsentir
// en su próximo acceso al portal.
//
// Formato sugerido: 'vMAJOR.MINOR-YYYY-MM'
// ─────────────────────────────────────────────────────────────────────────────
export const POLITICA_PRIVACIDAD_VERSION = 'v1.0-2026-04'
