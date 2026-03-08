<template>
  <div>
    <!-- <Hero /> -->
    <!-- TODO: INSERT BY INDUSTRY COMPONENT HERE -->
    <ServiceGrid id="Services" />
    <ProductList :portfolioData="portfolioData" :limit="4" />
    <Logos />
    <Stats />
    <Reviews />
    <Team />
    <CtaFull />
  </div>
</template>
<script setup>
import { useAsyncData } from 'nuxt/app'

// Fetch portfolio data for the home page
const { data: portfolioData } = await useAsyncData('home-portfolio', async () => {
  try {
    console.log('Fetching portfolio data for home page...');
    const result = await queryContent('portfolio').limit(4).find();
    console.log('Home page portfolio data:', result);
    return result;
  } catch (error) {
    console.error('Error fetching portfolio data for home:', error);
    return [];
  }
});

useHead({
  title: 'Increase Your Conversions with Web PCL-Labs',
  meta: [
    { name: 'description', content: 'My amazing site.' },
    { property: 'og:title', content: 'Increase Your Conversions with Web PCL-Labs' },  // OG title
    { property: 'og:description', content: 'Top Rated Plus on Upwork. With over 15 years experience, PCL-Labs provides best-in-class digital and print development, design, and marketing assets to grow your business end-to-end.' },  // OG description
    { property: 'og:image', content: '/pcl-labs-logo.svg' },  // OG image URL
    { name: 'keywords', content: 'Shopify, web development, marketing, SEO, PCL-Labs, Paul Chris Luke' }  // Keywords for SEO
  ]
})
</script>
