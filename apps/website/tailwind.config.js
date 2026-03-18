/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Clubhouse-inspired color palette
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        fireside: {
          beige: '#F1EFE7',
          green: '#469946',
          orange: '#eb6b34',
          darkOrange: '#0e0704',
          blue: '#5B9BD5',
          purple: '#8B5A96',
          brown: '#8B4513',
          yellow: "#FFD700",
          red: '#ef4444',
          indigo: "rgba(99,102,241)",
          darkWhite: "rgba(255, 255, 255, 0.3)",
          white: "rgba(255, 255, 255, 0.2)",
          lightWhite: "rgba(255, 255, 255, 0.1)",
          'fireside-blue': '#3b82f6',
        },
        neutral: {
          green: '#24bb89',
          yellow: '#f3ad32',
          orange: '#f78635',
          blue: '#5f9af9',
          purple: '#7b5cf0',
          red: '#ff5858',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Open Sans', 'Helvetica Neue', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'clubhouse': '0 4px 20px rgba(0, 0, 0, 0.1)',
        'clubhouse-lg': '0 10px 40px rgba(0, 0, 0, 0.15)',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        }
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out'
      },
      height: {
        'screen-real': 'calc(var(--vh, 1vh) * 100)',
      }
    },
  },
  plugins: [],
}
