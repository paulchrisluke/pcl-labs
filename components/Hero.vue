<template>
  <div class="relative isolate overflow-hidden pt-14">
    <!-- Video background -->
    <video autoplay muted loop class="absolute inset-0 -z-10 w-full h-full object-cover">
      <source src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4">
      Your browser does not support the video tag.
    </video>
    
    <!-- Darkening opacity layer -->
    <div class="absolute inset-0 bg-black opacity-60"></div>

    <!-- Hero content -->
    <div class="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56 text-white text-center relative z-10">
      <!-- <div class="hidden sm:mb-8 sm:flex sm:justify-center">
        <div class="relative rounded-full px-3 py-1 text-sm leading-6 text-gray-400 ring-1 ring-white/10 hover:ring-white/20">
          Announcing our next round of funding. <a href="#" class="font-semibold"><span class="absolute inset-0" aria-hidden="true" />Read more <span aria-hidden="true">&rarr;</span></a>
        </div>
      </div> -->
      <h1 class="text-4xl font-bold tracking-tight sm:text-6xl">PCL-Labs</h1>
      <p class="mt-6 text-lg leading-8">Top Rated Plus on Upwork. With over 15 years experience, PCL-Labs provides best-in-class digital and print development, design, and marketing assets to grow your business end-to-end.</p>
      <div class="mt-10 flex items-center justify-center gap-x-6">
        <button type="button" onclick="window.location.href='/Contact'" class="relative inline-flex items-center gap-x-1.5 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
              <EnvelopeIcon class="-ml-0.5 h-5 w-5" aria-hidden="true" />
              Contact Us
            </button>
        <a href="/#Services" class="text-sm font-semibold leading-6">Learn more <span aria-hidden="true">↓</span></a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { CloudArrowUpIcon, LockClosedIcon, ServerIcon, EnvelopeIcon, ChevronDownIcon } from '@heroicons/vue/20/solid'

const features = [
  {
    name: 'Push to deploy.',
    description:
      'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione.',
    icon: CloudArrowUpIcon,
  },
  {
    name: 'SSL certificates.',
    description: 'Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo.',
    icon: LockClosedIcon,
  },
  {
    name: 'Database backups.',
    description: 'Ac tincidunt sapien vehicula erat auctor pellentesque rhoncus. Et magna sit morbi lobortis.',
    icon: ServerIcon,
  },
]
</script>
