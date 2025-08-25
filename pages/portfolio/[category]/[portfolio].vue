<template>
  <div class="bg-gray-900 px-6 pt-32 lg:px-8">
    <article class="mx-auto max-w-7xl">
      <!-- Tags -->
      <div v-if="portfolio?.tags" class="flex justify-center gap-4 flex-wrap">
        <span v-for="tag in portfolio.tags" :key="tag" class="text-base font-semibold leading-7 text-indigo-400 px-3 py-1 rounded-full border border-indigo-400/30">
          {{ tag }}
        </span>
      </div>

      <!-- Title and Description -->
      <div class="text-center">
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {{ portfolio?.title || 'Portfolio Item' }}
        </h1>
        <p class="mx-auto max-w-2xl mt-6 text-lg leading-8 text-gray-300">
          {{ portfolio?.description || 'Portfolio description' }}
        </p>
      </div>

      <!-- Image with Gradient -->
      <div v-if="portfolio?.image" class="relative overflow-hidden pt-16">
          <div class="mx-auto max-w-7xl px-6 lg:px-8">
            <img
              :src="portfolio.image"
              :alt="portfolio.imageAlt || 'PCL Labs Portfolio Item'"
              class="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-white/10"
              width="2432"
              height="1442"
              loading="lazy"
            />
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
import { useRoute, useAsyncData } from 'nuxt/app'

const route = useRoute()

// Fetch the markdown content based on the slug using queryContent
const { data: portfolio } = await useAsyncData(
  `portfolio-${route.path}`,
  async () => {
    try {
      // Use route.path directly (including leading slash) for consistency with ContentDoc resolution
      const result = await queryContent(route.path).findOne()
      
      // Only log in development
      if (process.dev) {
        console.log('Portfolio data:', result)
      }
      return result
    } catch (error) {
      console.error('Error fetching portfolio:', error)
      return null
    }
  },
  {
    // Re-fetch when navigating to a different portfolio item in the same component
    watch: [() => route.path]
  }
)

useHead({
  title: portfolio.value ? `${portfolio.value.title} - PCL Labs` : 'Portfolio - PCL Labs',
  meta: [
    { name: 'description', content: portfolio.value?.description || 'Portfolio item from PCL Labs' },
    { name: 'keywords', content: portfolio.value?.keywords || '' }
  ]
})
</script>
