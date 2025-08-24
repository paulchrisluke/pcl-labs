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
        <!-- Date -->
        <time v-if="blog?.date" :datetime="normalizedDateString" class="mx-auto max-w-2xl mt-4 text-sm leading-8 text-gray-400 block">
          {{ publishedDate }}
        </time>
      </div>

      <!-- Image with Gradient -->
      <div v-if="blog?.image" class="relative overflow-hidden pt-16">
          <div class="mx-auto max-w-7xl px-6 lg:px-8">
            <img :src="blog.image" :alt="blog.imageAlt || 'PCL Labs Blog Post'" class="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-white/10" width="2432" height="1442" />
            <div class="relative" aria-hidden="true">
              <div class="absolute -inset-x-20 bottom-0 bg-gradient-to-t from-gray-900 pt-[7%]" />
            </div>
          </div>
        </div>

      <!-- Content (Optional) -->
      <ContentDoc class="dark:prose-invert prose mx-auto mt-8" />
    </article>
    <div class="mt-16 border-t border-white/10 pt-8 sm:mt-20 lg:mt-24"></div>
    <CtaFull />
  </div>
</template>

<script setup>
import { useRoute, useAsyncData, createError } from 'nuxt/app'
import { computed } from 'vue'

const route = useRoute()

// Make contentPath reactive by computing it from route.path
const contentPath = computed(() => route.path)

// Fetch the markdown content based on the slug using queryContent
const { data: blog } = await useAsyncData(`blog-${route.path}`, async () => {
  try {
    const result = await queryContent(contentPath.value).findOne()
    
    // Check if blog post exists, if not throw 404 error
    if (!result) {
      throw createError({ 
        statusCode: 404, 
        statusMessage: 'Blog post not found' 
      })
    }
    
    // Only log in development
    if (process.dev) {
      console.log('Blog data:', result)
    }
    return result
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
  // Use watch option to automatically refetch on route changes
  watch: [contentPath]
})

// Helper function to normalize date strings
const normalizeDateString = (dateString) => {
  if (!dateString) return ''
  
  // If it matches date-only format (YYYY-MM-DD), convert to UTC midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return `${dateString}T00:00:00Z`
  }
  // If it contains 'T' but no timezone indicator, append 'Z'
  else if (dateString.includes('T') && !/[Zz]|[+-]\d{2}:\d{2}$/.test(dateString)) {
    return `${dateString}Z`
  }
  // Otherwise leave as-is
  return dateString
}

// Computed property for normalized date string (for datetime attribute)
const normalizedDateString = computed(() => {
  if (!blog.value?.date) return ''
  return normalizeDateString(blog.value.date)
})

// Computed property for deterministic date formatting
const publishedDate = computed(() => {
  if (!blog.value?.date) return ''
  
  // Format with Intl.DateTimeFormat for deterministic output
  return new Intl.DateTimeFormat('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    timeZone: 'UTC' 
  }).format(new Date(normalizedDateString.value))
})

useHead({
  title: blog.value ? `${blog.value.title} - PCL Labs Blog` : 'Blog - PCL Labs',
  meta: [
    { name: 'description', content: blog.value?.description || 'Blog post from PCL Labs' },
    { name: 'keywords', content: blog.value?.keywords || '' },
    // Open Graph meta tags
    { property: 'og:title', content: blog.value?.title || 'Blog - PCL Labs' },
    { property: 'og:description', content: blog.value?.description || 'Blog post from PCL Labs' },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: `https://paulchrisluke.com${route.path}` },
    { property: 'og:image', content: blog.value?.image || 'https://paulchrisluke.com/PCL-about-header.webp' },
    { property: 'og:image:alt', content: blog.value?.imageAlt || 'PCL Labs Blog Post' },
    // Twitter meta tags
    { name: 'twitter:card', content: blog.value?.image ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: blog.value?.title || 'Blog - PCL Labs' },
    { name: 'twitter:description', content: blog.value?.description || 'Blog post from PCL Labs' },
    { name: 'twitter:image', content: blog.value?.image || 'https://paulchrisluke.com/PCL-about-header.webp' },
    { name: 'twitter:image:alt', content: blog.value?.imageAlt || 'PCL Labs Blog Post' }
  ],
  link: [
    { rel: 'canonical', href: `https://paulchrisluke.com${route.path}` }
  ]
})
</script>
