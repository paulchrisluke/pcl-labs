<template>
  <div class="flex flex-col min-h-screen">
    <HeaderSection :hide-hero="$route.path !== '/'" :hide-bg="$route.path !== '/'" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <FooterSection />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
