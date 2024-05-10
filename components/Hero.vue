<template>
  <div class="bg-gray-900">
    <div class="relative isolate overflow-hidden pt-14">
      <video autoplay loop muted playsinline class="absolute inset-0 -z-10 h-full w-full object-cover bg-gray-900 opacity-40">
        <source src="https://res.cloudinary.com/image-gallery-pcl/video/upload/v1715331109/Blawby/PCL_Labs___Agency_Video___We_Do_Stuff_online-video-cutter.com_kjuu1n.mp4" type="video/mp4">
      </video>
      <div class="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
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
import { ref } from 'vue'
// import { Dialog, DialogPanel } from '@headlessui/vue'
// import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline'
// import { EnvelopeIcon, ChevronDownIcon } from '@heroicons/vue/20/solid'

const mobileMenuOpen = ref(false)
</script>