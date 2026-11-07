/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#22c55e', 600: '#16a34a' },
        navy: { 900: '#0f172a', 950: '#020617' }
      }
    }
  },
  plugins: []
};
