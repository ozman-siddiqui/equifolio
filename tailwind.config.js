/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf4f0',
          100: '#fbe8e0',
          500: '#e8622a',
          600: '#d85a30',
          700: '#c04d25',
        }
      }
    },
  },
  plugins: [],
}