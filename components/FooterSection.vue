<template>
  <footer class="bg-gray-900" aria-labelledby="footer-heading">
    <h2 id="footer-heading" class="sr-only">Footer</h2>
    <div class="mx-auto max-w-7xl px-6 pb-8 pt-16 sm:pt-24 lg:px-8 lg:pt-24">
      <div class="xl:grid xl:grid-cols-3 xl:gap-8">
        <div class="space-y-8">
          <img class="h-7" src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714739278/Blawby/pcl-labs-logo_jlyewp.svg" alt="Company name" />
          <p class="text-sm leading-6 text-gray-300">Top Rated Plus on Upwork. With over 15 years experience, PCL-Labs provides best-in-class digital and print development, design, and marketing assets to grow your business end-to-end.</p>
          <div class="flex space-x-6">
            <nuxt-link v-for="item in footerNavigation.social" :key="item.name" :to="item.href" class="text-gray-500 hover:text-gray-400">
              <span class="sr-only">{{ item.name }}</span>
              <!-- TODO: SVGS are causing warning console issues so ignore for now -->
              <!-- <component :is="item.icon" class="h-6 w-6" aria-hidden="true" /> -->
            </nuxt-link>
          </div>
        </div>
        <div class="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
          <div class="md:grid md:grid-cols-2 md:gap-8">
            <div>
              <h3 class="text-sm font-semibold leading-6 text-white">Services & Portfolio</h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in footerNavigation.solutions" :key="item.name">
                  <nuxt-link :to="item.href" class="text-sm leading-6 text-gray-300 hover:text-white">{{ item.name }}</nuxt-link>
                </li>
              </ul>
            </div>
            <div class="mt-10 md:mt-0">
              <h3 class="text-sm font-semibold leading-6 text-white">About & Reviews</h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in footerNavigation.support" :key="item.name">
                  <nuxt-link :to="item.href" class="text-sm leading-6 text-gray-300 hover:text-white">{{ item.name }}</nuxt-link>
                </li>
              </ul>
            </div>
          </div>
          <div class="md:grid md:grid-cols-2 md:gap-8">
            <div>
              <h3 class="text-sm font-semibold leading-6 text-white">Industries</h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in footerNavigation.company" :key="item.name">
                  <nuxt-link :href="item.href" class="text-sm leading-6 text-gray-300 hover:text-white">{{ item.name }}</nuxt-link>
                </li>
              </ul>
            </div>
            <div class="mt-10 md:mt-0">
              <h3 class="text-sm font-semibold leading-6 text-white">Legal</h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in footerNavigation.legal" :key="item.name">
                  <nuxt-link :href="item.href" class="text-sm leading-6 text-gray-300 hover:text-white">{{ item.name }}</nuxt-link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-16 border-t border-white/10 pt-8 sm:mt-20 lg:mt-24">
        <p class="text-xs leading-5 text-gray-400">&copy; 2024 PCL-Labs, LLC. All rights reserved.</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref } from 'vue'
import UpworkIcon from '@/assets/svgs/upwork.svg';
import GithubIcon from '@/assets/svgs/github.svg';

const footerNavigation = ref({
  solutions: [
  { name: 'Services', href: '/portfolio', current: false }, 
  { name: 'Portfolio', href: '/portfolio', current: false },
// TODO: deep link these items since they are on same page
  ],
  support: [
  { name: 'About', href: '/about', current: false },
  { name: 'Reviews', href: '/about', current: false },
  { name: 'UpWork ↗', href: 'https://upwork.com/freelancers/paulchrisluke', current: false },
    // { name: 'Documentation', href: '#' },
    // { name: 'Guides', href: '#' },
    // { name: 'API Status', href: '#' },
  ],
  company: [
    { name: 'Legal Practices', href: '/legal-practices' },
    { name: 'Healthcare', href: '/healthcare' },
    { name: 'Shopify', href: '/shopify' },
    { name: 'Logistics', href: '/logistics' },
    { name: 'Crypto', href: '/crypto' },
  ],
  legal: [
    // { name: 'Claim', href: '#' },
    { name: 'Privacy', href: '/privacy' },
    { name: 'Terms', href: '/terms' },
  ],
  social: [
  {
  name: 'Upwork',
  href: 'https://upwork.com/freelancers/paulchrisluke',
  icon: UpworkIcon,
},
    {
      name: 'GitHub',
      href: 'https://github.com/pcl-labs',
      icon: GithubIcon,
    },
  ],
});
</script>