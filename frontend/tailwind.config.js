/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#09090b',
          900: '#111114',
          800: '#18181b',
          700: '#27272a',
        },
        scarlet: {
          500: '#ef4444',
          600: '#dc2626',
          400: '#f87171',
        },
        cyber: {
          cyan: '#38bdf8',
          emerald: '#10b981',
          amber: '#f59e0b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
