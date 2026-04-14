/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ─── PALETA "PREMIUM DARK" ──────────────────────────────────────────────
      colors: {
        // Fondos en escala de grises oscuros
        surface: {
          base:    '#0A0A0B', // Fondo raíz de la app
          900:     '#111113', // Fondo de páginas / layouts
          800:     '#18181B', // Fondo de secciones principales
          700:     '#1F1F23', // Fondo de tarjetas principales
          600:     '#27272B', // Fondo de tarjetas secundarias / hover
          500:     '#303035', // Bordes de tarjetas, separadores
          400:     '#3F3F46', // Bordes de inputs, divisores sutiles
          300:     '#52525B', // Texto deshabilitado, placeholders
        },

        // Tipografía
        ink: {
          primary:   '#F4F4F5', // Texto principal (casi blanco)
          secondary: '#A1A1AA', // Texto secundario (gris medio)
          muted:     '#71717A', // Texto terciario / labels
          disabled:  '#52525B', // Texto deshabilitado
        },

        // ─── SEMÁFORO DE ESTADOS ─────────────────────────────────────────────
        // Verde: Pagado
        paid: {
          DEFAULT: '#22C55E',  // Texto / ícono
          bg:      '#052E16',  // Fondo de badge/chip
          border:  '#14532D',  // Borde de badge/chip
          glow:    '#16A34A',  // Para efectos de sombra si se usan
        },

        // Amarillo/Naranja: En Revisión
        review: {
          DEFAULT: '#F59E0B',
          bg:      '#1C1200',
          border:  '#451A03',
          glow:    '#D97706',
        },

        // Naranja: Pendiente (vence pronto)
        pending: {
          DEFAULT: '#F97316',
          bg:      '#1A0A00',
          border:  '#431407',
          glow:    '#EA580C',
        },

        // Rojo: Atrasado
        overdue: {
          DEFAULT: '#EF4444',
          bg:      '#1C0A0A',
          border:  '#450A0A',
          glow:    '#DC2626',
        },

        // Azul: Acciones primarias / botones CTA
        accent: {
          DEFAULT: '#3B82F6',
          hover:   '#2563EB',
          bg:      '#0A1628',
          border:  '#1E3A5F',
        },
      },

      // ─── TIPOGRAFÍA ─────────────────────────────────────────────────────────
      fontFamily: {
        sans:  ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },

      // ─── BORDES ──────────────────────────────────────────────────────────────
      borderRadius: {
        sm:  '6px',
        DEFAULT: '8px',
        md:  '10px',
        lg:  '14px',
        xl:  '18px',
        '2xl': '24px',
      },

      // ─── SOMBRAS (minimalistas, aptas para fondos oscuros) ──────────────────
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
        'card-lg': '0 4px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)',
        'glow-green':  '0 0 12px rgba(34,197,94,0.25)',
        'glow-amber':  '0 0 12px rgba(245,158,11,0.25)',
        'glow-orange': '0 0 12px rgba(249,115,22,0.25)',
        'glow-red':    '0 0 12px rgba(239,68,68,0.25)',
        'glow-blue':   '0 0 12px rgba(59,130,246,0.25)',
      },

      // ─── ANIMACIONES ─────────────────────────────────────────────────────────
      animation: {
        'fade-in':     'fadeIn 0.4s ease-out',
        'slide-up':    'slideUp 0.4s ease-out',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
