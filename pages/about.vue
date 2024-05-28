<template>
  <div>
    <Stats />
    <Reviews />
    <Team />
    <CtaFull />
  </div>
</template>

<script setup>

useHead({
  title: 'About Us',
  meta: [
    { name: 'description', content: 'Focused on CRO, PCL-Labs creates performant, converting websites and marketing materials. We are top rated plus on Upwork!' },
    { property: 'og:title', content: 'About Us | PCL-Labs' },  // OG title
    { property: 'og:description', content: 'My amazing site.' },  // OG description
    { property: 'og:image', content: 'https://example.com/path-to-your-image.jpg' },  // OG image URL
    { name: 'keywords', content: 'Shopify, web development, marketing, SEO, PCL-Labs, Paul Chris Luke' }  // Keywords for SEO
  ]
})
</script>