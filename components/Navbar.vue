<template>
  <Disclosure as="nav" class="bg-gray-900" v-slot="{ open }">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-50">
      <div class="flex h-16 justify-between">
        <div class="flex">
          <div class="-ml-2 mr-2 flex items-center md:hidden">
            <!-- Mobile menu button -->
            <DisclosureButton class="relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
              <span class="absolute -inset-0.5" />
              <span class="sr-only">Open main menu</span>
              <Bars3Icon v-if="!open" class="block h-6 w-6" aria-hidden="true" />
              <XMarkIcon v-else class="block h-6 w-6" aria-hidden="true" />
            </DisclosureButton>
          </div>
          <nuxt-link to="/" class="flex flex-shrink-0 items-center">
            <img class="h-8 w-auto" src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714739278/Blawby/pcl-labs-logo_jlyewp.svg" alt="PCL Labs" />
          </nuxt-link>
          <div class="hidden md:ml-6 md:flex md:items-center md:space-x-4">
            <nuxt-link v-for="item in navigation" :key="item.name" :to="item.href" :class="[item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white', 'rounded-md px-3 py-2 text-sm font-medium']" :aria-current="item.current ? 'page' : undefined">{{ item.name }}</nuxt-link>
            <!-- Move Industries link here -->
            <Menu as="div" class="relative">
              <div>
                <MenuButton class="relative flex rounded-md bg-gray-800 text-sm hover:bg-gray-700">
  <span class="absolute -inset-1.5" />
  <span class="sr-only">Open user menu</span>
  <div class="inline-flex items-center text-gray-300 rounded-md px-3 py-2 text-sm font-medium hover:text-white hover:bg-gray-700">
    Industries
    <ChevronDownIcon class="-mr-0.5 h-5 w-5" aria-hidden="true" />
  </div>
</MenuButton>
              </div>
              <transition enter-active-class="transition ease-out duration-200" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
                <MenuItems class="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <MenuItem v-for="item in userNavigation" :key="item.name" v-slot="{ active }">
                    <nuxt-link :to="item.href" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700']">{{ item.name }}</nuxt-link>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </div>
        </div>
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <nuxt-link to="/contact">
            <button type="button" class="relative inline-flex items-center gap-x-1.5 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
              <EnvelopeIcon class="-ml-0.5 h-5 w-5" aria-hidden="true" />
              Contact Us
            </button>
          </nuxt-link>
          </div>
        </div>
      </div>
    </div>

    <DisclosurePanel class="md:hidden z-20">
      <div class="space-y-1 px-2 pb-3 pt-2 sm:px-3">
        <DisclosureButton v-for="item in navigation" :key="item.name" as="nuxt-link" :to="item.href" :class="[item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white', 'block rounded-md px-3 py-2 text-base font-medium']" :aria-current="item.current ? 'page' : undefined">{{ item.name }}</DisclosureButton>
      </div>
      <div class="border-t border-gray-700 pb-3 pt-4">
        <div class="flex items-center px-5 sm:px-6">
          <div class="flex-shrink-0">
          </div>
          <div class="">
            <div class="text-base font-medium text-white">Industries</div>
          </div>
        </div>
        <div class="mt-3 space-y-1 px-2 sm:px-3">
          <DisclosureButton v-for="item in userNavigation" :key="item.name" as="a" :href="item.href" class="block rounded-md px-3 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white">{{ item.name }}</DisclosureButton>
        </div>
      </div>
    </DisclosurePanel>
  </Disclosure>
</template>

<script setup>
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { Bars3Icon, XMarkIcon  } from '@heroicons/vue/24/outline'
import { EnvelopeIcon, ChevronDownIcon } from '@heroicons/vue/20/solid'

const navigation = [
  { name: 'Services & Portfolio', href: '/portfolio', current: false },
  { name: 'About & Reviews', href: '/about', current: false },
]
const userNavigation = [
  { name: 'Legal Practices', href: '/legal-practices', current: false },
  { name: 'Healthcare', href: '/healthcare' },
  { name: 'Shopify', href: '/shopify' },
  { name: 'Logistics', href: '/logistics' },
  { name: 'Crypto', href: '/crypto' },
]
</script>
