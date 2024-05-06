import svgLoader from 'vite-svg-loader'

export default defineNuxtConfig({
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Increase Your Conversions with Web PCL-Labs', // Default title
      meta: [
        { hid: 'description', name: 'description', content: 'Default description' },
        { hid: 'og:title', property: 'og:title', content: 'Increase Your Conversions with Web PCL-Labs' },
        { hid: 'og:description', property: 'og:description', content: 'Default description' },
        { hid: 'og:image', property: 'og:image', content: 'https://example.com/default-og-image.jpg' },
        // Add more default OG tags as needed
      ],
    }
  },

  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxt/content',
    'nuxt-gtag',
    '@nuxtjs/sitemap',
  ],

  gtag: {
    id: 'G-NWGNSTDNNX'
  },

  content: {
    markdown: { 'anchorLinks': false },
    documentDriven: true
  },

  sitemap: {
    hostname: 'https://paulchrisluke.com',
    gzip: true,
    routes: async () => {
      const { $content } = require('@nuxt/content')
      const portfolios = await $content('portfolio').fetch()
      return portfolios.map(portfolio => ({
        url: `/portfolio/${portfolio.slug}`,
        lastmod: portfolio.updatedAt,
        img: [
          {
            url: portfolio.image,
            title: portfolio.title,
            caption: portfolio.imageAlt,
            license: 'https://paulchrisluke.com/terms'
          }
        ]
      }))
    }
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
