/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: { DEFAULT: '#F6F2EB', deep: '#EFE9DE' },
        surface: '#FFFFFF',
        ink: { DEFAULT: '#15233B', soft: '#46566F', faint: '#8B93A1' },
        line: { DEFAULT: '#E6DECF', soft: '#EFE9DC' },
        brass: { DEFAULT: '#A9772B', soft: '#C49A50', wash: '#F1E6CF' },
        ok: { DEFAULT: '#1A7F46', wash: '#E3F1E8' },
        warn: { DEFAULT: '#B0701B', wash: '#F7EAD2' },
        risk: { DEFAULT: '#A8182C', wash: '#F5DEE0' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(21,35,59,0.04), 0 8px 24px -16px rgba(21,35,59,0.18)',
        lift: '0 4px 8px rgba(21,35,59,0.06), 0 24px 48px -24px rgba(21,35,59,0.30)',
        seal: '0 0 0 1px rgba(169,119,43,0.25), 0 6px 20px -8px rgba(169,119,43,0.35)',
      },
      borderRadius: { xl2: '1.125rem' },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { 'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both' },
    },
  },
  plugins: [],
};
