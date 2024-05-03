<template>
  <div class="bg-white">
    <div class="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
      <div class="md:flex md:items-center md:justify-between">
        <h2 class="text-2xl font-bold tracking-tight text-gray-900">Portfolio</h2>
        <a href="/Portfolio" class="hidden text-sm font-medium text-indigo-600 hover:text-indigo-500 md:block">
          See all
          <span aria-hidden="true"> &rarr;</span>
        </a>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4 md:gap-y-0 lg:gap-x-8">
        <div v-for="product in products" :key="product.id" class="group relative">
          <div class="mt-6 aspect-w-1 aspect-h-1 rounded-md overflow-hidden bg-gray-200 group-hover:scale-105 transform transition duration-1000 group-hover:shadow-md group-hover:rotate-2 group-hover:ease-out">
            <img :src="product.imageSrc" :alt="product.imageAlt" class="object-cover object-center h-full w-full" />
          </div>
          <h3 class="mt-4 text-sm text-gray-700">
            <a :href="product.href">
              <span class="absolute inset-0" />
              {{ product.name }}
            </a>
          </h3>
          <p class="mt-1 text-sm text-gray-500">{{ product.color }}</p>
          <!-- <button class="mt-1 bg-gray-500 hover:bg-gray-700 text-xs text-white font-bold py-1 px-2 rounded-full">
              {{ product.price }}
            </button> -->
        </div>
      </div>

      <div class="mt-8 text-sm md:hidden">
        <a href="/portfolio" class="font-medium text-indigo-600 hover:text-indigo-500">
          See all
          <span aria-hidden="true"> &rarr;</span>
        </a>
      </div>
    </div>
  </div>
</template>
  
  <script setup>
  const products = [
    {
      id: 1,
      name: 'Volkswagen',
      color: 'Web & Marketing',
      href: 'https://www.upwork.com/att/download/portfolio/persons/uid/444945838176301056/profile/projects/files/74c564c2-4942-42dd-af23-8e90a1dd7fc4',
      imageSrc: 'https://scontent.ftpe7-2.fna.fbcdn.net/v/t39.30808-6/420168373_815787680592971_5304035465488745067_n.jpg?_nc_cat=1&ccb=1-7&_nc_sid=5f2048&_nc_ohc=PY1lJB0i0sMQ7kNvgGYB4E1&_nc_ht=scontent.ftpe7-2.fna&oh=00_AfCfl_W55C-eOLTwAtIk7pZYJ84jVKy-pG0V5G05vx1AkQ&oe=66376DE5',
      imageAlt: 'Volkswagen Web and Marketing by PCL Labs',
    },
    {
      id: 2,
      name: 'US Express',
      color: 'Web & Marketing',
      href: 'https://www.upwork.com/att/download/portfolio/persons/uid/444945838176301056/profile/projects/files/74c564c2-4942-42dd-af23-8e90a1dd7fc4',
      imageSrc: 'https://www.upwork.com/att/download/portfolio/persons/uid/444945838176301056/profile/projects/files/1275668465135026176',
      imageAlt: 'US Express Web and Marketing by PCL Labs',
    },
    {
      id: 3,
      name: 'Gumball Poodle',
      color: 'Shopify CRO',
      href: 'https://www.upwork.com/att/download/portfolio/persons/uid/444945838176301056/profile/projects/files/74c564c2-4942-42dd-af23-8e90a1dd7fc4',
      imageSrc: 'https://www.upwork.com/att/download/portfolio/persons/uid/444945838176301056/profile/projects/files/30f2fb2c-541e-4daa-a7ea-4768b6586715',
      imageAlt: 'Gumball Poodle Shopify CRO by PCL Labs',
    },
    {
      id: 5,
      name: 'Phuntoken',
      color: 'Web & Marketing',
      href: 'https://www.upwork.com/att/download/portfolio/persons/uid/444945838176301056/profile/projects/files/74c564c2-4942-42dd-af23-8e90a1dd7fc4',
      imageSrc: 'https://www.upwork.com/att/download/portfolio/persons/uid/444945838176301056/profile/projects/files/d4901b2c-e9ce-447c-820a-d90366ef86f5',
      imageAlt: 'Phuntoken Web and Marketing by PCL Labs',
    },
    // More products...
  ]
  </script>
