<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
    <!-- Hero Section -->
    <div class="relative overflow-hidden pt-20 pb-16">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="text-center">
          <h1 class="text-4xl font-bold tracking-tight text-white sm:text-6xl">
            PCL Labs <span class="text-indigo-400">Blog</span>
          </h1>
          <p class="mt-6 text-lg leading-8 text-gray-300 max-w-2xl mx-auto">
            Insights, strategies, and cutting-edge solutions for digital marketing, e-commerce, and web development.
          </p>
        </div>
      </div>
    </div>

    <!-- Hashtag Filter Section -->
    <div class="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700">
      <div class="mx-auto max-w-7xl px-6 lg:px-8 py-4">
        <div class="flex flex-wrap gap-2 justify-center">
          <button
            @click="selectedTag = null"
            :class="[
              'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
              selectedTag === null
                ? 'bg-indigo-500 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            ]"
          >
            # All Posts
          </button>
          <button
            v-for="tag in allTags"
            :key="tag"
            @click="selectedTag = tag"
            :class="[
              'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
              selectedTag === tag
                ? 'bg-indigo-500 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            ]"
          >
            # {{ tag }}
          </button>
        </div>
      </div>
    </div>

    <!-- Blog Grid - Instagram Reels Style -->
    <div class="mx-auto max-w-7xl px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div
          v-for="post in filteredBlogs"
          :key="post._id"
          class="group relative"
        >
          <!-- Card Container -->
          <div class="relative aspect-[9/16] rounded-2xl overflow-hidden bg-gray-800 shadow-2xl group-hover:shadow-indigo-500/25 transition-shadow duration-300 group-hover:scale-105 transform-gpu">
            <!-- Image -->
            <div class="absolute inset-0">
              <img
                :src="post.imageThumbnail"
                :alt="post.title"
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 transform-gpu"
                @error="handleImageError"
              />
              <!-- Gradient Overlay -->
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            </div>

            <!-- Content Overlay -->
            <div class="absolute inset-0 flex flex-col justify-end p-6">
              <!-- Tags -->
              <div class="relative mb-3 tag-expansion">
                <!-- Primary Tags (always visible) -->
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="tag in getPrioritizedTags(post).slice(0, 2)"
                    :key="tag.name"
                    class="tag-pill px-2 py-1 bg-indigo-500/80 backdrop-blur-sm rounded-full text-xs font-medium text-white cursor-pointer hover:bg-indigo-400/80 transition-all duration-200"
                    @click.stop="selectedTag = tag.name"
                  >
                    # {{ tag.name }}
                  </span>
                  
                  <!-- More Tags Indicator -->
                  <span
                    v-if="getPrioritizedTags(post).length > 2"
                    class="tag-pill px-2 py-1 bg-gray-600/80 backdrop-blur-sm rounded-full text-xs font-medium text-gray-300 cursor-pointer hover:bg-gray-500/80 transition-all duration-200"
                    @click.stop="toggleTagExpansion(post._id)"
                  >
                    +{{ getPrioritizedTags(post).length - 2 }}
                  </span>
                </div>

                <!-- Expanded Tags Overlay (on hover or click) -->
                <div
                  v-if="expandedTags[post._id]"
                  class="tag-expansion-overlay absolute bottom-full left-0 right-0 mb-2 p-3 bg-black/90 backdrop-blur-sm rounded-lg border border-gray-600/50 shadow-2xl"
                >
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="tag in getPrioritizedTags(post)"
                      :key="tag.name"
                      class="tag-pill px-2 py-1 bg-indigo-500/80 backdrop-blur-sm rounded-full text-xs font-medium text-white cursor-pointer hover:bg-indigo-400/80 transition-all duration-200"
                      @click.stop="selectedTag = tag.name"
                    >
                      # {{ tag.name }}
                      <span v-if="tag.frequency > 1" class="ml-1 text-xs opacity-75">({{ tag.frequency }})</span>
                    </span>
                  </div>
                  <!-- Close button -->
                  <button
                    @click.stop="toggleTagExpansion(post._id)"
                    class="absolute top-1 right-1 w-5 h-5 bg-gray-600/80 hover:bg-gray-500/80 rounded-full flex items-center justify-center transition-colors duration-200"
                  >
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Title -->
              <h3 class="text-white font-bold text-lg leading-tight mb-2 line-clamp-2">
                {{ post.title }}
              </h3>

              <!-- Meta Info -->
              <div class="flex items-center justify-between text-sm text-gray-300">
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
                  </svg>
                  {{ getReadingTime(post) }} min
                </span>
                <span>{{ formatDate(post.date) }}</span>
              </div>
            </div>

            <!-- Hover Overlay -->
            <div class="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div class="text-white text-center">
                <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                  </svg>
                </div>
                <p class="text-sm font-medium">Read More</p>
              </div>
            </div>

            <!-- Link -->
            <nuxt-link
              :to="post._path"
              class="absolute inset-0 z-10"
              :aria-label="`Read post: ${post.title}`"
            />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredBlogs.length === 0" class="text-center py-16">
        <div class="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-300 mb-2">No posts found</h3>
        <p class="text-gray-400">Try selecting a different hashtag or check back later.</p>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-gray-800/50 border-t border-gray-700">
      <div class="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div class="text-center">
          <h2 class="text-3xl font-bold text-white mb-4">Ready to grow your business?</h2>
          <p class="text-gray-300 mb-8 max-w-2xl mx-auto">
            Let's discuss how PCL Labs can help you achieve your digital marketing and development goals.
          </p>
          <nuxt-link
            to="/contact"
            class="inline-flex items-center gap-2 px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-full transition-colors duration-200"
          >
            Get Started
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </nuxt-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAsyncData } from 'nuxt/app'
import { useSeoMeta } from '#imports'
import { useMockBlog } from '~/composables/useMockBlog'

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

// Use the mock blog composable
const { fetchAllBlogs } = useMockBlog()

// Fetch blog content from mock data
const { data: blogData } = await useAsyncData('blog-all', async () => {
  try {
    return await fetchAllBlogs()
  } catch (error) {
    console.error('Error fetching blogs:', error)
    return []
  }
  })

// Reactive state for filtering
const selectedTag = ref(null)
const expandedTags = ref({})

// Get all unique tags from all blog posts
const allTags = computed(() => {
  if (!blogData.value) return []
  const tags = new Set()
  blogData.value.forEach(post => {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => tags.add(tag))
    }
  })
  return Array.from(tags).sort()
})

// Calculate tag frequency across all posts for prioritization
const tagFrequency = computed(() => {
  if (!blogData.value) return new Map()
  const frequency = new Map()
  blogData.value.forEach(post => {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => {
        frequency.set(tag, (frequency.get(tag) || 0) + 1)
      })
    }
  })
  return frequency
})

// Get prioritized tags for a specific post
const getPrioritizedTags = (post) => {
  if (!post.tags || !Array.isArray(post.tags)) return []
  
  return post.tags
    .map(tag => ({
      name: tag,
      frequency: tagFrequency.value.get(tag) || 0
    }))
    .sort((a, b) => {
      // Sort by frequency (descending), then alphabetically
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency
      }
      return a.name.localeCompare(b.name)
    })
}

// Filter blogs based on selected tag
const filteredBlogs = computed(() => {
  if (!blogData.value) return []
  if (!selectedTag.value) return blogData.value
  return blogData.value.filter(post => 
    post.tags && post.tags.includes(selectedTag.value)
  )
})

// Helper functions
const getReadingTime = (post) => {
  if (post.wordCount) {
    return Math.ceil(post.wordCount / 200)
  }
  if (post.content) {
    const wordCount = post.content.split(/\s+/).length
    return Math.ceil(wordCount / 200)
  }
  return 1
}

const formatDate = (dateString) => {
  try {
    const date = new Date(dateString)
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      // Return the original dateString as fallback, or a localized "Invalid date" if dateString is empty/falsy
      return dateString || 'Invalid date'
    }
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  } catch (error) {
    // Handle unexpected exceptions by returning the original dateString or fallback
    return dateString || 'Invalid date'
  }
}

const handleImageError = (event) => {
  const target = event.target
  const currentSrc = target.src
  
  // Prevent infinite loop: if current src is already a fallback or data URI, remove error listener
  if (currentSrc.includes('blog-placeholder.jpg') || 
      currentSrc.startsWith('data:image')) {
    target.removeEventListener('error', handleImageError)
    return
  }
  
  // Try primary fallback first (existing header image)
  if (!currentSrc.includes('PCL-about-header.webp')) {
    target.src = '/PCL-about-header.webp'
    return
  }
  
  // Ultimate fallback: simple data URI placeholder (when header image also fails)
  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIFVuYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg=='
  target.removeEventListener('error', handleImageError)
}

// Toggle tag expansion for a specific post
const toggleTagExpansion = (postId) => {
  expandedTags.value[postId] = !expandedTags.value[postId]
}

// Close all expanded tags when clicking outside
const closeAllExpandedTags = () => {
  expandedTags.value = {}
}

// Close expanded tags when a tag is selected
watch(selectedTag, () => {
  closeAllExpandedTags()
})

// Add click outside handler
let clickOutsideHandler = null

onMounted(() => {
  clickOutsideHandler = (event) => {
    // Check if click is outside any tag expansion area
    const isTagExpansion = event.target.closest('.tag-expansion')
    if (!isTagExpansion) {
      closeAllExpandedTags()
    }
  }
  document.addEventListener('click', clickOutsideHandler)
})

onUnmounted(() => {
  if (clickOutsideHandler) {
    document.removeEventListener('click', clickOutsideHandler)
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
