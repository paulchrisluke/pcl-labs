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
      <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <nuxt-link 
          :to="post._path" 
          v-for="post in displayedPosts" 
          :key="post._id" 
          class="group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden"
          :aria-label="`Read post: ${post.title}`"
        >
          <!-- Image container with fixed aspect ratio for portrait images -->
          <div class="aspect-[4/3] rounded-lg overflow-hidden bg-gray-200">
            <!-- Show actual image if available -->
            <img 
              v-if="getImageUrl(post)"
              :src="getImageUrl(post)" 
              :alt="post.title" 
              class="object-cover object-center h-full w-full group-hover:scale-105 transform transition duration-300"
              loading="lazy"
              decoding="async"
              @error="handleImageError"
            />
            <!-- Show placeholder if no image -->
            <div 
              v-else
              class="h-full w-full bg-gray-700 flex items-center justify-center"
            >
              <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div class="p-4">
            <h3 class="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
              <span class="absolute inset-0" />
              {{ post.title }}
            </h3>
            <p v-if="post.description" class="mt-2 text-sm text-gray-600 line-clamp-2">
              {{ post.description }}
            </p>
            <div class="mt-3 flex items-center justify-between">
              <p v-if="getFirstTag(post)" class="text-xs font-medium text-indigo-600">
                {{ getFirstTag(post) }}
              </p>
              <p v-if="post.date" class="text-xs text-gray-400">
                {{ formatDate(post.date) }}
              </p>
            </div>
          </div>
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

// Simple image helper - use what the API provides
const getImageUrl = (post) => {
  return post.imageThumbnail || post.image || null;
};

const getFirstTag = (post) => {
  if (post.tags && post.tags.length > 0) {
    return post.tags[0];
  }
  return '';
};

const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (error) {
    return '';
  }
};

const handleImageError = (event) => {
  // Hide the image if it fails to load to prevent 404 loops
  event.target.style.display = 'none';
};
</script>
