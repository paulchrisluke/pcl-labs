<template>
  <div>
    <HeroProduct />
    <FeatureGrid id="Features" />
    <Design id="Design" />
    <FeaturePanel id="Marketing" />
    <Pricing id="Pricing" />
    <Logos />
    <Cta />
  </div>
</template>

<script setup>

useHead({
  title: 'My App',
  meta: [
    { name: 'description', content: 'My amazing site.' },
    { property: 'og:title', content: 'My App' },  // OG title
    { property: 'og:description', content: 'My amazing site.' },  // OG description
    { property: 'og:image', content: 'https://example.com/path-to-your-image.jpg' }  // OG image URL
  ]
})
</script>