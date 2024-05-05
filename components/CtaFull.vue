<template>
  <div class="overflow-hidden bg-gray-900 pt-32">
    <div class="mx-auto max-w-7xl px-6 lg:flex lg:px-8">
      <div class="mx-auto grid max-w-2xl grid-cols-1 gap-x-12 gap-y-16 lg:mx-0 lg:min-w-full lg:max-w-none lg:flex-none lg:gap-y-8">
        <div class="lg:col-end-1 lg:w-full lg:max-w-lg lg:pb-8">
          <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">Boost your conversions.
Request a quote today.</h2>
          <p class="mt-6 text-xl leading-8 text-gray-300">You were probably sent here via a referral from one of our clients. Request a quote to see how we can increase your converisons across the board.</p>
          <!-- <p class="mt-6 text-base leading-7 text-gray-300">Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo. Elit sunt amet fugiat veniam occaecat fugiat. Quasi aperiam sit non sit neque reprehenderit.</p> -->
          <div class="mt-10 flex">
            <button type="button" onclick="window.location.href='/contact'" class="relative inline-flex items-center gap-x-1.5 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
              <EnvelopeIcon class="-ml-0.5 h-5 w-5" aria-hidden="true" />
              Contact Us
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-start justify-end gap-6 sm:gap-8 lg:contents">
          <div class="w-0 flex-auto lg:ml-auto lg:w-auto lg:flex-none lg:self-end">
            <img src="https://images.unsplash.com/photo-1670272502246-768d249768ca?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1152&q=80" alt="" class="aspect-[7/5] w-[37rem] max-w-none rounded-2xl bg-gray-50 object-cover" />
          </div>
          <div class="contents lg:col-span-2 lg:col-end-2 lg:ml-auto lg:flex lg:w-[37rem] lg:items-start lg:justify-end lg:gap-x-8">
            <div class="order-first flex w-64 flex-none justify-end self-end lg:w-auto">
              <img src="https://images.unsplash.com/photo-1605656816944-971cd5c1407f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=768&h=604&q=80" alt="" class="aspect-[4/3] w-[24rem] max-w-none flex-none rounded-2xl bg-gray-50 object-cover" />
            </div>
            <div class="flex w-96 flex-auto justify-end lg:w-auto lg:flex-none">
              <img src="https://images.unsplash.com/photo-1568992687947-868a62a9f521?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1152&h=842&q=80" alt="" class="aspect-[7/5] w-[37rem] max-w-none flex-none rounded-2xl bg-gray-50 object-cover" />
            </div>
            <div class="hidden sm:block sm:w-0 sm:flex-auto lg:w-auto lg:flex-none">
              <img src="https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=768&h=604&q=80" alt="" class="aspect-[4/3] w-[24rem] max-w-none rounded-2xl bg-gray-50 object-cover" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="bg-gray-900 mx-auto max-w-7xl">
    <div class="mt-16 border-t border-white/10 pt-8 sm:mt-20 lg:mt-24"></div>
  </div>
  </div>
</template>


<script setup>
import { CloudArrowUpIcon, LockClosedIcon, ServerIcon, EnvelopeIcon, ChevronDownIcon } from '@heroicons/vue/20/solid'
</script>