import { skeleton } from '@skeletonlabs/tw-plugin';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './node_modules/@skeletonlabs/skeleton/**/*.{html,js,svelte,ts}'
  ],
  theme: {
    extend: {
      colors: {
        'medical-blue': {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        'medical-green': {
          500: '#10b981',
          600: '#059669'
        },
        'warning-red': {
          500: '#ef4444',
          600: '#dc2626'
        },
        'warning-orange': {
          500: '#f59e0b',
          600: '#d97706'
        }
      }
    }
  },
  plugins: [
    skeleton({
      themes: { preset: ['skeleton', 'modern', 'vintage'] }
    })
  ]
};
