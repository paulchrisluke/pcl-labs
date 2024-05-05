<template>
  <div class="bg-gray-900 py-24 sm:py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="grid grid-cols-1 items-center gap-x-8 gap-y-16 lg:grid-cols-2">
        <div class="mx-auto w-full max-w-xl lg:mx-0">
          <h2 class="text-3xl font-bold tracking-tight text-white">Certified and Partnered</h2>
          <p class="mt-6 text-lg leading-8 text-gray-300">We work with the best companies to help you increase your conversions online. Paid certifications are held by the majority of our team.</p>
          <div class="mt-8 flex items-center gap-x-6">
            <nuxt-link to="/contact">
        <button type="button" class="relative inline-flex items-center gap-x-1.5 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
              <EnvelopeIcon class="-ml-0.5 h-5 w-5" aria-hidden="true" />
              Contact Us
            </button>
          </nuxt-link>            <!-- <a href="#" class="text-sm font-semibold text-white">Contact us <span aria-hidden="true">&rarr;</span></a> -->
          </div>
        </div>
        <div class="mx-auto grid w-full max-w-xl grid-cols-2 items-center gap-y-12 sm:gap-y-14 lg:mx-0 lg:max-w-none lg:pl-8">
          <img class="max-h-12 w-full object-contain object-left" src="https://tailwindui.com/img/logos/tuple-logo-white.svg" alt="Tuple" width="105" height="48" />
          <img class="max-h-12 w-full object-contain object-left" src="https://tailwindui.com/img/logos/reform-logo-white.svg" alt="Reform" width="104" height="48" />
          <img class="max-h-12 w-full object-contain object-left" src="https://tailwindui.com/img/logos/savvycal-logo-white.svg" alt="SavvyCal" width="140" height="48" />
          <img class="max-h-12 w-full object-contain object-left" src="https://tailwindui.com/img/logos/laravel-logo-white.svg" alt="Laravel" width="136" height="48" />
          <img class="max-h-12 w-full object-contain object-left" src="https://tailwindui.com/img/logos/transistor-logo-white.svg" alt="Transistor" width="158" height="48" />
          <img class="max-h-12 w-full object-contain object-left" src="https://tailwindui.com/img/logos/statamic-logo-white.svg" alt="Statamic" width="147" height="48" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { EnvelopeIcon } from '@heroicons/vue/20/solid'
</script>