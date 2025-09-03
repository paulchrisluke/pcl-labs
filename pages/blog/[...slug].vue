<template>
  <div class="bg-gray-900 px-6 pt-32 lg:px-8">
    <article class="mx-auto max-w-7xl">
      <!-- Tags -->
      <div v-if="blog?.tags" class="flex justify-center divide-dotted divide-x-2 space-x-2 flex-wrap">
        <h2 v-for="tag in blog.tags" :key="tag" class="text-base font-semibold leading-7 text-indigo-400 pl-2">
          {{ tag }}
        </h2>
      </div>

      <!-- Title and Description -->
      <div class="text-center">
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {{ blog?.title || 'Blog Post' }}
        </h1>
        <p class="mx-auto max-w-2xl mt-6 text-lg leading-8 text-gray-300">
          {{ blog?.description || 'Blog post description' }}
        </p>
        <!-- Date and Reading Time -->
        <div class="mx-auto max-w-2xl mt-4 text-sm leading-8 text-gray-400">
          <time v-if="blog?.date" :datetime="blog.date" class="block">
            {{ publishedDate }}
          </time>
          <span v-if="blog?.content" class="block mt-2">
            📖 {{ readingTime }} min read
          </span>
        </div>
      </div>

      <!-- Hero Image with Gradient -->
      <div v-if="blog?.imageThumbnail" class="relative overflow-hidden pt-16">
          <div class="mx-auto max-w-7xl px-6 lg:px-8">
            <img 
              :src="blog.imageThumbnail" 
              :alt="blog.title || 'PCL Labs Blog Post'" 
              class="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-white/10 w-full" 
              loading="eager"
              decoding="async"
              width="1200"
              height="675"
              fetchpriority="high"
            />
            <div class="relative" aria-hidden="true">
              <div class="absolute -inset-x-20 bottom-0 bg-gradient-to-t from-gray-900 pt-[7%]" />
            </div>
          </div>
        </div>

      <!-- Content -->
      <div class="dark:prose-invert prose mx-auto mt-8 max-w-4xl">
        <div v-if="blog?.content" v-html="formattedContent" class="text-gray-300"></div>
        <div v-else class="text-center text-gray-400">
          <p>Content loading...</p>
        </div>
      </div>
    </article>
    <div class="mt-16 border-t border-white/10 pt-8 sm:mt-20 lg:mt-24"></div>
    <CtaFull />
  </div>
</template>

<script setup>
import { useRoute, useAsyncData, createError } from 'nuxt/app'
import { computed, watch } from 'vue'

const route = useRoute()
const { fetchBlog } = useQuillApi()

// Parse the slug to get date
const parseSlug = computed(() => {
  const slugParts = route.params.slug
  if (Array.isArray(slugParts) && slugParts.length >= 1) {
    return {
      date: slugParts[0]
    }
  }
  return null
})

// Fetch the blog content from Quill API
const { data: blog, refresh } = await useAsyncData(`blog-${route.path}`, async () => {
  try {
    const slugInfo = parseSlug.value
    
    if (!slugInfo) {
      throw createError({ 
        statusCode: 400, 
        statusMessage: 'Invalid blog URL format' 
      })
    }
    
    // Fetch blog data from API
    const blogData = await fetchBlog(slugInfo.date)
    
    if (!blogData) {
      throw createError({ 
        statusCode: 404, 
        statusMessage: 'Blog not found' 
      })
    }
    
    // Use the API data directly - no transformation needed
    return {
      _id: `blog_${blogData.date}`,
      _path: route.path,
      title: blogData.frontmatter?.title || 'Blog Post',
      content: blogData.content?.raw || '',
      date: blogData.date,
      tags: blogData.frontmatter?.tags ? [blogData.frontmatter.tags] : [],
      description: blogData.frontmatter?.description || blogData.content?.raw?.substring(0, 150) + '...',
      imageThumbnail: blogData.frontmatter?.og?.['og:image'] || blogData.frontmatter?.image || '/img/blog-placeholder.jpg',
      author: blogData.frontmatter?.author || 'Paul Chris Luke',
      lead: blogData.frontmatter?.lead || ''
    }
  } catch (error) {
    // If it's already a Nuxt error, rethrow it
    if (error.statusCode) {
      throw error
    }
    
    console.error('Error fetching blog:', error)
    throw createError({ 
      statusCode: 500, 
      statusMessage: 'Error loading blog post' 
    })
  }
}, {
  // Make the key reactive to route changes
  key: `blog-${route.path}`
})

// Watch for route changes and refresh the data
watch(() => route.path, () => {
  refresh()
})

// Computed property for deterministic date formatting
const publishedDate = computed(() => {
  if (!blog.value?.date) return ''
  
  // Format with Intl.DateTimeFormat for deterministic output
  return new Intl.DateTimeFormat('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  }).format(new Date(blog.value.date))
})

// Calculate reading time
const readingTime = computed(() => {
  if (!blog.value?.content) return 0
  const wordsPerMinute = 200
  const wordCount = blog.value.content.split(/\s+/).length
  return Math.ceil(wordCount / wordsPerMinute)
})

// Format content for display (convert markdown-like content to HTML)
const formattedContent = computed(() => {
  if (!blog.value?.content) return ''
  
  // Simple markdown to HTML conversion for basic formatting
  let content = blog.value.content
  
  // Convert headers
  content = content.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>')
  content = content.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold mt-8 mb-4">$1</h2>')
  content = content.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-10 mb-5">$1</h1>')
  
  // Convert paragraphs
  content = content.replace(/^(?!<[h|ul|ol|li])(.*$)/gim, '<p class="mb-4 leading-relaxed">$1</p>')
  
  // Convert lists
  content = content.replace(/^\* (.*$)/gim, '<li class="ml-6 mb-2">$1</li>')
  content = content.replace(/(<li.*<\/li>)/s, '<ul class="list-disc mb-4">$1</ul>')
  
  // Convert bold and italic
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  content = content.replace(/\*(.*?)\*/g, '<em>$1</em>')
  
  // Convert links
  content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-indigo-400 hover:text-indigo-300 underline" target="_blank" rel="noopener noreferrer">$1</a>')
  
  // Handle embedded video tags (already in HTML format) with enhanced SEO
  content = content.replace(/<video controls src="([^"]+)"><\/video>/g, '<div class="my-8"><video controls src="$1" class="w-full rounded-lg shadow-lg" preload="metadata" poster="$1" width="800" height="450"><p>Your browser does not support the video tag.</p></video></div>')
  
  return content
})

// Enhanced SEO meta tags
useHead({
  title: blog.value ? `${blog.value.title} - PCL Labs Blog` : 'Blog - PCL Labs',
  meta: [
    // Basic meta tags
    { name: 'description', content: blog.value?.description || 'Blog post from PCL Labs' },
    { name: 'keywords', content: blog.value?.tags?.join(', ') || 'digital marketing, web development, PCL Labs' },
    { name: 'author', content: blog.value?.author || 'Paul Chris Luke' },
    { name: 'robots', content: 'index, follow, max-image-preview:large' },
    
    // Article-specific meta tags
    { name: 'article:published_time', content: blog.value?.date || '' },
    { name: 'article:author', content: blog.value?.author || 'Paul Chris Luke' },
    { name: 'article:section', content: 'Technology' },
    { name: 'article:tag', content: blog.value?.tags?.join(', ') || '' },
    
    // Open Graph meta tags
    { property: 'og:title', content: blog.value?.title || 'Blog - PCL Labs' },
    { property: 'og:description', content: blog.value?.description || 'Blog post from PCL Labs' },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: `https://paulchrisluke.com${route.path}` },
    { property: 'og:image', content: blog.value?.imageThumbnail || 'https://paulchrisluke.com/PCL-about-header.webp' },
    { property: 'og:image:alt', content: blog.value?.title || 'PCL Labs Blog Post' },
    { property: 'og:site_name', content: 'PCL Labs' },
    { property: 'og:locale', content: 'en_US' },
    
    // Twitter meta tags
    { name: 'twitter:card', content: blog.value?.imageThumbnail ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: blog.value?.title || 'Blog - PCL Labs' },
    { name: 'twitter:description', content: blog.value?.description || 'Blog post from PCL Labs' },
    { name: 'twitter:image', content: blog.value?.imageThumbnail || 'https://paulchrisluke.com/PCL-about-header.webp' },
    { name: 'twitter:image:alt', content: blog.value?.title || 'PCL Labs Blog Post' },
    { name: 'twitter:site', content: '@paulchrisluke' },
    { name: 'twitter:creator', content: '@paulchrisluke' }
  ],
  link: [
    { rel: 'canonical', href: `https://paulchrisluke.com${route.path}` }
  ]
})

// Enhanced Schema.org structured data
useHead({
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: blog.value?.title,
        description: blog.value?.description,
        image: blog.value?.imageThumbnail,
        author: {
          '@type': 'Person',
          name: blog.value?.author || 'Paul Chris Luke',
          url: 'https://paulchrisluke.com'
        },
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
        datePublished: blog.value?.date,
        dateModified: blog.value?.date,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `https://paulchrisluke.com${route.path}`
        },
        articleSection: 'Technology',
        keywords: blog.value?.tags?.join(', '),
        wordCount: blog.value?.content ? blog.value.content.length : 0
      })
    }
  ]
})
</script>
