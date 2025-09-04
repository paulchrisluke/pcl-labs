export default defineEventHandler(async (event) => {
  try {
    // Set proper headers for RSS feed
    setHeader(event, 'Content-Type', 'application/rss+xml')
    setHeader(event, 'Cache-Control', 'public, max-age=1800') // Cache for 30 minutes
    
    // Fetch RSS feed from the Quill API
    const rssData = await $fetch('https://api.paulchrisluke.com/rss.xml')
    
    // Return the RSS data directly from the API
    return rssData
  } catch (error) {
    console.error('Error fetching RSS feed:', error)
    
    // Fallback: return a basic RSS feed if API fails
    const fallbackRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PCL Labs Blog</title>
    <description>Insights, tips, and strategies for digital marketing, e-commerce optimization, and web development.</description>
    <link>https://paulchrisluke.com/blog</link>
    <atom:link href="https://paulchrisluke.com/rss.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <managingEditor>paul@paulchrisluke.com (Paul Chris Luke)</managingEditor>
    <webMaster>paul@paulchrisluke.com (Paul Chris Luke)</webMaster>
    <item>
      <title>Welcome to PCL Labs Blog</title>
      <description>Stay tuned for insights on digital marketing, e-commerce optimization, and web development.</description>
      <link>https://paulchrisluke.com/blog</link>
      <guid isPermaLink="true">https://paulchrisluke.com/blog</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`
    
    return fallbackRss
  }
})
