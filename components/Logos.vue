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
          <img class="max-h-12 w-full object-contain object-left" src="https://res.cloudinary.com/pcl-labs/image/upload/v1717529187/PCL-Labs/pcl-labs-partner-google_xt8agl.svg" alt="Google" width="105" height="48" />
          <img class="max-h-12 w-full object-contain object-left" src="https://res.cloudinary.com/pcl-labs/image/upload/v1717529188/PCL-Labs/pcl-labs-partner-meta_vwcgh3.svg" alt="Meta" width="104" height="48" />
          <img class="max-h-12 w-full object-contain object-left" src="https://res.cloudinary.com/pcl-labs/image/upload/v1717528981/PCL-Labs/pcl-labs-partner-shopify_bbdkkq.svg" alt="Shopify" width="140" height="48" />
          <img class="max-h-12 w-full object-contain object-left" src="https://res.cloudinary.com/pcl-labs/image/upload/v1717529188/PCL-Labs/pcl-labs-partner-laravel_z4crpu.svg" alt="Laravel" width="136" height="48" />
          <img class="max-h-12 w-full object-contain object-left" src="https://res.cloudinary.com/pcl-labs/image/upload/v1717529189/PCL-Labs/pcl-labs-partner-react_nt4ic5.svg" alt="React js" width="158" height="48" />
          <img class="max-h-12 w-full object-contain object-left" src="https://res.cloudinary.com/pcl-labs/image/upload/v1717529187/PCL-Labs/pcl-labs-partner-hubspot_ijru82.svg" alt="Hubspot" width="147" height="48" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { EnvelopeIcon } from '@heroicons/vue/20/solid'
</script>