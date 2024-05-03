<script setup>
const props = defineProps({
  hideHero: {
    type: Boolean,
    default: false
  },
  hideBg: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <div>
    <!-- Navbar always visible -->
    <div class="bg-white">
      <Navbar />
    </div>

    <!-- Conditional Hero and background based on props -->
    <div v-if="!hideBg" class="absolute inset-x-0 top-[-10rem] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[-20rem]">
      <!-- Background elements go here -->
    </div>
    <Hero v-if="!hideHero" />
  </div>
</template>
