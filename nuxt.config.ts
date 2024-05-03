// https://nuxt.com/docs/api/configuration/nuxt-config
import svgLoader from 'vite-svg-loader'
export default defineNuxtConfig({
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Default Title', // Default title
      meta: [
        { hid: 'description', name: 'description', content: 'Default description' },
        { hid: 'og:title', property: 'og:title', content: 'Default Title' },
        { hid: 'og:description', property: 'og:description', content: 'Default description' },
        { hid: 'og:image', property: 'og:image', content: 'https://example.com/default-og-image.jpg' },
        // Add more default OG tags as needed
      ],
    }
  },
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxt/content'
  ],
  content: {
    
  },
  vite: {
    plugins: [
      svgLoader({
        /* options */
      })
    ]
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
})