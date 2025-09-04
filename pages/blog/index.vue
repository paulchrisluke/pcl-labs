<template>
    <ServiceGrid />
    <div v-if="pending" class="bg-white py-16">
      <div class="mx-auto max-w-2xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p class="mt-4 text-gray-600">Loading blog posts...</p>
        </div>
      </div>
    </div>
    <BlogList v-else-if="blogData && blogData.length > 0" :blogData="blogData" />
    <div v-else-if="error" class="bg-white py-16">
      <div class="mx-auto max-w-2xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
        <div class="text-center">
          <p class="text-red-600">Error loading blog posts. Please try again later.</p>
        </div>
      </div>
    </div>
    <div v-else class="bg-white py-16">
      <div class="mx-auto max-w-2xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
        <div class="text-center">
          <p class="text-gray-600">No blog posts available.</p>
        </div>
      </div>
    </div>
</template>

<script setup>
import { useAsyncData } from 'nuxt/app'
import { useSeoMeta } from '#imports'
import { useQuillApi } from '~/composables/useQuillApi'

useSeoMeta({
  title: 'Blog - PCL Labs',
  description: 'Insights, tips, and strategies for digital marketing, e-commerce optimization, and web development. Expert advice from PCL Labs to help grow your business.',
  keywords: 'digital marketing, e-commerce, web development, SEO, conversion optimization, Shopify, legal marketing, PCL-Labs, Paul Chris Luke, AI automation, content generation',
  // Open Graph
  ogTitle: 'Blog - PCL Labs',
  ogDescription: 'Insights, tips, and strategies for digital marketing, e-commerce optimization, and web development. Expert advice from PCL Labs to help grow your business.',
  ogType: 'website',
  ogUrl: 'https://paulchrisluke.com/blog',
  ogImage: 'https://paulchrisluke.com/PCL-about-header.webp',
  ogImageAlt: 'PCL Labs Blog - Digital Marketing and Web Development Insights',
  ogImageWidth: '1200',
  ogImageHeight: '675',
  ogSiteName: 'PCL Labs',
  ogLocale: 'en_US',
  // Twitter
  twitterCard: 'summary_large_image',
  twitterTitle: 'Blog - PCL Labs',
  twitterDescription: 'Insights, tips, and strategies for digital marketing, e-commerce optimization, and web development. Expert advice from PCL Labs to help grow your business.',
  twitterImage: 'https://paulchrisluke.com/PCL-about-header.webp',
  twitterImageAlt: 'PCL Labs Blog - Digital Marketing and Web Development Insights',
  twitterSite: '@paulchrisluke',
  twitterCreator: '@paulchrisluke'
})

useHead({
  link: [
    { rel: 'canonical', href: 'https://paulchrisluke.com/blog' },
    { rel: 'alternate', type: 'application/rss+xml', title: 'PCL Labs Blog RSS Feed', href: 'https://paulchrisluke.com/rss.xml' },
    { rel: 'sitemap', type: 'application/xml', title: 'Sitemap', href: 'https://paulchrisluke.com/sitemap.xml' }
  ],
  meta: [
    { name: 'robots', content: 'index, follow, max-image-preview:large' },
    { name: 'language', content: 'en' },
    { name: 'geo.region', content: 'US' },
    { name: 'geo.placename', content: 'United States' },
    { name: 'news_keywords', content: 'digital marketing, e-commerce, web development, SEO, conversion optimization, Shopify, legal marketing, PCL-Labs, Paul Chris Luke, AI automation, content generation' }
  ]
})

// Use the Quill API composable
const { getAvailableBlogs } = useQuillApi()

// Fetch blog content from Quill API
const { data: blogData, pending, error } = await useAsyncData('blog-all', async () => {
  const { getAvailableBlogs } = useQuillApi()
  const response = await $fetch('https://api.paulchrisluke.com/blogs')
  
  // Use the blogPost array which has the images
  const blogs = response.blogPost || []
  
  // Simple transformation - add path and use the image from blogPost
  return blogs.map((blog, index) => ({
    date: blog.datePublished,
    title: blog.headline,
    description: blog.description,
    author: blog.author.name,
    canonical_url: blog.url,
    tags: [], // Not available in blogPost array
    _path: `/blog/${blog.datePublished}`,
    imageThumbnail: blog.image
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})
 
// Add enhanced Schema.org structured data for blog listing
useHead({
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'PCL Labs Blog',
        description: 'Insights, tips, and strategies for digital marketing, e-commerce optimization, and web development.',
        url: 'https://paulchrisluke.com/blog',
        inLanguage: 'en-US',
        publisher: {
          '@type': 'Organization',
          name: 'PCL Labs',
          url: 'https://paulchrisluke.com',
          logo: {
            '@type': 'ImageObject',
            url: 'https://paulchrisluke.com/pcl-labs-logo.svg',
            width: 200,
            height: 50
          },
          sameAs: [
            'https://twitter.com/paulchrisluke',
            'https://github.com/paulchrisluke'
          ]
        },
        author: {
          '@type': 'Person',
          name: 'Paul Chris Luke',
          url: 'https://paulchrisluke.com',
          sameAs: [
            'https://twitter.com/paulchrisluke',
            'https://github.com/paulchrisluke',
            'https://linkedin.com/in/paulchrisluke'
          ]
        },
        blogPost: blogData.value?.map(blog => ({
          '@type': 'BlogPosting',
          headline: blog.title,
          description: blog.description,
          author: {
            '@type': 'Person',
            name: blog.author,
            url: 'https://paulchrisluke.com'
          },
          datePublished: blog.date,
          url: `https://paulchrisluke.com${blog._path}`,
          image: blog.image
        })) || [],
        // Additional blog metadata
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://paulchrisluke.com/blog?q={search_term_string}'
          },
          'query-input': 'required name=search_term_string'
        }
      })
    }
  ]
})
</script>
