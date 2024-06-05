<template>
  <div>
    <Stats />
    <Reviews />
    <Logos />
    <Team />
    <CtaFull />
  </div>
</template>

<script setup>

useHead({
  title: 'About Us',
  meta: [
    { name: 'description', content: 'Rated in the top 1% of all agencies on Upwork. Focused on CRO, PCL-Labs creates performant, converting websites and marketing materials.' },
    { property: 'og:title', content: 'About Us' },  // OG title
    { property: 'og:description', content: 'Rated in the top 1% of all agencies on Upwork. Focused on CRO, PCL-Labs creates performant, converting websites and marketing materials.' },  // OG description
    { property: 'og:image', content: 'PCL-about-header.webp' },  // OG image URL
    { name: 'keywords', content: 'Top Rated Plus Upwork Agency, CRO Focused Agency, Conversion Rate Optimization Experts, Upwork Top Rated Agency, Experienced CRO Agency, Shopify, web development, marketing, SEO, PCL-Labs, Paul Chris Luke' }  // Keywords for SEO
  ]
})
</script>