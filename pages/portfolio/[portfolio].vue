<script setup>
import { useRoute, useAsyncData } from 'nuxt/app'

const { path } = useRoute()

// Fetch the markdown content based on the slug
const { data: portfolio } = await useAsyncData(`portfolio-${path}`, () => 
queryContent(path).findOne())
</script>

<template>
    <div class="bg-white px-6 py-32 lg:px-8">
  <article class="mx-auto max-w-3xl text-base leading-7 text-gray-700">
      <span v-for="tag in portfolio.tags" :key="tag" class="text-base font-semibold leading-7 text-indigo-600">{{ tag }}</span>
    <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{{ portfolio.title }}</h1>
    <img :src="portfolio.image" alt="" class="rounded-lg my-4" />
    <ContentDoc class="prose light:prose-invert" />
  </article>
</div>
</template>