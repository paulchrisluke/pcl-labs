<template>
  <div class="bg-white">
    <div class="mx-auto px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
      <!-- Product -->
      <div
        class="lg:grid lg:grid-cols-7 lg:grid-rows-1 lg:gap-x-8 lg:gap-y-10 xl:gap-x-16"
      >
        <!-- Product image -->
        <div class="lg:col-span-4 lg:row-end-1">
          <div
            class="aspect-h-3 aspect-w-4 overflow-hidden rounded-lg bg-gray-100"
          >
            <slot name="image"></slot>
          </div>
        </div>

        <!-- Product details -->
        <div
          class="mx-auto mt-14 max-w-2xl sm:mt-16 lg:col-span-3 lg:row-span-2 lg:row-end-2 lg:mt-0 lg:max-w-none"
        >
          <div class="flex flex-col-reverse">
            <div class="mt-4">
              <h1
                class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
              >
                <slot name="name"></slot>
              </h1>
            </div>

            <div>
              <h3 class="sr-only">Reviews</h3>
              <div class="flex items-center">
                <StarIcon
                  v-for="rating in [0, 1, 2, 3, 4]"
                  :key="rating"
                  :class="[
                    reviews.average > rating
                      ? 'text-yellow-400'
                      : 'text-gray-300',
                    'h-5 w-5 flex-shrink-0',
                  ]"
                  aria-hidden="true"
                />
              </div>
              <p class="sr-only">{{ reviews.average }} out of 5 stars</p>
            </div>
          </div>

          <p class="mt-6 text-gray-500">
            <slot name="description"></slot>
          </p>

          <div class="mt-10 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <nuxt-link to="/contact">
            <button
              type="button"
              class="flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50"
            >
              <EnvelopeIcon class="mr-2 -ml-0.5 h-5 w-5" aria-hidden="true" />
              Request Quote
            </button>
          </nuxt-link>
            <slot name="demo"></slot>
          </div>

          <div class="mt-10 border-t border-gray-200 pt-10">
            <h3 class="text-sm font-medium text-gray-900">Highlights</h3>
            <div class="prose prose-sm mt-4 text-gray-500">
              <slot name="highlights"></slot>
            </div>
          </div>
        </div>

        <div
          class="mx-auto mt-16 w-full max-w-2xl lg:col-span-4 lg:mt-0 lg:max-w-none"
        >
          <TabGroup as="div">
            <div class="border-b border-gray-200">
              <TabList class="-mb-px flex space-x-8">
                <Tab as="template" v-slot="{ selected }">
                  <button
                    :class="[
                      selected
                        ? 'text-indigo-600'
                        : 'border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-800',
                      'whitespace-nowrap border-b-2 py-6 text-sm font-medium',
                    ]"
                  >
                    Customer Reviews
                  </button>
                </Tab>
                <Tab as="template" v-slot="{ selected }">
                  <button
                    :class="[
                      selected
                        ? 'text-indigo-600'
                        : 'border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-800',
                      'whitespace-nowrap border-b-2 py-6 text-sm font-medium',
                    ]"
                  >
                    FAQ
                  </button>
                </Tab>
              </TabList>
            </div>
            <TabPanels as="template">
              <TabPanel class="-mb-10">
                <h3 class="sr-only">Customer Reviews</h3>
                <slot name="reviewlist"></slot>
              </TabPanel>

              <TabPanel class="text-sm text-gray-500">
                <h3 class="sr-only">Frequently Asked Questions</h3>
                <slot name="faqlist"></slot>
              </TabPanel>
            </TabPanels>
          </TabGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { StarIcon } from "@heroicons/vue/20/solid";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/vue";
import { EnvelopeIcon } from "@heroicons/vue/20/solid";

const reviews = {
  average: 5,
};

</script>
