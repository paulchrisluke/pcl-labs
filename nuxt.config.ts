import svgLoader from 'vite-svg-loader'

export default defineNuxtConfig({
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'PCL Labs', // Default title
      meta: [
        { hid: 'description', name: 'description', content: 'Top Rated Plus on Upwork. With over 15 years experience, PCL-Labs provides best-in-class digital and print development, design, and marketing assets to grow your business end-to-end.' },
        { hid: 'og:title', property: 'og:title', content: 'PCL Labs' },
        { hid: 'og:description', property: 'og:description', content: 'Top Rated Plus on Upwork. With over 15 years experience, PCL-Labs provides best-in-class digital and print development, design, and marketing assets to grow your business end-to-end.' },
        { hid: 'og:image', property: 'og:image', content: 'https://example.com/default-og-image.jpg' },
        // Add more default OG tags as needed
      ],
      // Add Google Tag Manager script
      script: [
        {
          hid: 'gtm',
          innerHTML: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-MZSRZ7C');
          `
        }
      ]
    },
    // Add Google Tag Manager (noscript) to the top of the body
    bodyPrepend: `
      <!-- Google Tag Manager (noscript) -->
      <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MZSRZ7C"
      height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
      <!-- End Google Tag Manager (noscript) -->
    `,
  },
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxt/content'
  ],
  content: {},
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