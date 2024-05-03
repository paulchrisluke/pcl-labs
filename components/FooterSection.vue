<template>
  <footer class="bg-gray-900" aria-labelledby="footer-heading">
    <h2 id="footer-heading" class="sr-only">Footer</h2>
    <div class="mx-auto max-w-7xl px-6 pb-8 pt-16 sm:pt-24 lg:px-8 lg:pt-24">
      <div class="xl:grid xl:grid-cols-3 xl:gap-8">
        <div class="space-y-8">
          <img class="h-7" src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=500" alt="Company name" />
          <p class="text-sm leading-6 text-gray-300">Top Rated Plus on Upwork. With over 15 years experience, PCL-Labs provides best-in-class digital and print development, design, and marketing assets to grow your business end-to-end.</p>
          <div class="flex space-x-6">
            <a v-for="item in footerNavigation.social" :key="item.name" :href="item.href" class="text-gray-500 hover:text-gray-400">
              <span class="sr-only">{{ item.name }}</span>
              <!-- SVGS are causing warning console issues so ignore for now -->
              <!-- <component :is="item.icon" class="h-6 w-6" aria-hidden="true" /> -->
            </a>
          </div>
        </div>
        <div class="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
          <div class="md:grid md:grid-cols-2 md:gap-8">
            <div>
              <h3 class="text-sm font-semibold leading-6 text-white">Services & Portfolio</h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in footerNavigation.solutions" :key="item.name">
                  <a :href="item.href" class="text-sm leading-6 text-gray-300 hover:text-white">{{ item.name }}</a>
                </li>
              </ul>
            </div>
            <div class="mt-10 md:mt-0">
              <h3 class="text-sm font-semibold leading-6 text-white">About & Reviews</h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in footerNavigation.support" :key="item.name">
                  <a :href="item.href" class="text-sm leading-6 text-gray-300 hover:text-white">{{ item.name }}</a>
                </li>
              </ul>
            </div>
          </div>
          <div class="md:grid md:grid-cols-2 md:gap-8">
            <div>
              <h3 class="text-sm font-semibold leading-6 text-white">Industries</h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in footerNavigation.company" :key="item.name">
                  <a :href="item.href" class="text-sm leading-6 text-gray-300 hover:text-white">{{ item.name }}</a>
                </li>
              </ul>
            </div>
            <div class="mt-10 md:mt-0">
              <h3 class="text-sm font-semibold leading-6 text-white">Legal</h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in footerNavigation.legal" :key="item.name">
                  <a :href="item.href" class="text-sm leading-6 text-gray-300 hover:text-white">{{ item.name }}</a>
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
  { name: 'Web Development', href: '/portfolio', current: false },
  { name: 'UI/UX Design', href: '/portfolio', current: false },
  { name: 'Brand & Print Design', href: '/portfolio', current: false },
  { name: 'eCommerce CRO', href: '/portfolio', current: false },
  { name: 'Paid Advertising', href: '/portfolio', current: false },
  { name: 'Organic Marketing', href: '/portfolio', current: false },
  ],
  support: [
  { name: 'About', href: '/about', current: false },
  { name: 'Reviews', href: '/about', current: false },
  { name: 'UpWork', href: 'https://www.upwork.com/fl/~01e187ee4b1c5ab0a1', current: false },
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
    { name: 'Privacy', href: '#' },
    { name: 'Terms', href: '#' },
  ],
  social: [
  {
  name: 'Upwork',
  href: '#',
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