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
          950: '#050507',
          900: '#0A0A0C',
          800: '#121217',
          700: '#1A1A22',
        },
        scarlet: {
          500: '#FF2A4D',
          600: '#E01639',
          400: '#FF5773',
          glow: 'rgba(255, 42, 77, 0.35)',
        },
        cyber: {
          cyan: '#00F0FF',
          emerald: '#00FF9D',
          amber: '#FFB800',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'scarlet-glow': '0 0 25px rgba(255, 42, 77, 0.25)',
        'scarlet-glow-lg': '0 0 50px rgba(255, 42, 77, 0.4)',
        'cyan-glow': '0 0 20px rgba(0, 240, 255, 0.25)',
      }
    },
  },
  plugins: [],
}
