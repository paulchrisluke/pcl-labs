<template>
  <div>
    <HeroProduct />
    <FeatureGrid />
    <Design />
    <FeaturePanel />
    <CtaFull />
  </div>
</template>

<script setup>

useHead({
  title: 'Expert Marketing for Your Healthcare Services | PCL-Labs',
  meta: [
    { name: 'description', content: 'My amazing site.' },
    { property: 'og:title', content: 'Expert Marketing for Your Healthcare Services | PCL-Labs' },  // OG title
    { property: 'og:description', content: 'My amazing site.' },  // OG description
    { property: 'og:image', content: 'https://example.com/path-to-your-image.jpg' }  // OG image URL
  ]
})
</script>

