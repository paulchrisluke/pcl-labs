<template>
    <ServiceGrid />
    <!-- TODO: INSERT BY INDUSTRY COMPONENT HERE -->
    <ProductList :portfolioData="portfolioData" />
</template>

<script setup>
import { useAsyncData } from 'nuxt/app'

useHead({
  title: 'Our Portfolio of Work',
  meta: [
    { name: 'description', content: 'Want to increase your conversions? No problem. We help brands by blending fresh ideas with proprietary direct response tools to forge deeper brand connections and more profitable conversions.' },
    { property: 'og:title', content: 'Our Portfolio of Work' },  // OG title
    { property: 'og:description', content: 'Want to increase your conversions? No problem. We help brands by blending fresh ideas with proprietary direct response tools to forge deeper brand connections and more profitable conversions.' },  // OG description
    { property: 'og:image', content: 'PCL-about-header.webp' },  // OG image URL
    { name: 'keywords', content: 'eCommerce CRO Specialists, UI Design Experts, UX Design Experts, Web Development Services, Paid Advertising Services, Shopify, web development, marketing, SEO, PCL-Labs, Paul Chris Luke' },  // Keywords for SEO
  ]
})
const { data: portfolioData } = await useAsyncData('portfolio', () =>
  queryContent('portfolio').find()
);
</script>

