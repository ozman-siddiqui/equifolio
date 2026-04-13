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
          50: '#E8F6EF',
          100: '#DCEFE5',
          500: '#1D9E75',
          600: '#19C37D',
          700: '#0F6E56',
        }
      }
    },
  },
  plugins: [],
}
