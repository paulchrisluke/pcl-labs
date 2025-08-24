<template>
    <ServiceGrid />
    <BlogList :blogData="blogData" />
</template>

<script setup>
import { useAsyncData } from 'nuxt/app'

useSeoMeta({
  title: 'Blog - PCL Labs',
  description: 'Insights, tips, and strategies for digital marketing, e-commerce optimization, and web development. Expert advice from PCL Labs to help grow your business.',
  keywords: 'digital marketing, e-commerce, web development, SEO, conversion optimization, Shopify, legal marketing, PCL-Labs, Paul Chris Luke',
  // Open Graph
  ogTitle: 'Blog - PCL Labs',
  ogDescription: 'Insights, tips, and strategies for digital marketing, e-commerce optimization, and web development. Expert advice from PCL Labs to help grow your business.',
  ogType: 'website',
  ogUrl: 'https://paulchrisluke.com/blog',
  ogImage: 'https://paulchrisluke.com/PCL-about-header.webp',
  ogImageAlt: 'PCL Labs Blog - Digital Marketing and Web Development Insights',
  // Twitter
  twitterCard: 'summary_large_image',
  twitterTitle: 'Blog - PCL Labs',
  twitterDescription: 'Insights, tips, and strategies for digital marketing, e-commerce optimization, and web development. Expert advice from PCL Labs to help grow your business.',
  twitterImage: 'https://paulchrisluke.com/PCL-about-header.webp',
  twitterImageAlt: 'PCL Labs Blog - Digital Marketing and Web Development Insights',
})

useHead({
  link: [
    { rel: 'canonical', href: 'https://paulchrisluke.com/blog' }
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
