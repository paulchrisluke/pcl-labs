<template>
  <div class="bg-gray-900 px-6 pt-32 lg:px-8">
    <article class="mx-auto max-w-7xl">
      <!-- Tags -->
      <div class="flex justify-center divide-dotted divide-x-2 space-x-2 flex-wrap">
        <h2 v-for="tag in portfolio.tags" :key="tag" class="text-base font-semibold leading-7 text-indigo-400 pl-2">
          {{ tag }}
        </h2>
      </div>

      <!-- Title and Description -->
      <div class="text-center">
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {{ portfolio.title }}
        </h1>
        <p class="mx-auto max-w-2xl mt-6 text-lg leading-8 text-gray-300">
          {{ portfolio.description }}
        </p>
      </div>

      <!-- Image with Gradient -->
      <div class="relative overflow-hidden pt-16">
          <div class="mx-auto max-w-7xl px-6 lg:px-8">
            <img :src="portfolio.image" alt="App screenshot" class="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-white/10" width="2432" height="1442" />
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

const { path } = useRoute()

// Fetch the markdown content based on the slug
const { data: portfolio } = await useAsyncData(`portfolio-${path}`, () => 
queryContent(path).findOne())
</script>

