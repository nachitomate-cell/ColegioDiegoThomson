import './globals.css'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'Portal Escolar — Colegio Diego Thomson',
  description: 'Plataforma oficial de pagos y gestión escolar.',
  manifest: '/manifest.json',
  // Soporte iOS (Safari no lee el manifest automáticamente)
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Portal CDT',
    startupImage: '/icons/icon-512x512.png',
  },
  // Icono para "Añadir a pantalla de inicio" en iOS
  icons: {
    apple: '/icons/icon-192x192.png',
  },
}

// viewport debe exportarse por separado en Next.js 14+ (no va dentro de metadata)
export const viewport = {
  themeColor: '#8CC63F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-surface-900 text-ink-primary antialiased font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
