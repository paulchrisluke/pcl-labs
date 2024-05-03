<template>
<div class="flex flex-col min-h-screen">
    <HeaderSection :hide-hero="true" />
    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>
    <FooterSection />
  </div>
</template>