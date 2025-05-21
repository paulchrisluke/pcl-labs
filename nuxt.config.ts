import svgLoader from 'vite-svg-loader'

export default defineNuxtConfig({
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      // Todo: cleanup this fallback option https://nuxtseo.com/nuxt-seo/guides/configuring-modules
      // title: 'Default Title', // Default title
      // meta: [
      //   { hid: 'description', name: 'description', content: 'Default description' },
      //   { hid: 'og:title', property: 'og:title', content: 'Default Title' },
      //   { hid: 'og:description', property: 'og:description', content: 'Default description' },
      //   { hid: 'og:image', property: 'og:image', content: 'https://example.com/default-og-image.jpg' },
        // Add more default OG tags as needed
      // ],
    }
  },

  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxt/content',
    'nuxt-gtag',
    '@nuxtjs/sitemap',
    '@nuxtjs/seo',
  ],

  gtag: {
    id: 'G-NWGNSTDNNX'
},

  content: {
    markdown: { 'anchorLinks':false }
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
  site: {
    url: 'https://paulchrisluke.com', // Add your site's base URL here
    name: 'PCL-Labs',
    description: 'Top Rated Plus on Upwork. With over 15 years experience, PCL-Labs provides best-in-class digital and print development, design, and marketing assets to grow your business end-to-end.',
    defaultLocale: 'en',
  },
  seo: {
    redirectToCanonicalSiteUrl: true
  },
  ssr: true,
})