<template>
  <div>
    <HeroProduct>
      <template #image>
        <img
          src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714789949/Blawby/Volkswagen_Featured_tj5mnw.webp"
          alt="Logistics Practices Featured Image"
          class="object-cover object-center"
        />
      </template>
      <template #name>Volkswagen, U.S. Xpress, and More - Send Your Message </template>
      <template #description>
        <p>With proven case studies by Google & Cloudflare, PCL-Labs helps logistics companies hire more drivers & send more messages, all fully tracked, quanitified, and actionable.</p>
        &nbsp
        <ul>
        <li>✅ $15/M per month in ad spend MANAGED</li>
        <li>✅ Craiglist, Indeed, Google/Meta, ads integrated</li>
        <li>✅ Server-side tracking, no pixels/cookies & accurate</li>
        </ul>

      </template>
      <template #demo>
        <button
          type="button"
          onclick="window.open('https://www.usxjobs.com', '_blank')"
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
      <template #reviewlist>
        <div
          v-for="(review, reviewIdx) in reviews.featured"
          :key="review.id"
          class="flex space-x-4 text-sm text-gray-500"
        >
          <div
            :class="[
              reviewIdx === 0 ? '' : 'border-t border-gray-200',
              'py-10',
            ]"
          >
            <h3 class="font-medium text-gray-900">
              {{ review.author }}
            </h3>
            <p>
              <time :datetime="review.datetime">{{ review.date }}</time>
            </p>

            <div class="mt-4 flex items-center">
              <StarIcon
                v-for="rating in [0, 1, 2, 3, 4]"
                :key="rating"
                :class="[
                  review.rating > rating ? 'text-yellow-400' : 'text-gray-300',
                  'h-5 w-5 flex-shrink-0',
                ]"
                aria-hidden="true"
              />
            </div>
            <p class="sr-only">{{ review.rating }} out of 5 stars</p>

            <div
              class="prose prose-sm mt-4 max-w-none text-gray-500"
              v-html="review.content"
            />
            <a
              href="https://www.upwork.com/freelancers/paulchrisluke"
              target="_blank"
              class="mt-2 text-sm flex items-center text-green-600"
            >
              See review on Upwork ↗
            </a>
          </div>
        </div>
      </template>
      <template #faqlist>
        <dl>
                  <template v-for="faq in faqs" :key="faq.question">
                    <dt class="mt-10 font-medium text-gray-900">
                      {{ faq.question }}
                    </dt>
                    <dd class="prose prose-sm mt-2 max-w-none text-gray-500">
                      <p>{{ faq.answer }}</p>
                    </dd>
                  </template>
                </dl>
      </template>
    </HeroProduct>
    <FeatureGrid>
      <template #subhead> Insights Bringing Conversions </template>
      <template #heading>
        Everything you need to support drivers worldwide 
      </template>
      <template #description>
        Helping Volkswagen track email engagement, US Xpress hire more drivers, and more.
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
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715061269/Blawby/Frame_21_i9n4d0.webp"
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
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715061270/Blawby/Frame_22_cka5hb.webp"
              alt=""
              class="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
            />
            <div
              class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10"
            />
          </div>
          <div class="relative">
            <img
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715061271/Blawby/Frame_23_oreeqn.webp"
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
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715061803/Blawby/Frame_25_dh04fw.webp"
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
  title: "Recruit More Drivers with Logistics Landing Pages",
  meta: [
    { name: "description", content: "My amazing site." },
    {
      property: "og:title",
      content: "Recruit More Drivers with Logistics Landing Pages",
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
import { StarIcon } from "@heroicons/vue/20/solid";

const product = {
  highlights: [
    "AMP Html pages for instant mobile page load time",
    "Server-side tracking, always accurate, always on-time",
    "Best-in-Class SEO markup",
    "Google, Meta, Craiglist, Indeed ad integrations",
    "PowerBI, Tableau, and API ready for rapid deployment and tracking" 
  ],
};

const reviews = {
  featured: [
    {
      id: 1,
      rating: 5,
      content: `
        <p>Chris was extremely helpful and professional. He exceeded my expectations with this project both in terms of quality, as well as timing. He was able to complete the project under-budget and did an incredible job. I would absolutely hire Chris again. My only hesitation in recommending Chris to someone else would be that I don't want him to be too busy to help me out again in the future.</p>
      `,
      date: "July 16, 2021",
      datetime: "2021-07-16",
      author: "Emily Selman",
    },
    {
      id: 2,
      rating: 5,
      content: `
        <p>I cannot say enough good things about working with Paul. He is a professional that is engaged and willing to help in any way he can. I will be hiring him again in the future and would recommend him to anyone. Thank you again, Paul!</p>
      `,
      date: "July 12, 2021",
      datetime: "2021-07-12",
      author: "Hector Gibbons",
    },
    {
      id: 3,
      rating: 5,
      content: `
        <p>I cannot say enough good things about working with Paul. He is a professional that is engaged and willing to help in any way he can. I will be hiring him again in the future and would recommend him to anyone. Thank you again, Paul!</p>
      `,
      date: "July 12, 2021",
      datetime: "2021-07-12",
      author: "Hector Gibbons",
    },
    // More reviews...
  ],
};

const faqs = [
  {
    question: "How can you help me hire more drivers?",
    answer:
      "We perform a comprehensive audit to identify where your conversions (phone calls, job applications, etc.) could be improved. This audit report contains items to improve your conversion rates which can be actioned internally, or by PCL-Labs. These items can include page speed improvement, ad optimization, or integrated solutions.",
  },
  {
    question: "I'm locked into an existing vendor, can you integrate?",
    answer:
      "Yes. We worked with Volkswagens IT systems to seemlessly offer our analytics solutions without needing to disrupt their existing work. Our goal is to lift conversions without 'bumps in the road'",
  },
  // More FAQs...
];

const features = ref([
  {
    name: "CDL Driver Recruitment",
    description:
      "With dynamic, hyper performant landing pages, PCL-Labs increases the conversion rate of your driver recruitment pages by up to 62%.",
    icon: CalendarIcon,
  },
  {
    name: "World Class Analytics",
    description:
      "Featured in Case Studies by Google and Cloudflare. Our tracking does NOT rely on cookies or pixels. Server-side, accurate, insightful and full integrated with Google, Meta, Indeed, and other ad buying platforms.",
    icon: BriefcaseIcon,
  },
  {
    name: "Ad Management",
    description:
      "Google & Meta ad management. Get brand exposure across media channels in your region. Special $10,000/mo FREE Google Search ad credit available for nonprofits.",
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
