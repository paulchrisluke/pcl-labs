<template>
    <ServiceGrid />
    <BlogList :blogData="blogData" />
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
    { rel: 'canonical', href: 'https://paulchrisluke.com/blog' }
  ]
})

// Use the Quill API composable
const { getAvailableBlogs, fetchBlog } = useQuillApi()

// Fetch blog content from Quill API
const { data: blogData } = await useAsyncData('blog-all', async () => {
  try {
    // Get available blog dates
    const availableDates = await getAvailableBlogs()
    
    // Fetch all available blogs in parallel
    const allBlogs = await Promise.all(
      availableDates.map(async (date) => {
        try {
          const blogContent = await fetchBlog(date)
          if (!blogContent) return null
          
          return {
            _id: `blog_${blogContent.date}`,
            _path: `/blog/${blogContent.date}`,
            title: blogContent.frontmatter?.title || 'Blog Post',
            content: blogContent.content?.raw || '',
            date: blogContent.date,
            tags: blogContent.frontmatter?.tags || [],
            imageThumbnail: blogContent.storyImages?.[0] || 
                           blogContent.frontmatter?.og?.image || 
                           blogContent.frontmatter?.og?.['og:image'] || 
                           blogContent.frontmatter?.image || 
                           `/stories/${blogContent.date.replace(/-/g, '/')}/story_${blogContent.date.replace(/-/g, '')}_pr42_01_intro.png` ||
                           '/img/blog-placeholder.jpg',
            imageAlt: blogContent.frontmatter?.title || 'Blog Post',
            description: blogContent.frontmatter?.description || blogContent.content?.raw?.substring(0, 150) + '...',
            author: blogContent.frontmatter?.author || 'Paul Chris Luke',
            lead: blogContent.frontmatter?.lead || ''
          }
        } catch (error) {
          return null
        }
      })
    )
    
    // Filter out failed fetches and sort by date (newest first)
    const sortedBlogs = allBlogs
      .filter(Boolean)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    return sortedBlogs
    
  } catch (error) {
    return []
  }
  })
 
// Add Schema.org structured data for blog listing
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
        publisher: {
          '@type': 'Organization',
          name: 'PCL Labs',
          url: 'https://paulchrisluke.com',
          logo: {
            '@type': 'ImageObject',
            url: 'https://paulchrisluke.com/pcl-labs-logo.svg',
            width: 200,
            height: 50
          }
        },
        blogPost: blogData.value?.map(blog => ({
          '@type': 'BlogPosting',
          headline: blog.title,
          description: blog.description,
          author: {
            '@type': 'Person',
            name: blog.author
          },
          datePublished: blog.date,
          url: `https://paulchrisluke.com${blog._path}`,
          image: blog.imageThumbnail
        })) || []
      })
    }
  ]
})
</script>
