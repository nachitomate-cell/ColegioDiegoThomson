import './globals.css'

export const metadata = {
  title: 'Portal Escolar — Colegio Diego Thomson',
  description: 'Portal de pagos y seguimiento de cuotas escolares',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-surface-900 text-ink-primary antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
