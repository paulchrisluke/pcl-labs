<script setup>
import { useRoute, useAsyncData } from 'nuxt/app'

const { path } = useRoute()

// Fetch the markdown content based on the slug
const { data: portfolio } = await useAsyncData(`portfolio-${path}`, () => 
queryContent(path).findOne())
</script>

<template>
  <article class="max-w-4xl mx-auto p-4 ">
    <h1 class="text-3xl font-bold my-4">{{ portfolio.title }}</h1>
    <img :src="portfolio.image" alt="" class="rounded-lg my-4" />
    <div class="tags mb-4">
      <span v-for="tag in portfolio.tags" :key="tag" class="bg-blue-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2">{{ tag }}</span>
    </div>
    <ContentDoc class="prose dark:prose-invert" />
  </article>
</template>