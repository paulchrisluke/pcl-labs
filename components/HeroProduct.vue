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
            <button
              type="button"
              onclick="location.href='/contact'"
              class="flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50"
            >
              <EnvelopeIcon class="mr-2 -ml-0.5 h-5 w-5" aria-hidden="true" />
              Request Quote
            </button>
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

                <div
                  v-for="(review, reviewIdx) in reviews.featured"
                  :key="review.id"
                  class="flex space-x-4 text-sm text-gray-500"
                >
                  <div
                    :class="[
                      reviewIdx === 0 ? '' : 'border-t border-gray-200',
                      'py-10',
                    ]"
                  >
                    <h3 class="font-medium text-gray-900">
                      {{ review.author }}
                    </h3>
                    <p>
                      <time :datetime="review.datetime">{{ review.date }}</time>
                    </p>

                    <div class="mt-4 flex items-center">
                      <StarIcon
                        v-for="rating in [0, 1, 2, 3, 4]"
                        :key="rating"
                        :class="[
                          review.rating > rating
                            ? 'text-yellow-400'
                            : 'text-gray-300',
                          'h-5 w-5 flex-shrink-0',
                        ]"
                        aria-hidden="true"
                      />
                    </div>
                    <p class="sr-only">{{ review.rating }} out of 5 stars</p>

                    <div
                      class="prose prose-sm mt-4 max-w-none text-gray-500"
                      v-html="review.content"
                    />
                    <a
                      href="https://www.upwork.com/freelancers/paulchrisluke"
                      target="_blank"
                      class="mt-2 text-sm flex items-center text-green-600"
                    >
                      See review on Upwork ↗
                    </a>
                  </div>
                </div>
              </TabPanel>

              <TabPanel class="text-sm text-gray-500">
                <h3 class="sr-only">Frequently Asked Questions</h3>

                <dl>
                  <template v-for="faq in faqs" :key="faq.question">
                    <dt class="mt-10 font-medium text-gray-900">
                      {{ faq.question }}
                    </dt>
                    <dd class="prose prose-sm mt-2 max-w-none text-gray-500">
                      <p>{{ faq.answer }}</p>
                    </dd>
                  </template>
                </dl>
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
  featured: [
    {
      id: 1,
      rating: 5,
      content: `
        <p>Chris was extremely helpful and professional. He exceeded my expectations with this project both in terms of quality, as well as timing. He was able to complete the project under-budget and did an incredible job. I would absolutely hire Chris again. My only hesitation in recommending Chris to someone else would be that I don't want him to be too busy to help me out again in the future.</p>
      `,
      date: "July 16, 2021",
      datetime: "2021-07-16",
      author: "Emily Selman",
    },
    {
      id: 2,
      rating: 5,
      content: `
        <p>I cannot say enough good things about working with Paul. He is a professional that is engaged and willing to help in any way he can. I will be hiring him again in the future and would recommend him to anyone. Thank you again, Paul!</p>
      `,
      date: "July 12, 2021",
      datetime: "2021-07-12",
      author: "Hector Gibbons",
    },
    {
      id: 3,
      rating: 5,
      content: `
        <p>I cannot say enough good things about working with Paul. He is a professional that is engaged and willing to help in any way he can. I will be hiring him again in the future and would recommend him to anyone. Thank you again, Paul!</p>
      `,
      date: "July 12, 2021",
      datetime: "2021-07-12",
      author: "Hector Gibbons",
    },
    // More reviews...
  ],
};
const faqs = [
  {
    question: "What format are these icons?",
    answer:
      "The icons are in SVG (Scalable Vector Graphic) format. They can be imported into your design tool of choice and used directly in code.",
  },
  {
    question: "Can I use the icons at different sizes?",
    answer:
      "Yes. The icons are drawn on a 24 x 24 pixel grid, but the icons can be scaled to different sizes as needed. We don't recommend going smaller than 20 x 20 or larger than 64 x 64 to retain legibility and visual balance.",
  },
  // More FAQs...
];
</script>
