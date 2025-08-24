<template>
  <div class="bg-white">
    <div class="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
      <div class="md:flex md:items-center md:justify-between">
        <h2 class="text-2xl font-bold tracking-tight text-gray-900">Recently viewed projects</h2>
        <nuxt-link
          v-show="showSeeAllLink"
          to="/portfolio"
          class="hidden text-sm font-medium text-indigo-600 hover:text-indigo-500 md:block"
        >
          See all
          <span aria-hidden="true"> &rarr;</span>
        </nuxt-link>
      </div>
      <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4 md:gap-y-0 lg:gap-x-8">
        <nuxt-link :to="product._path" v-for="product in portfolioData" :key="product._id" class="group relative">
          <div class="mt-6 aspect-w-1 aspect-h-1 rounded-md overflow-hidden bg-gray-200 group-hover:scale-105 transform transition duration-1000 group-hover:shadow-md group-hover:rotate-2 group-hover:ease-out">
            <img :src="product.imageThumbnail" :alt="product.imageAlt" class="object-cover object-center h-full w-full" />
          </div>
          <h3 class="mt-4 text-sm text-gray-700">
              <span class="absolute inset-0" />
              {{ product.title }}
          </h3>
          <p class="mt-1 text-sm text-gray-500">{{ product.tags?.[0] || '' }}</p>
        </nuxt-link>
      </div>

      <div  v-show="showSeeAllLink" class="mt-8 text-sm md:hidden">
        <nuxt-link to="/portfolio" class="font-medium text-indigo-600 hover:text-indigo-500">
          See all
          <span aria-hidden="true"> &rarr;</span>
        </nuxt-link>
      </div>
    </div>
  </div>
</template>
  
<script setup>
const props = defineProps({
  portfolioData: {
    type: Array,
    default: () => []
  },
  limit: {
    type: Number,
    default: 100
  }
});

const showSeeAllLink = props.limit <= 10; //will only show see all if you limit the prop to 10 or less
</script>
