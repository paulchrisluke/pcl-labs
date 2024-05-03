<template>
  <div class="bg-white py-12 sm:py-16">
    <div class="mx-auto grid max-w-7xl gap-x-8 gap-y-20 px-6 lg:px-8 xl:grid-cols-3">
      <div class="max-w-2xl">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Meet our team</h2>
        <p class="mt-6 text-lg leading-8 text-gray-600">PCL-Labs provides full-funnel marketing and advertising from brand positioning, research, data science and full-stack development to video/photo content, and more!</p>
      </div>
      <ul role="list" class="grid gap-x-8 gap-y-12 sm:grid-cols-2 sm:gap-y-16 xl:col-span-2">
        <li v-for="person in people" :key="person.name">
          <div class="flex items-center gap-x-6">
            <img class="h-16 w-16 rounded-full" :src="person.imageUrl" alt="" />
            <div>
              <h3 class="text-base font-semibold leading-7 tracking-tight text-gray-900">{{ person.name }}</h3>
              <p class="text-sm font-semibold leading-6 text-gray-600">{{ person.role }}</p>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
  
  <script setup>
  const people = [
    {
      name: 'Paul "Chris" Luke',
      role: 'CEO/Ads',
      imageUrl:
        'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714697364/Blawby/1_qjKv1vv3WC6ckf3eTM0hZQ_1_nf3uuk.png',
      xUrl: '#',
      linkedinUrl: '#',
    },
    {
      name: 'Joe Elia',
      role: 'CTO',
      imageUrl:
        'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714696998/Blawby/1516626952082_zfnyjg.jpg',
    },
    {
      name: 'Koko',
      role: 'Lead Designer',
      imageUrl:
        'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714697575/Blawby/pexels-moose-photos-170195-1586996_1_fl9flx.png',
    },
    {
      name: 'PizzaWizard',
      role: 'Lead Developer',
      imageUrl:
        'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714697827/Blawby/pexels-olly-3785104_1_hyzlxu.png',
    },
    {
      name: 'Jeremie Venditti',
      role: 'Digital Marketer',
      imageUrl:
        'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714696982/Blawby/1616768161241_zh0v0k.jpg',
    },
    {
      name: 'Brittni S.',
      role: 'Content Writer',
      imageUrl:
        'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714697264/Blawby/e9697fff-b8eb-4312-93ca-e375fdfe7e2b_yucg6j.webp',
    },
    {
      name: 'Julia Chow',
      role: 'UI/UX Designer',
      imageUrl:
        'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714706641/Blawby/1682091954266_vrcx3n.webp',
    },
    {
      name: 'Rich Gittings',
      role: 'Legal/Office Cheerleader',
      imageUrl:
        'https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714706577/Blawby/rich-gittings_qazszp.webp',
    },
    // More people...
  ]
  </script>