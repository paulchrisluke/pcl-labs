export default defineEventHandler(async (event) => {
  try {
    // Set proper headers for XML sitemap
    setHeader(event, 'Content-Type', 'application/xml')
    setHeader(event, 'Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    
    // Fetch sitemap from the Quill API
    const sitemapData = await $fetch('https://api.paulchrisluke.com/sitemap.xml')
    
    // Return the sitemap data directly from the API
    return sitemapData
  } catch (error) {
    console.error('Error fetching sitemap:', error)
    
    // Fallback: return a basic sitemap if API fails
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://paulchrisluke.com</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://paulchrisluke.com/blog</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`
    
    return fallbackSitemap
  }
})
