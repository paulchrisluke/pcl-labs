<template>
  <div class="bg-gray-900">
    <div class="relative isolate overflow-hidden pt-14">
      <img src="https://i.giphy.com/FCQvc3IreTNNm.webp" alt="" class="absolute inset-0 -z-10 h-full w-full object-cover bg-black opacity-60" />
      <div class="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
        <div class="text-center">
          <h1 class="text-white text-4xl font-bold tracking-tight sm:text-6xl">PCL-Labs</h1>
      <p class="text-white mt-6 text-lg leading-8">Top Rated Plus on Upwork. With over 15 years experience, PCL-Labs provides best-in-class digital and print development, design, and marketing assets to grow your business end-to-end.</p>
      <div class="mt-10 flex items-center justify-center gap-x-6">
        <button type="button" onclick="window.location.href='/Contact'" class="relative inline-flex items-center gap-x-1.5 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
              <EnvelopeIcon class="-ml-0.5 h-5 w-5" aria-hidden="true" />
              Contact Us
            </button>
        <!-- <a href="/#Services" class="text-white text-sm font-semibold leading-6">Learn more <span aria-hidden="true">↓</span></a> -->
      </div>
    </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Dialog, DialogPanel } from '@headlessui/vue'
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline'
import { EnvelopeIcon, ChevronDownIcon } from '@heroicons/vue/20/solid'

const navigation = [
  { name: 'Product', href: '#' },
  { name: 'Features', href: '#' },
  { name: 'Marketplace', href: '#' },
  { name: 'Company', href: '#' },
]

const mobileMenuOpen = ref(false)
</script>