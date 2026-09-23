/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        btc: {
          green: '#27AE60',
          'green-hover': '#219653',
          blue: '#1e3a8a',
          navy: '#0f172a',
          light: '#f8fafc'
        }
      },
      fontFamily: {
        sans: ['Kanit', 'Inter', 'sans-serif']
      }
    }
  }
};
