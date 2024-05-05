/** @type {import('tailwindcss').Config} */
module.exports = {
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
      require('@tailwindcss/typography'),
      // ...
    ],
  }