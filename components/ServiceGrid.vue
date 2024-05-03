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
    SparklesIcon,
    CloudArrowUpIcon,
    ClipboardDocumentIcon,
    ArrowTrendingUpIcon,
    ComputerDesktopIcon,
    HeartIcon,
  } from '@heroicons/vue/20/solid'
  
  const features = [
    {
      name: 'Web Development.',
      description: 'ReactJS, VueJS, Shopify Liquid, NodeJS, AMPHtml.',
      icon: CloudArrowUpIcon,
    },
    {
      name: 'UI/UX Design.',
      description: 'Figma, Adobe.',
      icon: ComputerDesktopIcon,
    },
    {
      name: 'eCommerce CRO.',
      description: 'Shopify Plus Partner.',
      icon: SparklesIcon,
    },
    {
      name: 'Paid Advertising.',
      description: 'Certified Google/Meta Partners.',
      icon: ArrowTrendingUpIcon,
    },
    {
      name: 'Brand & Print Design.',
      description: 'Figma, Adobe.',
      icon: ClipboardDocumentIcon,
    },
    {
      name: 'Organic Marketing.',
      description: 'Blog, Meta, TikTok.',
      icon: HeartIcon,
    },
  ]
  </script>