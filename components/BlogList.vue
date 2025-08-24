<template>
  <div class="bg-white">
    <div class="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
      <div class="md:flex md:items-center md:justify-between">
        <h2 class="text-2xl font-bold tracking-tight text-gray-900">Latest blog posts</h2>
        <nuxt-link
          v-show="showSeeAllLink"
          to="/blog"
          class="hidden text-sm font-medium text-indigo-600 hover:text-indigo-500 md:block"
        >
          See all
          <span aria-hidden="true"> &rarr;</span>
        </nuxt-link>
      </div>
      <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4 md:gap-y-0 lg:gap-x-8">
        <nuxt-link 
          :to="post._path" 
          v-for="post in displayedPosts" 
          :key="post._id" 
          class="group relative"
          :aria-label="`Read post: ${post.title}`"
        >
          <div class="mt-6 aspect-w-1 aspect-h-1 rounded-md overflow-hidden bg-gray-200">
            <img 
              :src="post.imageThumbnail" 
              :alt="post.imageAlt" 
              class="object-cover object-center h-full w-full group-hover:scale-105 transform transition duration-1000 group-hover:shadow-md group-hover:rotate-2 group-hover:ease-out"
              loading="lazy"
              decoding="async"
            />
          </div>
          <h3 class="mt-4 text-sm text-gray-700">
              <span class="absolute inset-0" />
              {{ post.title }}
          </h3>
          <p class="mt-1 text-sm text-gray-500">{{ post.tags?.[0] || '' }}</p>
          <p v-if="post.date" class="mt-1 text-xs text-gray-400">
            {{ new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }}
          </p>
        </nuxt-link>
      </div>

      <div  v-show="showSeeAllLink" class="mt-8 text-sm md:hidden">
        <nuxt-link to="/blog" class="font-medium text-indigo-600 hover:text-indigo-500">
          See all
          <span aria-hidden="true"> &rarr;</span>
        </nuxt-link>
      </div>
    </div>
  </div>
</template>
  
<script setup>
const props = defineProps({
  blogData: {
    type: Array,
    default: () => []
  },
  limit: {
    type: Number,
    default: 100
  }
});

// Reactive computed props
const displayedPosts = computed(() => {
  if (!props.limit || props.limit >= props.blogData.length) {
    return props.blogData;
  }
  return props.blogData.slice(0, props.limit);
});

const showSeeAllLink = computed(() => {
  return props.blogData.length > (props.limit || Infinity);
});
</script>
