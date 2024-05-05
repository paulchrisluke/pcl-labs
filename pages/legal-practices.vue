<template>
  <div>
    <HeroProduct>
      <template #image>
        <img
          src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714012904/Blawby/dark-project-app-screenshot.webp"
          alt="Legal Practices Featured Image"
          class="object-cover object-center"
        />
      </template>
      <template #name> Legal Website, Marketing, and Design </template>
      <template #description>
        With over 15 years of experience. Paul Chris Luke and his team deliver
        best in class legal websites which generate qualified leads every day.
      </template>
      <template #demo>
        <button
          type="button"
          onclick="window.open('https://www.bullcitylegalservices.com', '_blank')"
          class="justify-center rounded-md border border-transparent bg-indigo-50 px-8 py-3 text-base font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50"
        >
          Live Demo ↗
        </button>
      </template>
      <template #highlights>
        <ul role="list">
          <li v-for="highlight in product.highlights" :key="highlight">
            {{ highlight }}
          </li>
        </ul>
      </template>
    </HeroProduct>
    <FeatureGrid>
      <template #subhead> Get More Leads </template>
      <template #heading>
        Everything you need to get more scheduled consultations
      </template>
      <template #description>
        Includes everything you need to build your legal practice online,
        including scheduling, media kits, ad support and more.
      </template>
      <template #features>
        <div
          v-for="feature in features"
          :key="feature.name"
          class="relative pl-16"
        >
          <dt class="text-base font-semibold leading-7 text-white">
            <div
              class="absolute top-0 left-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600"
            >
              <component
                :is="feature.icon"
                class="h-6 w-6 text-white"
                aria-hidden="true"
              />
            </div>
            {{ feature.name }}
          </dt>
          <dd class="mt-2 text-base leading-7 text-gray-300">
            {{ feature.description }}
          </dd>
        </div>
      </template>
    </FeatureGrid>
    <Design>
      <template #designimages>
        <div
          class="ml-auto w-44 flex-none space-y-8 pt-32 sm:ml-0 sm:pt-80 lg:order-last lg:pt-36 xl:order-none xl:pt-80"
        >
          <div class="relative">
            <img
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714097484/Blawby/Frame_5_ohptmi.webp"
              alt=""
              class="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
            />
            <div
              class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10"
            />
          </div>
        </div>
        <div class="mr-auto w-44 flex-none space-y-8 sm:mr-0 sm:pt-52 lg:pt-36">
          <div class="relative">
            <img
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714097484/Blawby/Frame_3_zoxx5o.webp"
              alt=""
              class="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
            />
            <div
              class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10"
            />
          </div>
          <div class="relative">
            <img
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714097484/Blawby/Frame_2_plxrd5.webp"
              alt=""
              class="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
            />
            <div
              class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10"
            />
          </div>
        </div>
        <div class="w-44 flex-none space-y-8 pt-32 sm:pt-0">
          <div class="relative">
            <img
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714097484/Blawby/Frame_4_rttrb1.webp"
              alt=""
              class="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
            />
            <div
              class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10"
            />
          </div>
          <div class="relative">
            <img
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714097483/Blawby/Frame_1_vfu7is.webp"
              alt=""
              class="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
            />
            <div
              class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10"
            />
          </div>
        </div>
      </template>
    </Design>
    <FeaturePanel />
    <CtaFull />
  </div>
</template>

<script setup>
useHead({
  title: "Get More Scheduled Leads for Your Legal Practice | PCL-Labs",
  meta: [
    { name: "description", content: "My amazing site." },
    {
      property: "og:title",
      content: "Get More Scheduled Leads for Your Legal Practice | PCL-Labs",
    }, // OG title
    { property: "og:description", content: "My amazing site." }, // OG description
    {
      property: "og:image",
      content: "https://example.com/path-to-your-image.jpg",
    }, // OG image URL
  ],
});

import { ref } from "vue";
import {
  ArrowTrendingUpIcon,
  CalendarIcon,
  PhoneIcon,
  BriefcaseIcon,
} from "@heroicons/vue/24/outline";

const product = {
  highlights: [
    "Calendly scheduling intigration",
    "Hubspot list generation",
    "Best-in-Class SEO markup",
    "Google & Meta ad support",
    "Blog & Content production",
  ],
};

const features = ref([
  {
    name: "Scheduling",
    description:
      "Fully integrated with Calendly. Schedule consultations, automatically handle rescheduling, integrate with Google calendar.",
    icon: CalendarIcon,
  },
  {
    name: "Media Kits",
    description:
      "Beautifully designed brand support. Logo, business cards, letterhead, and social media assets designed for you in editable Google docs/drive.",
    icon: BriefcaseIcon,
  },
  {
    name: "Ad Management",
    description:
      "Google & Meta ad management. Get brand exposure across media channels in your state. Special $10,000/mo FREE Google Search ad credit available for nonprofits.",
    icon: ArrowTrendingUpIcon,
  },
  {
    name: "24/7 Support",
    description:
      "Always maintained, always best-in-class. No need to worry about domain, hosting, or platform management.",
    icon: PhoneIcon,
  },
]);
</script>
