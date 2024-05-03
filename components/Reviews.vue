<template>
  <div class="bg-white">
    <div class="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
      <h2 class="text-lg font-medium text-gray-900">Recent reviews</h2>
      <div class="mt-6 space-y-10 divide-y divide-gray-200 border-b border-t border-gray-200 pb-10">
        <div v-for="review in reviews" :key="review.id" class="pt-10 lg:grid lg:grid-cols-12 lg:gap-x-8">
          <div class="lg:col-span-8 lg:col-start-5 xl:col-span-9 xl:col-start-4 xl:grid xl:grid-cols-3 xl:items-start xl:gap-x-8">
            <div class="flex items-center xl:col-span-1">
              <div class="flex items-center">
                <StarIcon v-for="rating in [0, 1, 2, 3, 4]" :key="rating" :class="[review.rating > rating ? 'text-yellow-400' : 'text-gray-200', 'h-5 w-5 flex-shrink-0']" aria-hidden="true" />
              </div>
              <p class="ml-3 text-sm text-gray-700">{{ review.rating }}<span class="sr-only"> out of 5 stars</span></p>
            </div>

            <div class="flex items-center xl:col-span-1 xl:col-start-1 xl:mt-2">
              <a href="#" class="text-sm flex items-center text-green-600">
                See review on Upwork
                <ArrowTopRightOnSquareIcon class="ml-1 h-5 w-5" aria-hidden="true" />
              </a>
            </div>

            <div class="mt-4 lg:mt-6 xl:col-span-2 xl:mt-0">
              <h3 class="text-sm font-medium text-gray-900">{{ review.title }}</h3>
              <div class="mt-3 space-y-6 text-sm text-gray-500" v-html="review.content" />
            </div>
          </div>

          <div class="mt-6 flex items-center text-sm lg:col-span-4 lg:col-start-1 lg:row-start-1 lg:mt-0 lg:flex-col lg:items-start xl:col-span-3">
            <p class="font-medium text-gray-900">{{ review.author }}</p>
            <time :datetime="review.datetime" class="ml-4 border-l border-gray-200 pl-4 text-gray-500 lg:ml-0 lg:mt-2 lg:border-0 lg:pl-0">{{ review.date }}</time>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { StarIcon, ArrowTopRightOnSquareIcon } from '@heroicons/vue/20/solid'

const reviews = [
  {
    id: 1,
    title: "Legal Website Developer and Nonprofit Google Ads Manager",
    rating: 5,
    content: `
      <p>"Chris was extremely helpful and professional. He exceeded my expectations with this project both in terms of quality, as well as timing. He was able to complete the project under-budget and did an incredible job. I would absolutely hire Chris again. My only hesitation in recommending Chris to someone else would be that I don't want him to be too busy to help me out again in the future."</p>
    `,
    author: 'Rich G',
    date: 'July 23, 2023',
    datetime: '2023-23-07',
  },
  {
    id: 2,
    title: "Shopify Expert Needed to Build E-commerce Store for American-Made Products",
    rating: 5,
    content: `
      <p>"I cannot say enough good things about working with Paul. He is a professional that is engaged and willing to help in any way he can. I will be hiring him again in the future and would recommend him to anyone. Thank you again, Paul!"</p>
    `,
    author: 'Trent H',
    date: 'July 7, 2023',
    datetime: '2023-07-07',
  },
  {
    id: 3,
    title: "Landing Page Design and Optimization",
    rating: 5,
    content: `
      <p>"He's the real deal, exactly as advertised. Increased our conversion rate almost 10x on our landing page, hope to work with him again soon."</p>
    `,
    author: 'HI Inc.',
    date: 'May 2, 2023',
    datetime: '2023-02-05',
  },
  {
    id: 4,
    title: "Google Shopping & Shopify Feed Sync (ad setup, audit, cro performance)",
    rating: 5,
    content: `
      <p>"Great experience working with Luke again. He fixed an google ad account that another agency had poorly managed. Luke is very efficient with his time and made sure everything was running smoothly before concluding the contract. 10/10"</p>
    `,
    author: 'Russ K.',
    date: 'Aug 9, 2022',
    datetime: '2022-09-08',
  },
  {
    id: 5,
    title: "Fractional CMO for Real Estate backed Crypto",
    rating: 5,
    content: `
      <p>"Paul is excellent, and very knowledgeable in the crypto space, and gave us exactly what we needed in a timely manner. Would love to work with him again!"</p>
    `,
    author: 'Primior LLC',
    date: 'July 19, 2022',
    datetime: '2022-19-07',
  },
  // More reviews...
]
</script>
