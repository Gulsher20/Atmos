/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#0E0E0E',
        paper: '#F4F0E4',
        sun: '#FFD400',
        flame: '#FF5A1F',
        sky: '#7CC6FE',
        mint: '#3DDC97',
        plum: '#A77BFF',
        smoke: '#D9D4C5',
      },
      fontFamily: {
        display: ['Anton', 'Impact', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
        body: ['"Archivo Narrow"', '"Arial Narrow"', 'sans-serif'],
      },
      boxShadow: {
        brutal: '6px 6px 0 #0E0E0E',
        'brutal-sm': '3px 3px 0 #0E0E0E',
        'brutal-lg': '10px 10px 0 #0E0E0E',
      },
      borderWidth: { 3: '3px' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(18px) rotate(-0.6deg)' }, to: { opacity: '1', transform: 'none' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        wiggle: { '0%,100%': { transform: 'rotate(0)' }, '25%': { transform: 'rotate(-8deg)' }, '75%': { transform: 'rotate(8deg)' } },
        pop: { '0%': { transform: 'scale(0.6)', opacity: '0' }, '70%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        grow: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
      },
      animation: {
        rise: 'rise 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        marquee: 'marquee 28s linear infinite',
        wiggle: 'wiggle 0.5s ease-in-out',
        pop: 'pop 0.35s ease-out both',
        grow: 'grow 0.8s cubic-bezier(0.2, 0.9, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
