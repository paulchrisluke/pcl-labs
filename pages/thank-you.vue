<template>
    <div class="bg-white px-6 py-32 lg:px-8">
      <div class="mx-auto max-w-3xl text-base leading-7 text-gray-700">
        <p class="text-base font-semibold leading-7 text-indigo-600">Thank you!</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">We're excited to see how we can work together.</h1>
        <p class="mt-6 text-xl leading-8">Typically we get back to all inqueries within 24-48 hours.</p>
        <div class="mt-6 max-w-2xl">
          <p>In the meantime, please enjoy our current favorite gif:</p>
        <figure class="mt-6">
          <img class="aspect-video w-full rounded-xl bg-gray-50 object-cover" src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3QwMTVnN28wdHRyOGo0dWlvYzhncHg1a2ljZHRkZ2F0b2N1d3NoNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3rgXByB0tbT7oXK7Xq/giphy.gif" alt="" />
          <figcaption class="mt-4 flex gap-x-2 text-sm leading-6 text-gray-500">
          <InformationCircleIcon class="mt-0.5 h-5 w-5 flex-none text-gray-300" aria-hidden="true" />
          Recomended by - Julia Chow
        </figcaption>
        </figure>
        <div class="mt-6 max-w-2xl">
          <nuxt-link to="/">
            <button type="button" class="relative inline-flex items-center gap-x-1.5 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
              Go home ↖
            </button>
          </nuxt-link>
        </div>
    </div>
</div>
</div>
  </template>
  
  <script setup>
  import { InformationCircleIcon } from '@heroicons/vue/20/solid'
  </script>