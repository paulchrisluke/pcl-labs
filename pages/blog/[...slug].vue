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
      <div class="relative overflow-hidden pt-16">
        <div class="mx-auto max-w-7xl px-6 lg:px-8">
          <!-- Show actual image if available -->
          <img 
            v-if="blog?.imageThumbnail"
            :src="blog.imageThumbnail" 
            :alt="blog.title || 'PCL Labs Blog Post'" 
            class="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-white/10 w-full" 
            loading="eager"
            decoding="async"
            width="1200"
            height="675"
            fetchpriority="high"
            @error="handleImageError"
          />
          <!-- Show placeholder heroicon if no image -->
          <div 
            v-else
            class="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-white/10 w-full bg-gray-700 flex items-center justify-center"
            style="aspect-ratio: 16/9; min-height: 400px;"
          >
            <svg class="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
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
import { marked } from 'marked'

const route = useRoute()
const { getBlogMetadata, fetchBlog, fetchBlogMarkdown } = useQuillApi()

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

// Fetch the blog content from Quill API using new digest structure
const { data: blog, refresh } = await useAsyncData(`blog-${route.path}`, async () => {
  try {
    const slugInfo = parseSlug.value
    
    if (!slugInfo) {
      throw createError({ 
        statusCode: 400, 
        statusMessage: 'Invalid blog URL format' 
      })
    }
    
    // First, try to get blog metadata from the blogs list
    const blogMetadata = await getBlogMetadata(slugInfo.date)
    
    if (!blogMetadata) {
      throw createError({ 
        statusCode: 404, 
        statusMessage: 'Blog not found' 
      })
    }
    
    // Fetch full blog content from new digest endpoint
    const blogData = await fetchBlog(slugInfo.date)
    
    if (!blogData) {
      throw createError({ 
        statusCode: 404, 
        statusMessage: 'Blog content not found' 
      })
    }
    
    // Use content.body as the primary content source from the new API structure
    if (!blogData.content || !blogData.content.body) {
      throw createError({ 
        statusCode: 500, 
        statusMessage: 'Blog content structure is invalid - missing content.body' 
      })
    }
    
    const fullContent = blogData.content.body
    
    // Use the image field from API, or generate story image path if available
    let imageThumbnail = blogData.frontmatter?.og?.["og:image"] || 
                        blogData.frontmatter?.schema?.article?.image ||
                        blogData.image || 
                        blogMetadata.image
    if (blogMetadata.story_count > 0) {
      const datePath = blogMetadata.date.replace(/-/g, '/')
      const dateId = blogMetadata.date.replace(/-/g, '')
      imageThumbnail = `/stories/${datePath}/story_${dateId}_pr42_01_intro.png`
    }
    
    // Use enhanced data from new API structure - fail if required data is missing
    const title = blogData.frontmatter?.title || 
                 blogData.seo_title || 
                 blogMetadata.title
    
    if (!title) {
      throw createError({ 
        statusCode: 500, 
        statusMessage: 'Blog title is missing' 
      })
    }
    
    const description = blogData.frontmatter?.description || 
                       blogData.frontmatter?.lead || 
                       blogData.seo_description ||
                       blogMetadata.lead || 
                       blogMetadata.description
    
    if (!description) {
      throw createError({ 
        statusCode: 500, 
        statusMessage: 'Blog description is missing' 
      })
    }
    
    const tags = blogData.frontmatter?.tags || 
                blogData.keywords || 
                blogMetadata.tags || []
    const author = blogData.frontmatter?.author || 
                  blogData.author || 
                  blogMetadata.author
    
    if (!author) {
      throw createError({ 
        statusCode: 500, 
        statusMessage: 'Blog author is missing' 
      })
    }
    
    return {
      _id: `blog_${blogMetadata.date}`,
      _path: route.path,
      title,
      content: fullContent,
      date: blogMetadata.date,
      tags,
      description,
      imageThumbnail,
      author,
      lead: description,
      canonical_url: blogMetadata.canonical_url,
      story_count: blogMetadata.story_count,
      has_video: blogMetadata.has_video,
      // Enhanced SEO data from new API
      seo_title: blogData.seo_title || title,
      seo_description: blogData.seo_description || description,
      keywords: blogData.keywords || tags,
      reading_time: blogData.reading_time || blogMetadata.reading_time,
      word_count: blogData.word_count || blogMetadata.word_count,
      last_modified: blogData.last_modified || blogMetadata.last_modified || blogMetadata.date,
      category: blogData.category || blogMetadata.category,
      featured: blogData.featured || blogMetadata.featured || false,
      // Additional data from digest
      github_events: blogData.github_events || [],
      story_packets: blogData.story_packets || [],
      metadata: blogData.metadata || {},
      related_posts: blogData.related_posts || [],
      // Enhanced content structure
      table_of_contents: blogData.table_of_contents || [],
      social_shares: blogData.social_shares || {},
      analytics: blogData.analytics || {}
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

// Handle image loading errors
const handleImageError = (event) => {
  console.warn('Hero image failed to load:', event.target.src)
  // Hide the image container if the image fails to load
  event.target.style.display = 'none'
  event.target.closest('.relative').style.display = 'none'
}

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

// Format content for display using proper markdown parsing
const formattedContent = computed(() => {
  if (!blog.value?.content) return ''
  
  // Use marked library for proper markdown parsing
  // This will work with the prose classes for consistent styling
  let content = marked(blog.value.content)
  
  // Remove duplicate sections if they exist (common issue with API content)
  // This removes duplicate paragraphs that are identical
  const lines = content.split('\n')
  const uniqueLines = []
  const seenLines = new Set()
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine && !seenLines.has(trimmedLine)) {
      seenLines.add(trimmedLine)
      uniqueLines.push(line)
    } else if (!trimmedLine) {
      // Keep empty lines
      uniqueLines.push(line)
    }
  }
  
  content = uniqueLines.join('\n')
  
  // Handle embedded video tags (already in HTML format) with enhanced SEO
  content = content.replace(/<video controls src="([^"]+)"><\/video>/g, (match, src) => {
    // Generate poster image path from video path
    const posterPath = src.replace(/\.(mp4|webm|ogg)$/, '_poster.jpg')
    return `<div class="my-8"><video controls src="${src}" class="w-full rounded-lg shadow-lg" preload="metadata" poster="${posterPath}" width="800" height="450"><p>Your browser does not support the video tag.</p></video></div>`
  })
  
  return content
})

// Enhanced SEO meta tags using new API structure
useHead({
  title: blog.value ? `${blog.value.seo_title || blog.value.title} - PCL Labs Blog` : 'Blog - PCL Labs',
  meta: [
    // Basic meta tags with enhanced SEO data
    { name: 'description', content: blog.value?.seo_description || blog.value?.description || 'Blog post from PCL Labs' },
    { name: 'keywords', content: blog.value?.keywords?.join(', ') || blog.value?.tags?.join(', ') || 'digital marketing, web development, PCL Labs' },
    { name: 'author', content: blog.value?.author || 'Paul Chris Luke' },
    { name: 'robots', content: 'index, follow, max-image-preview:large' },
    
    // Article-specific meta tags with enhanced data
    { name: 'article:published_time', content: blog.value?.date || '' },
    { name: 'article:modified_time', content: blog.value?.last_modified || blog.value?.date || '' },
    { name: 'article:author', content: blog.value?.author || 'Paul Chris Luke' },
    { name: 'article:section', content: blog.value?.category || 'Technology' },
    { name: 'article:tag', content: blog.value?.keywords?.join(', ') || blog.value?.tags?.join(', ') || '' },
    { name: 'article:reading_time', content: blog.value?.reading_time?.toString() || '' },
    { name: 'article:word_count', content: blog.value?.word_count?.toString() || '' },
    
    // Open Graph meta tags with enhanced data
    { property: 'og:title', content: blog.value?.seo_title || blog.value?.title || 'Blog - PCL Labs' },
    { property: 'og:description', content: blog.value?.seo_description || blog.value?.description || 'Blog post from PCL Labs' },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: blog.value?.canonical_url || `https://paulchrisluke.com${route.path}` },
    { property: 'og:image', content: blog.value?.imageThumbnail || 'https://paulchrisluke.com/PCL-about-header.webp' },
    { property: 'og:image:alt', content: blog.value?.title || 'PCL Labs Blog Post' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '675' },
    { property: 'og:site_name', content: 'PCL Labs' },
    { property: 'og:locale', content: 'en_US' },
    { property: 'og:updated_time', content: blog.value?.last_modified || blog.value?.date || '' },
    
    // Twitter meta tags with enhanced data
    { name: 'twitter:card', content: blog.value?.imageThumbnail ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: blog.value?.seo_title || blog.value?.title || 'Blog - PCL Labs' },
    { name: 'twitter:description', content: blog.value?.seo_description || blog.value?.description || 'Blog post from PCL Labs' },
    { name: 'twitter:image', content: blog.value?.imageThumbnail || 'https://paulchrisluke.com/PCL-about-header.webp' },
    { name: 'twitter:image:alt', content: blog.value?.title || 'PCL Labs Blog Post' },
    { name: 'twitter:site', content: '@paulchrisluke' },
    { name: 'twitter:creator', content: '@paulchrisluke' },
    
    // Additional SEO meta tags
    { name: 'news_keywords', content: blog.value?.keywords?.join(', ') || blog.value?.tags?.join(', ') || '' },
    { name: 'geo.region', content: 'US' },
    { name: 'geo.placename', content: 'United States' },
    { name: 'language', content: 'en' }
  ],
  link: [
    { rel: 'canonical', href: blog.value?.canonical_url || `https://paulchrisluke.com${route.path}` },
    { rel: 'alternate', type: 'application/rss+xml', title: 'PCL Labs Blog RSS Feed', href: 'https://paulchrisluke.com/rss.xml' }
  ]
})

// Enhanced Schema.org structured data using new API structure
useHead({
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: blog.value?.seo_title || blog.value?.title,
        description: blog.value?.seo_description || blog.value?.description,
        image: {
          '@type': 'ImageObject',
          url: blog.value?.imageThumbnail,
          width: 1200,
          height: 675,
          alt: blog.value?.title
        },
        author: {
          '@type': 'Person',
          name: blog.value?.author || 'Paul Chris Luke',
          url: 'https://paulchrisluke.com',
          sameAs: [
            'https://twitter.com/paulchrisluke',
            'https://github.com/paulchrisluke',
            'https://linkedin.com/in/paulchrisluke'
          ]
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
          },
          sameAs: [
            'https://twitter.com/paulchrisluke',
            'https://github.com/paulchrisluke'
          ]
        },
        datePublished: blog.value?.date,
        dateModified: blog.value?.last_modified || blog.value?.date,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': blog.value?.canonical_url || `https://paulchrisluke.com${route.path}`
        },
        articleSection: blog.value?.category || 'Technology',
        keywords: blog.value?.keywords?.join(', ') || blog.value?.tags?.join(', '),
        wordCount: blog.value?.word_count || (blog.value?.content ? blog.value.content.length : 0),
        timeRequired: blog.value?.reading_time ? `PT${blog.value.reading_time}M` : undefined,
        inLanguage: 'en-US',
        isPartOf: {
          '@type': 'Blog',
          name: 'PCL Labs Blog',
          url: 'https://paulchrisluke.com/blog'
        },
        // Enhanced structured data
        about: blog.value?.tags?.map(tag => ({
          '@type': 'Thing',
          name: tag
        })) || [],
        mentions: blog.value?.github_events?.map(event => ({
          '@type': 'Event',
          name: event.title || 'GitHub Event',
          description: event.description
        })) || [],
        // Social sharing data
        interactionStatistic: blog.value?.social_shares ? Object.entries(blog.value.social_shares).map(([platform, count]) => ({
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/ShareAction',
          userInteractionCount: count,
          name: platform
        })) : []
      })
    }
  ]
})
</script>
