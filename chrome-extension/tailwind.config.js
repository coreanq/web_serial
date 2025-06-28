/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../src/**/*.{html,js,ts,tsx}",
    "./templates/**/*.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark theme primary colors
        dark: {
          bg: '#0f0f23',
          surface: '#1a1a2e',
          panel: '#16213e',
          border: '#2a2a3e',
          text: {
            primary: '#ffffff',
            secondary: '#a0a0b8',
            muted: '#6b7280'
          }
        },
        // Status colors for Modbus communication
        status: {
          success: '#10b981',
          error: '#ef4444',
          warning: '#f59e0b',
          info: '#3b82f6',
          sending: '#8b5cf6',
          receiving: '#06b6d4'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
};