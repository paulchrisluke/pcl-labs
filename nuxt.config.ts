import svgLoader from 'vite-svg-loader'

export default defineNuxtConfig({
  compatibilityDate: '2025-08-24',
  runtimeConfig: {
    // Private keys (only available on server-side)
    twitchClientSecret: process.env.TWITCH_CLIENT_SECRET,
    public: {
      twitchClientId: process.env.TWITCH_CLIENT_ID,
      twitchBroadcasterId: process.env.TWITCH_BROADCASTER_ID,
    }
  },
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'shortcut icon', type: 'image/x-icon', href: '/favicon.ico' }
      ],
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
    '@nuxtjs/seo',
  ],

  gtag: {
    id: 'G-NWGNSTDNNX'
},




  vite: {
    plugins: [
      svgLoader({
        /* options */
      })
    ],
    define: {
      // Suppress deprecation warnings
      'process.env.NODE_NO_WARNINGS': '1'
    }
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
    redirectToCanonicalSiteUrl: false
  },
  ssr: true,
  nitro: {
    prerender: {
      routes: [
        '/blog'  // make /blog a static page (no function)
      ]
    },
    // Add timeout configuration to prevent gateway timeouts
    routeRules: {
      // ISR only for individual posts under /blog/**
      '/blog/**': { 
        isr: 300, // Cache individual blog posts for 5 minutes
        headers: { 'cache-control': 's-maxage=300' }
      }
    }
  }
})