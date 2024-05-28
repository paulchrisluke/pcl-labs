<template>
  <div>
    <!-- <Hero /> -->
    <!-- TODO: INSERT BY INDUSTRY COMPONENT HERE -->
    <ServiceGrid id="Services" />
    <ProductList :limit="4" />
    <Logos />
    <Stats />
    <Reviews />
    <Team />
    <CtaFull />
  </div>
</template>
<script setup>


useHead({
  title: 'Increase Your Conversions with Web PCL-Labs',
  meta: [
    { name: 'description', content: 'My amazing site.' },
    { property: 'og:title', content: 'Increase Your Conversions with Web PCL-Labs' },  // OG title
    { property: 'og:description', content: 'My amazing site.' },  // OG description
    { property: 'og:image', content: 'https://example.com/path-to-your-image.jpg' },  // OG image URL
    { name: 'keywords', content: 'Shopify, web development, marketing, SEO, PCL-Labs, Paul Chris Luke' }  // Keywords for SEO
  ]
})
</script>
