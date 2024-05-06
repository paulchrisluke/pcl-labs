<template>
  <div class="flex flex-col min-h-screen">
    <HeaderSection :hide-hero="$route.path !== '/'" :hide-bg="$route.path !== '/'" />
    <NuxtLayout>
      <NuxtLoadingIndicator class="custom-loading-indicator" :height="5" :throttle="0" :duration="1200" />
      <NuxtPage />
    </NuxtLayout>
    <FooterSection />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
const route = useRoute();

</script>

<style>
.custom-loading-indicator {
  background: linear-gradient(90deg, #029DE4, #6366f1);
}
</style>