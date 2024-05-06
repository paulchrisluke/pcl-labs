<template>
  <div class="flex flex-col min-h-screen">
    <HeaderSection :hide-hero="$route.path !== '/'" :hide-bg="$route.path !== '/'" />
    <NuxtLayout>
      <NuxtLoadingIndicator color="#32CD32" :height="5" :throttle="0" :duration="1200"  />
      <NuxtPage />
    </NuxtLayout>
    <FooterSection />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
