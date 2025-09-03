<template>
    <ServiceGrid />
    <BlogList :blogData="blogData" />
</template>

<script setup>
import { useAsyncData } from 'nuxt/app'

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
    console.log('Starting Quill API blog content fetch...');
    
    // Get available blog dates
    const availableDates = await getAvailableBlogs()
    console.log('Available blog dates:', availableDates);
    
    // Fetch all available blogs
    const allBlogs = []
    for (const date of availableDates) {
      try {
        const blogContent = await fetchBlog(date)
        // Use the API data directly - no transformation needed
        const blogPost = {
          _id: `blog_${blogContent.date}`,
          _path: `/blog/${blogContent.date}`,
          title: blogContent.frontmatter?.title || 'Blog Post',
          content: blogContent.content?.raw || '',
          date: blogContent.date,
          tags: blogContent.frontmatter?.tags ? [blogContent.frontmatter.tags] : [],
          imageThumbnail: blogContent.frontmatter?.image || '/img/blog-placeholder.jpg',
          imageAlt: blogContent.frontmatter?.title || 'Blog Post',
          description: blogContent.frontmatter?.description || blogContent.content?.raw?.substring(0, 150) + '...',
          author: blogContent.frontmatter?.author || 'Paul Chris Luke',
          lead: blogContent.frontmatter?.lead || ''
        }
        allBlogs.push(blogPost)
      } catch (error) {
        console.error(`Error fetching blog for ${date}:`, error)
        // Continue with other dates if one fails
      }
    }
    
    // Sort by date (newest first)
    const sortedBlogs = allBlogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    console.log('Blog content length:', sortedBlogs?.length);
    console.log('Blog content:', sortedBlogs);
    
    return sortedBlogs;
  } catch (error) {
    console.error('Blog content fetch error:', error);
    return [];
  }
});

console.log('Final blog data:', blogData.value);

// Add Schema.org structured data for blog listing
useJsonld(() => ({
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
}))
</script>
