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
      // ─── PALETA "PREMIUM LIGHT" ─────────────────────────────────────────────
      colors: {
        // Fondos en escala de grises claros
        surface: {
          base:    '#FFFFFF', // Fondo de tarjetas / modales
          900:     '#F8F9FA', // Fondo de páginas / layouts (gris ultrasutil)
          800:     '#F1F3F5', // Fondo de headers sticky / secciones elevadas
          700:     '#FFFFFF', // Fondo de tarjetas principales (blanco puro)
          600:     '#F1F3F5', // Fondo de tarjetas secundarias / hover
          500:     '#E5E7EB', // Bordes de tarjetas, separadores (gray-200)
          400:     '#D1D5DB', // Bordes de inputs, divisores (gray-300)
          300:     '#9CA3AF', // Texto deshabilitado, placeholders (gray-400)
        },

        // Tipografía invertida para light mode
        ink: {
          primary:   '#111827', // Texto principal → gray-900
          secondary: '#374151', // Texto secundario → gray-700
          muted:     '#6B7280', // Texto terciario / labels → gray-500
          disabled:  '#9CA3AF', // Texto deshabilitado → gray-400
        },

        // ─── SEMÁFORO DE ESTADOS (ajustados para light mode) ─────────────────
        // Verde: Pagado
        paid: {
          DEFAULT: '#16A34A',  // Texto — green-700 (mayor contraste en blanco)
          bg:      '#DCFCE7',  // Fondo de badge/chip — green-100
          border:  '#BBF7D0',  // Borde de badge/chip — green-200
          glow:    '#22C55E',
        },

        // Amarillo/Naranja: En Revisión
        review: {
          DEFAULT: '#B45309',  // amber-700
          bg:      '#FEF3C7',  // amber-100
          border:  '#FDE68A',  // amber-200
          glow:    '#F59E0B',
        },

        // Naranja: Pendiente (vence pronto)
        pending: {
          DEFAULT: '#C2410C',  // orange-700
          bg:      '#FFEDD5',  // orange-100
          border:  '#FED7AA',  // orange-200
          glow:    '#F97316',
        },

        // Rojo: Atrasado
        overdue: {
          DEFAULT: '#B91C1C',  // red-700
          bg:      '#FEE2E2',  // red-100
          border:  '#FECACA',  // red-200
          glow:    '#EF4444',
        },

        // Verde institucional: mantener el brand color
        'brand-green': '#8CC63F',
        accent: {
          DEFAULT: '#8CC63F',
          hover:   '#7ab52e',
          bg:      '#F0F8E0',  // tint muy claro del verde para bg sutiles
          border:  '#C8E89A',  // borde verde claro
        },
      },

      // ─── TIPOGRAFÍA ─────────────────────────────────────────────────────────
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['ui-monospace', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
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

      // ─── SOMBRAS (suaves, aptas para fondos claros) ─────────────────────────
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)',
        'card-lg': '0 4px 20px rgba(0,0,0,0.10), 0 1px 6px rgba(0,0,0,0.06)',
        'glow-green':  '0 0 12px rgba(34,197,94,0.20)',
        'glow-amber':  '0 0 12px rgba(245,158,11,0.20)',
        'glow-orange': '0 0 12px rgba(249,115,22,0.20)',
        'glow-red':    '0 0 12px rgba(239,68,68,0.20)',
        'glow-blue':   '0 0 14px rgba(140,198,63,0.30)',
      },

      // ─── ANIMACIONES ─────────────────────────────────────────────────────────
      animation: {
        'fade-in':     'fadeIn 0.4s ease-out',
        'slide-up':    'slideUp 0.4s ease-out',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bar-slide':   'barSlide 1.6s ease-in-out infinite',
        'shimmer':     'shimmer 1.8s linear infinite',
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
        barSlide: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(500%)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
    },
  },
  plugins: [],
}
