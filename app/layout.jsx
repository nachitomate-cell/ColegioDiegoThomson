import './globals.css'
import { Toaster } from 'sonner'
import Link from 'next/link'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'Portal Escolar — Colegio Diego Thomson',
  description: 'Plataforma oficial de pagos y gestión escolar.',
  manifest: '/manifest.json',
  // Soporte iOS — capable eliminado (deprecado en iOS 17+, reemplazado
  // por display:"standalone" en manifest.json para iOS 16.4+)
  appleWebApp: {
    statusBarStyle: 'default',
    title: 'Portal CDT',
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
        <Analytics />
        <Toaster richColors position="top-right" />
        <footer className="border-t border-surface-600 py-3 px-4 text-center text-xs text-ink-disabled">
          © {new Date().getFullYear()} Colegio Diego Thomson
          {' · '}
          <Link href="/privacidad" className="hover:text-ink-muted underline underline-offset-2 transition-colors">
            Política de Privacidad
          </Link>
          {' · '}
          <span className="text-ink-disabled/60">Términos de Uso</span>
        </footer>
      </body>
    </html>
  )
}
