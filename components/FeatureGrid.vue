<template>
  <div class="bg-gray-900 py-24 sm:py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="mx-auto max-w-2xl lg:text-center">
        <h2 class="text-lg font-semibold leading-8 tracking-tight text-indigo-400">
          <slot name="subhead"></slot>
        </h2>
        <p class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          <slot name="heading"></slot>
        </p>
        <p class="mt-6 text-lg leading-8 text-gray-300">
          <slot name="description"></slot>
        </p>
      </div>
      <div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
        <dl class="grid max-w-xl grid-cols-1 gap-y-10 gap-x-8 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
          <slot name="features"></slot>
        </dl>
      </div>
    </div>
  </div>
</template>
