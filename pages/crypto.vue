<template>
  <div>
    <HeroProduct>
      <template #image>
        <img
          src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715337050/Blawby/pcl-labs-crypto-featured_yr9dq8.webp"
          alt="Crypto Featured Image"
          class="object-cover object-center"
        />
      </template>
      <template #name>Crypto Development, Marketing, and Design </template>
      <template #description>
        <p>Marketers, influencers, developers, artists, and social media management all under one roof. With over a decade of large enterprise marketing experience, we utilize successful methods to push crypto projects to success.</p>
        <ul>
        <li>✅ Launched over 13 projects</li>
        <li>✅ Total volume of more than $500 Million</li>
        <li>✅ Dankest meme creators around</li>
        </ul>

      </template>
      <template #demo>
        <button
          type="button"
          onclick="window.open('https://www.phuntoken.com', '_blank')"
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
      <template #subhead> Moon Launches </template>
      <template #heading>
        Everything you need to launch your crypto project
      </template>
      <template #description>
        From project planning and development, to pre-launch marketing and raids, community management across discord, twitter, telegram, all the way to post launch twitter spaces and more. We handle your token launch end-to-end.
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
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715060060/Blawby/Frame_11_jalk7s.webp"
              alt="PCL-Labs Crypto Example 1"
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
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715060060/Blawby/Frame_12_ugjegd.webp"
              alt="PCL-Labs Crypto Example 2"
              class="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
            />
            <div
              class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10"
            />
          </div>
          <div class="relative">
            <img
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715060060/Blawby/Frame_14_dg747m.webp"
              alt="PCL-Labs Crypto Example 3"
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
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715060060/Blawby/Frame_13_qikequ.webp"
              alt="PCL-Labs Crypto Example 4"
              class="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
            />
            <div
              class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10"
            />
          </div>
          <div class="relative">
            <img
              src="https://res.cloudinary.com/image-gallery-pcl/image/upload/v1715060060/Blawby/Frame_15_zamfnw.webp"
              alt="PCL-Labs Crypto Example 5"
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
    <ProductList :limit="8" />
    <CtaFull />
  </div>
</template>

<script setup>
useHead({
  title: "Crypto Marketing & Development for Enterprise",
  meta: [
    { name: "description", content: "With over a decade of large enterprise marketing experience, we utilize successful methods to push crypto projects to success." },
    {
      property: "og:title",
      content: "Crypto Marketing & Development for Enterprise",
    }, // OG title
    { property: "og:description", content: "With over a decade of large enterprise marketing experience, we utilize successful methods to push crypto projects to success." }, // OG description
    {
      property: "og:image",
      content: "/PCL-crypto-header.webp",
    }, // OG image URL
    { name: 'keywords', content: 'Crypto Community Building, Professional Crypto Marketing Team, Crypto Development Services, Crypto Marketing Experts, Top Rated Crypto Agency, Crypto Meme Content Creation, Expert Crypto Developers, Shopify, web development, marketing, SEO, PCL-Labs, Paul Chris Luke' }  // Keywords for SEO
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
    "Community managament and marketing",
    "Smart contract development",
    "Quantstamp™ audited and certified",
    "Meme content production",
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
    question: "Will you work on equity/token allocation instead of your normal fee?",
    answer:
      "We commonly work on a hybrid of fiat and crypto based payment. It is rare that we work for only token allocation alone.",
  },
  {
    question: "You are doxxed, can you work anonomously?",
    answer:
      "Yes... we prefer it, actually!",
  },
  // More FAQs...
];

const features = ref([
  {
    name: "Community Managament and Marketing",
    description:
      "Pre-launch, stealth launch, and social media planning. PCL-Labs uses Twitter, Telegram, and discord to build hype around your project.",
    icon: CalendarIcon,
  },
  {
    name: "Smart Contract Development",
    description:
      "Etherium, Solidity, Base. Quantstamp™ certified and smart contracts hand built by our best in class devs. SXSW Official Sponsor.",
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
