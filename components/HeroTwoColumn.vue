<template>
    <div class="overflow-hidden bg-white py-24 sm:py-32">
      <div class="mx-auto max-w-7xl md:px-6 lg:px-8">
        <div
          class="grid grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:grid-cols-2 lg:items-start"
        >
          <div class="px-6 lg:px-0 lg:pr-4 lg:pt-4">
            <div class="mx-auto max-w-2xl lg:mx-0 lg:max-w-lg">
              <h2 class="text-base font-semibold leading-7 text-indigo-600">
                Deploy faster
              </h2>
              <p
                class="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
              >
                A better workflow
              </p>
              <p class="mt-6 text-lg leading-8 text-gray-600">
                Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores
                impedit perferendis suscipit eaque, iste dolor cupiditate
                blanditiis ratione.
              </p>
              <dl
                class="mt-10 max-w-xl space-y-8 text-base leading-7 text-gray-600 lg:max-w-none"
              >
                <div
                  v-for="feature in features"
                  :key="feature.name"
                  class="relative pl-9"
                >
                  <dt class="inline font-semibold text-gray-900">
                    <component
                      :is="feature.icon"
                      class="absolute left-1 top-1 h-5 w-5 text-indigo-600"
                      aria-hidden="true"
                    />
                    {{ feature.name }}
                  </dt>
                  {{ ' ' }}
                  <dd class="inline">{{ feature.description }}</dd>
                </div>
              </dl>
            </div>
          </div>
  
          <!-- stacked cards -->
          <div class="relative sm:px-6 lg:px-0">
            <div
              v-for="(feature, index) in features"
              :key="index"
              :class="getIndexClass(index)"
              @click="activeCardIndex = index"
              class="cursor-pointer transition ease-in-out delay-150 hover:-translate-y-6 duration-300 drop-shadow-xl absolute isolate overflow-hidden rounded-lg"
              style="width: 500px; height: 500px"
            >
              <img
                :src="feature.img"
                alt="Product screenshot"
                class="w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { CloudArrowUpIcon, LockClosedIcon, ServerIcon } from '@heroicons/vue/20/solid';
  
  const features = [
    {
      name: 'Push to deploy.',
      description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit.',
      icon: CloudArrowUpIcon,
      img: 'https://tailwindui.com/img/component-images/project-app-screenshot.png'
    },
    {
      name: 'SSL certificates.',
      description: 'Anim aute id magna aliqua ad ad non deserunt sunt.',
      icon: LockClosedIcon,
      img: 'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714013454/Blawby/dark-project-analytics-screenshot.webp'
    },
    {
      name: 'Database backups.',
      description: 'Ac tincidunt sapien vehicula erat auctor pellentesque rhoncus.',
      icon: ServerIcon,
      img: 'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714012904/Blawby/dark-project-app-screenshot.webp'
    },
  ];
  
  const activeCardIndex = ref(0);
  
  function getIndexClass(index) {
    // Calculate the position offset based on the active card index
    const order = (index + features.length - activeCardIndex.value) % features.length;
    const positions = ['z-30 -top-4 right-24', 'z-20 -top-12 right-16', 'z-10 -top-20 right-10'];
    return positions[order];
  }
  </script>
  