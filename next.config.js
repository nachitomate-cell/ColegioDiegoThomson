const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',          // El service worker se genera en /public
  cacheOnFrontEndNav: true, // Cachea durante navegación client-side
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === 'development', // Desactiva SW en dev
  workboxOptions: {
    disableDevLogs: true,
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
