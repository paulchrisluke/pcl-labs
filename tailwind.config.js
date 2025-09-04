/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'

export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
  ],
  theme: {
    extend: {
      //   fontFamily: {
      //     bitter: ['Montserrat', 'sans-serif',],
      // },
    },
  },
  plugins: [
    typography,
    require('@tailwindcss/line-clamp'),
  ],
}