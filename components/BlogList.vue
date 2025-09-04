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
            <!-- Show actual image if available -->
            <img 
              v-if="getImageUrl(post) && getImageUrl(post) !== '/img/blog-placeholder.jpg'"
              :src="getImageUrl(post)" 
              :alt="post.imageAlt || post.title" 
              class="object-cover object-center h-full w-full group-hover:scale-105 transform transition duration-1000 group-hover:shadow-md group-hover:rotate-2 group-hover:ease-out"
              loading="lazy"
              decoding="async"
              @error="handleImageError"
            />
            <!-- Show placeholder heroicon if no image -->
            <div 
              v-else
              class="h-full w-full bg-gray-700 flex items-center justify-center object-cover object-center"
            >
              <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h3 class="mt-4 text-sm text-gray-700">
              <span class="absolute inset-0" />
              {{ post.title }}
          </h3>
          <p class="mt-1 text-sm text-gray-500">{{ getFirstTag(post) }}</p>
          <p v-if="post.date" class="mt-1 text-xs text-gray-400">
            {{ formatDate(post.date) }}
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

// Helper functions for the new API data structure
const getImageUrl = (post) => {
  // Debug: Log what we're getting
  console.log('Blog post data:', {
    title: post.title,
    image: post.image,
    frontmatter: post.frontmatter,
    story_count: post.story_count,
    date: post.date
  });
  
  // Check for image in frontmatter.og["og:image"] first
  if (post.frontmatter?.og?.["og:image"]) {
    console.log('Using frontmatter.og["og:image"]:', post.frontmatter.og["og:image"]);
    return post.frontmatter.og["og:image"];
  }
  
  // Check for image in frontmatter.schema.article.image
  if (post.frontmatter?.schema?.article?.image) {
    console.log('Using frontmatter.schema.article.image:', post.frontmatter.schema.article.image);
    return post.frontmatter.schema.article.image;
  }
  
  // Use the direct image field from the API
  if (post.image) {
    console.log('Using post.image:', post.image);
    return post.image;
  }
  
  // Check for story images if available
  if (post.story_count > 0) {
    const datePath = post.date.replace(/-/g, '/')
    const dateId = post.date.replace(/-/g, '')
    const storyImage = `/stories/${datePath}/story_${dateId}_pr42_01_intro.png`
    console.log('Using story image:', storyImage);
    return storyImage;
  }
  
  // Return placeholder if no image available
  console.log('No image found, using placeholder');
  return '/img/blog-placeholder.jpg';
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
