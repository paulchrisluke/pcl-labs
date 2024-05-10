<template>
    <ServiceGrid />
    <ProductList :portfolioData="portfolioData" />
</template>

<script setup>
import { useAsyncData } from 'nuxt/app'
useHead({
  title: 'Our Portfolio of Work | PCL-Labs',
  meta: [
    { name: 'description', content: 'Want to increase your conversions? No problem. We help brands by blending fresh ideas with proprietary direct response tools to forge deeper brand connections and more profitable conversions.' },
    { property: 'og:title', content: 'Our Portfolio of Work | PCL-Labs' },  // OG title
    { property: 'og:description', content: 'Want to increase your conversions? No problem. We help brands by blending fresh ideas with proprietary direct response tools to forge deeper brand connections and more profitable conversions.' },  // OG description
    { property: 'og:image', content: 'https://example.com/path-to-your-image.jpg' }  // OG image URL
  ]
})
const { data: portfolioData } = await useAsyncData('portfolio', () =>
  queryContent('portfolio').find()
);
</script>

