<template>
  <div>
    <ServiceGrid />
    <!-- <ProductListFilter /> -->
    <h2 class="text-2xl font-bold tracking-tight text-gray-900">Portfolio</h2>
    <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4 md:gap-y-0 lg:gap-x-8">
        <nuxt-link :to="product._path" v-for="product in portfolioData" :key="product._path" class="group relative">
          <div class="mt-6 aspect-w-1 aspect-h-1 rounded-md overflow-hidden bg-gray-200 group-hover:scale-105 transform transition duration-1000 group-hover:shadow-md group-hover:rotate-2 group-hover:ease-out">
            <img :src="product.image" :alt="product.imageAlt" class="object-cover object-center h-full w-full" />
          </div>
          <h3 class="mt-4 text-sm text-gray-700">
            <a :href="product.href">
              <span class="absolute inset-0" />
              {{ product.title }}
            </a>
          </h3>
          <p class="mt-1 text-sm text-gray-500">{{ product.tags[0] }}</p>
          </nuxt-link>
      </div>
  </div>
</template>

<script setup>
import { useAsyncData } from 'nuxt/app'
useHead({
  title: 'My App',
  meta: [
    { name: 'description', content: 'My amazing site.' },
    { property: 'og:title', content: 'My App' },  // OG title
    { property: 'og:description', content: 'My amazing site.' },  // OG description
    { property: 'og:image', content: 'https://example.com/path-to-your-image.jpg' }  // OG image URL
  ]
})
const { data: portfolioData } = await useAsyncData('portfolio', () =>
  queryContent('portfolio').find()
);
</script>

