<template>
  <div>
    <HeroProduct>
      <template #image>
        <img
          src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1714789945/Blawby/Gumball_Poodle_Featured_izz3em.webp"
          alt="Shopify Featured Image"
          class="object-cover object-center"
        /> 
      </template>
      <template #name>Shopify Website, Marketing, and Design </template>
      <template #description>
        <p>Google Certified CRO expert. Shopify Plus Partner & eCommerce... revenue focused. We audit your store and provide best in class suggestions to improve your conversions year over year based on 15 years of experience in eCommerce.</p>
        &nbsp  
        <p>Specialized in Shopify Plus Partner accounts, PCL-Labs helps grow shops above $10M annual revenue. We work with enterprise development and design teams in Agile/Scrum style, ensuring you can focus on your business, we'll handle the nerdy stuff 🚀</p>
      </template>
      <template #demo>
        <button
          type="button"
          onclick="window.open('https://www.gumballpoodle.com', '_blank')"
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
      <template #subhead> Get More Sales </template>
      <template #heading>
        Everything you need to get more conversions using Shopify
      </template>
      <template #description>
        We will give you specific, customized suggestions to bring your store to $10/M per year, just like we've done before.
        Includes CRO audits, upsells, bundle builders and more.
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
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715060226/Blawby/Frame_17_ibmbal.webp"
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
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715060226/Blawby/Frame_18_ockdph.webp"
              alt=""
              class="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
            />
            <div
              class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10"
            />
          </div>
          <div class="relative">
            <img
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715060228/Blawby/Frame_19_idldwf.webp"
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
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715060229/Blawby/Frame_20_pby7lu.webp"
              alt=""
              class="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
            />
            <div
              class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10"
            />
          </div>
          <div class="relative">
            <img
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715060225/Blawby/Frame_16_n7bbqs.webp"
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
  title: "Shopify CRO & Development | PCL-Labs",
  meta: [
    { name: "description", content: "My amazing site." },
    {
      property: "og:title",
      content: "Shopify CRO & Development | PCL-Labs",
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
  CurrencyDollarIcon,
  PhoneIcon,
  CommandLineIcon,
} from "@heroicons/vue/24/outline";
import { StarIcon } from "@heroicons/vue/20/solid";

const product = {
  highlights: [
  "Shopify Plus Partner (greater than $10/M annually)",  
  "1 Week CRO audits",
    "Shopify 2.0 native development (no page builders)",
    "Google Merchant, Analytics, GTM integration",
    "Meta & TikTok pixel/tracking & integration",
    "Best-in-class app stack for conversions",
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
    question: "What format are these icons?", //just write what i sent in that upwork interview back
    answer:
      "The icons are in SVG (Scalable Vector Graphic) format. They can be imported into your design tool of choice and used directly in code.",
  },
  {
    question: "Can I use the icons at different sizes?",
    answer:
      "Yes. The icons are drawn on a 24 x 24 pixel grid, but the icons can be scaled to different sizes as needed. We don't recommend going smaller than 20 x 20 or larger than 64 x 64 to retain legibility and visual balance.",
  },
  // More FAQs...
];

const features = ref([
  {
    name: "CRO Audits",
    description:
      "In 5 days, we will audit your eCommerce from top to bottom. User flow, design, app integrations, and shop experience improvements.",
    icon: CurrencyDollarIcon,
  },
  {
    name: "Shopify 2.0 Development",
    description:
      "Page builders suck. They decrease your page speed, and create an overly complex page for something that should be Shopify native. ",
    icon: CommandLineIcon,
  },
  {
    name: "Ad Management",
    description:
      "Google Merchant, Meta store, TikTok store. Get brand exposure across media channels Special $10,000/mo FREE Google Search ad credit available for nonprofits.",
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
