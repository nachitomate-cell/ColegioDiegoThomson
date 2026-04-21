const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
  // cacheOnFrontEndNav y aggressiveFrontEndNavCaching eliminados:
  // causaban que /login, /dashboard, /admin y /pago/* se sirvieran
  // desde caché stale → errores "no-response" y contenido inconsistente.
  workboxOptions: {
    disableDevLogs: true,
    // runtimeCaching reemplaza las reglas por defecto del plugin.
    // Orden importante: las rutas más específicas primero.
    runtimeCaching: [
      // ── 1. API routes ─────────────────────────────────────────────────
      // NUNCA cachear: siempre red, sin fallback.
      {
        urlPattern: /\/api\//,
        handler: 'NetworkOnly',
      },

      // ── 2. Páginas protegidas y de autenticación ───────────────────────
      // NUNCA cachear navegación a estas rutas.
      {
        urlPattern: /^\/(login|dashboard|admin|pago|cambiar-clave)(\/|$)/,
        handler: 'NetworkOnly',
      },

      // ── 3. Google Fonts CSS (hoja de estilos, actualizable) ────────────
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'google-fonts-stylesheets',
          expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },

      // ── 4. Google Fonts archivos (binarios, inmutables) ────────────────
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },

      // ── 5. Next.js static assets (hashed → inmutables) ────────────────
      {
        urlPattern: /^\/_next\/static\/.+$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static-assets',
          expiration: { maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },

      // ── 6. Imágenes del dominio ────────────────────────────────────────
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp|jfif)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-image-assets',
          expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },

      // ── 7. Fuentes locales ─────────────────────────────────────────────
      {
        urlPattern: /\.(?:eot|otf|ttf|woff|woff2)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-font-assets',
          expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },

      // ── 8. Página raíz (pública, actualizable) ─────────────────────────
      {
        urlPattern: /^\/$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'start-url',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 1, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Estos paquetes usan módulos nativos de Node.js y no pueden ser
    // empaquetados por webpack. Next.js los carga directamente en el servidor.
    serverComponentsExternalPackages: ['transbank-sdk', 'firebase-admin'],
  },
}

module.exports = withPWA(nextConfig)
