<template>
  <div class="bg-gray-900 px-6 pt-32 lg:px-8">
    <article class="mx-auto max-w-7xl">
      <!-- Client Info -->
      <div class="flex justify-between items-center mb-8">
        <div>
          <h2 class="text-base font-semibold leading-7 text-indigo-400">{{ proposal.client }}</h2>
          <p class="text-sm text-gray-400">{{ formatDate(proposal.date) }} • {{ proposal.timeline }}</p>
        </div>
        <div class="text-right">
          <p class="text-base font-medium text-indigo-400">Estimated Investment:</p>
          <p class="text-xl font-bold text-white">{{ proposal.estimatedCost }}</p>
        </div>
      </div>

      <!-- Tags -->
      <div class="flex justify-center divide-dotted divide-x-2 space-x-2 flex-wrap">
        <h2 v-for="tag in proposal.tags" :key="tag" class="text-base font-semibold leading-7 text-indigo-400 pl-2">
          {{ tag }}
        </h2>
      </div>

      <!-- Title and Description -->
      <div class="text-center">
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {{ proposal.title }}
        </h1>
        <p class="mx-auto max-w-2xl mt-6 text-lg leading-8 text-gray-300">
          {{ proposal.description }}
        </p>
      </div>

      <!-- Image with Gradient (if available) -->
      <div v-if="proposal.image" class="relative overflow-hidden pt-16">
        <div class="mx-auto max-w-7xl px-6 lg:px-8">
          <img :src="proposal.image" :alt="proposal.title" class="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-white/10" width="2432" height="1442" />
          <div class="relative" aria-hidden="true">
            <div class="absolute -inset-x-20 bottom-0 bg-gradient-to-t from-gray-900 pt-[7%]" />
          </div>
        </div>
      </div>

      <!-- Content -->
      <ContentDoc class="dark:prose-invert prose mx-auto mt-8" />
    </article>
    
    <!-- CTA Section -->
    <div class="mt-16 border-t border-white/10 pt-8 sm:mt-20 lg:mt-24"></div>
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to get started?</h2>
        <p class="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-300">
          Let's bring this proposal to life. Our team is ready to begin work on your project.
        </p>
        <div class="mt-10 flex items-center justify-center gap-x-6">
          <NuxtLink to="/contact" class="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            Contact Us
          </NuxtLink>
          <a href="#" class="text-sm font-semibold leading-6 text-white" @click.prevent="logout">
            Logout <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useAsyncData } from 'nuxt/app'

definePageMeta({
  middleware: ['proposal-auth']
})

const { path } = useRoute()

// Fetch the markdown content based on the slug
const { data: proposal } = await useAsyncData(`proposal-${path}`, () => 
  queryContent(path).findOne()
)

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

// Logout function
const logout = () => {
  if (process.client) {
    localStorage.removeItem('proposal_auth');
    navigateTo('/proposals');
  }
}

useHead({
  title: proposal.value ? `${proposal.value.title} - PCL Labs` : 'Proposal - PCL Labs',
  meta: [
    { name: 'description', content: proposal.value?.description || 'Custom proposal from PCL Labs' },
    { name: 'keywords', content: proposal.value?.keywords || '' }
  ]
})
</script> 