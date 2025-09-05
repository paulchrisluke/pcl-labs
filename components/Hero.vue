<template>
  <div class="bg-gray-900">
    <div class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" aria-hidden="true">
        <div class="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]" style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
      </div>
    <div class="relative isolate overflow-hidden" :class="isLive ? 'h-screen' : 'pt-14'">
      <!-- Twitch Live Stream (when live) -->
      <div v-if="isLive && !isLoading" class="absolute inset-0 -z-10 h-full w-full bg-gray-900">
        <iframe
          :src="twitchEmbedUrl"
          height="100%"
          width="100%"
          frameborder="0"
          allowfullscreen
          allow="autoplay; fullscreen; picture-in-picture"
          class="h-full w-full object-cover"
        />
        <!-- Live indicator -->
        <div class="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
          <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          LIVE
        </div>
      </div>
      
      <!-- Fallback video (when not live or loading) -->
      <video 
        v-else
        autoplay 
        loop 
        muted 
        playsinline 
        class="absolute inset-0 -z-10 h-full w-full object-cover bg-gray-900 opacity-40"
      >
        <source src="/pcl-labs-agency-hero-paul-chris-luke.mp4" type="video/mp4">
      </video>
      <!-- Hero content - hidden when live -->
      <div v-if="!isLive" class="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
        <div class="text-center">
          <h1 class="text-white text-4xl font-bold tracking-tight sm:text-6xl">PCL-Labs</h1>
      <p class="text-white mt-6 text-lg leading-8">Top Rated Plus on Upwork. With over 15 years experience, PCL-Labs provides best-in-class digital and print development, design, and marketing assets to grow your business end-to-end.</p>
      <div class="mt-10 flex items-center justify-center gap-x-6">
        <nuxt-link to="/contact">
        <button type="button" class="relative inline-flex items-center gap-x-1.5 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
              <EnvelopeIcon class="-ml-0.5 h-5 w-5" aria-hidden="true" />
              Contact Us
            </button>
          </nuxt-link>
        <!-- <a href="/#Services" class="text-white text-sm font-semibold leading-6">Learn more <span aria-hidden="true">↓</span></a> -->
      </div>
    </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { EnvelopeIcon } from '@heroicons/vue/20/solid'

const mobileMenuOpen = ref(false)

// Use Twitch status composable
const { isLive, isLoading, error } = useTwitchStatus()

// Debug logging for local development
watchEffect(() => {
  if (process.dev) {
    console.log('Twitch Status:', { isLive: isLive.value, isLoading: isLoading.value, error: error.value })
  }
})

// Computed property for Twitch embed URL
const twitchEmbedUrl = computed(() => {
  const currentDomain = process.client ? window.location.hostname : 'localhost'
  return `https://player.twitch.tv/?channel=paulchrisluke&parent=${currentDomain}&autoplay=true&muted=false&allowfullscreen=true`
})
</script>