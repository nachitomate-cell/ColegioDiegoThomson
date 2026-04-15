/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Estos paquetes usan módulos nativos de Node.js y no pueden ser
    // empaquetados por webpack. Next.js los carga directamente en el servidor.
    serverComponentsExternalPackages: ['transbank-sdk', 'firebase-admin'],
  },
}

module.exports = nextConfig
