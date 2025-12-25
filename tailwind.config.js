/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': '#3c91ff',
        'subject-cn': '#eb352f',
        'subject-math': '#f5a623',
        'subject-en': '#4a90d9',
        'subject-physics': '#50c878',
      },
      fontFamily: {
        'sans-cn': ['"Source Han Sans CN"', 'PingFang SC', 'HarmonyOS Sans SC', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '24px',
      }
    },
  },
  plugins: [],
}

