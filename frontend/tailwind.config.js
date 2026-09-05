/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Reads from CSS variables (set in index.css, overridden at runtime by
        // SettingsContext) instead of fixed hex values, so every bg-brand-600,
        // text-brand-900, etc. class repaints when the superadmin picks a new
        // color in Settings - no rebuild needed.
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)'
        }
      }
    }
  },
  plugins: []
};
