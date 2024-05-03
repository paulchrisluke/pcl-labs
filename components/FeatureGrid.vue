<script setup>
import { ref } from 'vue';
import { ArrowTrendingUpIcon, CalendarIcon, PhoneIcon, BriefcaseIcon } from '@heroicons/vue/24/outline'

// Dummy data for the features, using Heroicons
const features = ref([
{
      name: 'Scheduling',
      description:
        'Fully integrated with Calendly. Schedule consultations, automatically handle rescheduling, integrate with Google calendar.',
      icon: CalendarIcon,
    },
    {
      name: 'Media Kits',
      description:
        'Beautifully designed brand support. Logo, business cards, letterhead, and social media assets designed for you in editable Google docs/drive.',
      icon: BriefcaseIcon,
    },
    {
      name: 'Ad Management',
      description:
        'Google & Meta ad management. Get brand exposure across media channels in your state. Special $10,000/mo FREE Google Search ad credit available for nonprofits.',
      icon: ArrowTrendingUpIcon,
    },
    {
      name: '24/7 Support',
      description:
        'Always maintained, always best-in-class. No need to worry about domain, hosting, or platform management.',
      icon: PhoneIcon,
    },
]);
</script>

<template>
  <div class="bg-gray-900 py-24 sm:py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="mx-auto max-w-2xl lg:text-center">
        <h2 class="text-lg font-semibold leading-8 tracking-tight text-indigo-400">
          Get More Leads
        </h2>
        <p class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Everything you need to get more scheduled consultations
        </p>
        <p class="mt-6 text-lg leading-8 text-gray-300">
          Includes everything you need to build your legal practice online, including scheduling, media kits, ad support and more.
        </p>
      </div>
      <div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
        <dl class="grid max-w-xl grid-cols-1 gap-y-10 gap-x-8 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
          <div v-for="feature in features" :key="feature.name" class="relative pl-16">
            <dt class="text-base font-semibold leading-7 text-white">
              <div class="absolute top-0 left-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                <component :is="feature.icon" class="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              {{ feature.name }}
            </dt>
            <dd class="mt-2 text-base leading-7 text-gray-300">
              {{ feature.description }}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>
