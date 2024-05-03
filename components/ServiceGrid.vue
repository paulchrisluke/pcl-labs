<template>
    <div class="bg-gray-900 py-24 sm:py-32">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="mx-auto max-w-2xl lg:mx-0">
          <h2 class="text-base font-semibold leading-7 text-indigo-400">Everything you need</h2>
          <p class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Want to increase your conversions? No problem.</p>
          <p class="mt-6 text-lg leading-8 text-gray-300">We help brands by blending fresh ideas with proprietary direct response tools to forge deeper brand connections and more profitable conversions.</p>
        </div>
        <dl class="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 text-base leading-7 text-gray-300 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:gap-x-16">
          <div v-for="feature in features" :key="feature.name" class="relative pl-9">
            <dt class="inline font-semibold text-white">
              <component :is="feature.icon" class="absolute left-1 top-1 h-5 w-5 text-indigo-500" aria-hidden="true" />
              {{ feature.name }}
            </dt>
            {{ ' ' }}
            <dd class="inline">{{ feature.description }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </template>
  
  <script setup>
  import {
    ArrowPathIcon,
    CloudArrowUpIcon,
    Cog6ToothIcon,
    FingerPrintIcon,
    LockClosedIcon,
    ServerIcon,
  } from '@heroicons/vue/20/solid'
  
  const features = [
    {
      name: 'Web Development.',
      description: 'ReactJS, VueJS, Shopify Liquid, NodeJS, AMPHtml. We program fast, beautiful websites that delight customers and increase sales.',
      icon: CloudArrowUpIcon,
    },
    {
      name: 'UI/UX Design.',
      description: 'Our Figma components are hand tailored for speed and conversions, repeatable design systems keep your brand up-to-date and beautiful.',
      icon: LockClosedIcon,
    },
    {
      name: 'eCommerce CRO.',
      description: 'Official Shopify Plus partner, supporting stores doing greater than $10M/revenue annually. Upsells, brand loyalty programs, and affiliate marketing.',
      icon: ArrowPathIcon,
    },
    {
      name: 'Paid Advertising.',
      description: 'As Certified Google/Meta Partners, we will write copy, and ensure your are top position in your state. Video ad creation and robust remarketing campaigns.',
      icon: FingerPrintIcon,
    },
    {
      name: 'Brand & Print Design.',
      description: 'Need to bring your brand to the digital age? Logos, banners, billboards, printed mailers, and more! We will unify your brand assets across all channels.',
      icon: Cog6ToothIcon,
    },
    {
      name: 'Organic Marketing.',
      description: 'Content creation. Robust SEO structued data ensures your video, blog, and landing page content is indexed and competitive.',
      icon: ServerIcon,
    },
  ]
  </script>