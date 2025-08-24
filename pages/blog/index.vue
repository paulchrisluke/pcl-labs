<template>
    <ServiceGrid />
    <BlogList :blogData="blogData" />
</template>

<script setup>
import { useAsyncData } from 'nuxt/app'

useHead({
  title: 'Blog - PCL Labs',
  meta: [
    { name: 'description', content: 'Insights, tips, and strategies for digital marketing, e-commerce optimization, and web development. Expert advice from PCL Labs to help grow your business.' },
    { property: 'og:title', content: 'Blog - PCL Labs' },
    { property: 'og:description', content: 'Insights, tips, and strategies for digital marketing, e-commerce optimization, and web development. Expert advice from PCL Labs to help grow your business.' },
    { property: 'og:image', content: 'PCL-about-header.webp' },
    { name: 'keywords', content: 'digital marketing, e-commerce, web development, SEO, conversion optimization, Shopify, legal marketing, PCL-Labs, Paul Chris Luke' },
  ]
})

// Fetch blog content using queryContent composable
const { data: blogData } = await useAsyncData('blog-all', async () => {
  try {
    console.log('Starting blog content query...');
    
    // Get blog content using queryContent (Nuxt 3 syntax)
    const blogContent = await queryContent('blog').sort({ date: -1 }).find();
    console.log('Blog content length:', blogContent?.length);
    console.log('Blog content:', blogContent);
    
    return blogContent;
  } catch (error) {
    console.error('Blog content query error:', error);
    return [];
  }
});

console.log('Final blog data:', blogData.value);
</script>
