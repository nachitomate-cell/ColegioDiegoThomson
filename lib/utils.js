// ─────────────────────────────────────────────────────────────────────────────
// lib/utils.js — Utilidades de texto compartidas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza un string para búsquedas tolerantes a mayúsculas y diacríticos.
 *
 * Pasos:
 *   1. normalize('NFD')  → descompone 'á' en 'a' + U+0301 (combining accent)
 *   2. replace(…)        → elimina todas las marcas diacríticas combinadas
 *   3. toLowerCase()     → unifica mayúsculas/minúsculas
 *   4. trim()            → descarta espacios extremos
 *
 * Ejemplos:
 *   normalizar('María')   → 'maria'
 *   normalizar('JOSÉ')    → 'jose'
 *   normalizar('Ñoño')    → 'nono'
 *   normalizar(null)      → ''
 *
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function normalizar(str) {
  return (str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
