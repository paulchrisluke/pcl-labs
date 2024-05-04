<template>a
  <div class="bg-white">
    <div class="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
      <div class="md:flex md:items-center md:justify-between">
        <h2 class="text-2xl font-bold tracking-tight text-gray-900">Portfolio</h2>
        <!-- <a href="/Portfolio" class="hidden text-sm font-medium text-indigo-600 hover:text-indigo-500 md:block">
          See all
          <span aria-hidden="true"> &rarr;</span>
        </a> -->
      </div>

      <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4 md:gap-y-0 lg:gap-x-8">
        <div v-for="product in products" :key="product.id" class="group relative">
          <div class="mt-6 aspect-w-1 aspect-h-1 rounded-md overflow-hidden bg-gray-200 group-hover:scale-105 transform transition duration-1000 group-hover:shadow-md group-hover:rotate-2 group-hover:ease-out">
            <img :src="product.imageThumbnail" :alt="product.imageAlt" class="object-cover object-center h-full w-full" />
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
      name: 'Bull City Legal Services',
      color: 'Web & Marketing',
      href: '#',
      price: 'Legal Practices',
      imageSrc: 'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714012904/Blawby/dark-project-app-screenshot.webp',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 2,
      name: 'Volkswagen',
      color: 'Web & Marketing',
      href: '#',
      imageSrc: 'https://scontent.ftpe7-2.fna.fbcdn.net/v/t39.30808-6/420168373_815787680592971_5304035465488745067_n.jpg?_nc_cat=1&ccb=1-7&_nc_sid=5f2048&_nc_ohc=PY1lJB0i0sMQ7kNvgGYB4E1&_nc_ht=scontent.ftpe7-2.fna&oh=00_AfCfl_W55C-eOLTwAtIk7pZYJ84jVKy-pG0V5G05vx1AkQ&oe=66376DE5',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 3,
      name: 'Dentech',
      color: 'Web & Marketing',
      href: '#',
      imageSrc: 'https://i.ytimg.com/vi/AMVUxDvZB7w/maxresdefault.jpg',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 4,
      name: 'US Express',
      color: 'Web & Marketing',
      href: '#',
      imageSrc: 'https://www.upwork.com/att/download/portfolio/persons/uid/444945838176301056/profile/projects/files/1275668465135026176',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 4,
      name: 'Gumball Poodle',
      color: 'Shopify CRO',
      href: '#',
      imageSrc: 'https://www.upwork.com/att/download/portfolio/persons/uid/444945838176301056/profile/projects/files/30f2fb2c-541e-4daa-a7ea-4768b6586715',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 4,
      name: 'vKirirom Pine Resort',
      color: 'Web & Marketing',
      href: '#',
      imageSrc: 'https://www.upwork.com/att/download/portfolio/agencies/uid/1289805767891931136/profile/projects/files/76735f64-c69a-4999-bc5b-f3b8e1202a84',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 4,
      name: 'Taxaroo',
      color: 'Marketing',
      href: '#',
      imageSrc: 'https://globalfintechseries.com/wp-content/uploads/Taxaroo-Launches-ZeroTax.ai-to-Provide-Instant-Tax-Help-with-AI.jpg',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 4,
      name: 'YearlyCo',
      color: 'Shopify CRO',
      href: '#',
      imageSrc: 'https://live.staticflickr.com/65535/53168389331_e73f0938e8_h.jpg',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 4,
      name: 'Phuntoken',
      color: 'Web & Marketing',
      href: '#',
      imageSrc: 'https://www.upwork.com/att/download/portfolio/persons/uid/444945838176301056/profile/projects/files/d4901b2c-e9ce-447c-820a-d90366ef86f5',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 4,
      name: 'LemonApe Stand',
      color: 'Web & Marketing',
      href: '#',
      imageSrc: 'https://t3.ftcdn.net/jpg/02/68/55/60/360_F_268556012_c1WBaKFN5rjRxR2eyV33znK4qnYeKZjm.jpg',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 4,
      name: 'Not The Best Crypto Agency',
      color: 'Web & Marketing',
      href: '#',
      imageSrc: 'https://t3.ftcdn.net/jpg/02/68/55/60/360_F_268556012_c1WBaKFN5rjRxR2eyV33znK4qnYeKZjm.jpg',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    {
      id: 4,
      name: 'Fivable',
      color: 'Shopify CRO',
      href: '#',
      imageSrc: 'https://t3.ftcdn.net/jpg/02/68/55/60/360_F_268556012_c1WBaKFN5rjRxR2eyV33znK4qnYeKZjm.jpg',
      imageAlt: 'Hand stitched, orange leather long wallet.',
    },
    // More products...
  ]
  </script>
