
import type { 
  BlogIndexResponse, 
  BlogMetadata, 
  BlogPostResponse, 
  BlogPost,
  ApiError 
} from '~/types/blog'

export const useQuillApi = () => {
  const config = useRuntimeConfig()
  const baseUrl = 'https://api.paulchrisluke.com'

  // Fetch complete blog data for a specific date using the new digest endpoint
  const fetchBlog = async (date: string): Promise<BlogPostResponse> => {
    try {
      // Use the new digest endpoint URL structure
      const response = await $fetch<BlogPostResponse>(`${baseUrl}/blogs/${date}/API-v3-${date}_digest.json`)
      
      // The API now returns structured JSON with enhanced SEO data
      if (!response) {
        throw new Error('Failed to fetch blog data')
      }
      
      return response
    } catch (error) {
      console.error(`Error fetching blog for ${date}:`, error)
      throw error
    }
  }

  // Get available blogs from the new API endpoint with enhanced SEO data
  const getAvailableBlogs = async (): Promise<BlogMetadata[]> => {
    try {
      // Fetch from the new /blogs/index.json endpoint that returns structured data with SEO metadata
      const response = await $fetch<BlogIndexResponse>(`${baseUrl}/blogs/index.json`)
      
      // Handle different response structures
      if (response && Array.isArray(response)) {
        return response as unknown as BlogMetadata[]
      } else if (response && response.blogs && Array.isArray(response.blogs)) {
        return response.blogs
      }
      
      // If no response, return empty array
      return []
    } catch (error) {
      console.warn('Error fetching available blogs from API:', error)
      // Return empty array for clean empty state
      return []
    }
  }

  // Get blog metadata for a specific date from the blogs list
  const getBlogMetadata = async (date: string): Promise<BlogMetadata | null> => {
    try {
      const blogs = await getAvailableBlogs()
      return blogs.find(blog => blog.date === date) || null
    } catch (error) {
      console.error(`Error fetching blog metadata for ${date}:`, error)
      return null
    }
  }

  // Get sitemap data from the new API endpoint
  const getSitemap = async () => {
    try {
      const response = await $fetch(`${baseUrl}/sitemap.xml`)
      return response
    } catch (error) {
      console.error('Error fetching sitemap:', error)
      throw error
    }
  }

  // Get RSS feed data from the new API endpoint
  const getRssFeed = async () => {
    try {
      const response = await $fetch(`${baseUrl}/rss.xml`)
      return response
    } catch (error) {
      console.error('Error fetching RSS feed:', error)
      throw error
    }
  }

  // Legacy methods for backward compatibility (deprecated)
  const fetchBlogMarkdown = async (date: string) => {
    console.warn('fetchBlogMarkdown is deprecated, use fetchBlog instead')
    return fetchBlog(date)
  }

  const fetchBlogDigest = async (date: string) => {
    console.warn('fetchBlogDigest is deprecated, use fetchBlog instead')
    return fetchBlog(date)
  }

  const fetchBlogAssets = async (date: string) => {
    console.warn('fetchBlogAssets is deprecated, assets are now included in fetchBlog response')
    return fetchBlog(date)
  }

  // Transform API data into frontend format
  const transformBlogData = (apiData: BlogPostResponse, metadata: BlogMetadata): BlogPost => {
    const fullContent = apiData.content.body
    
    // Prioritize story images, then API images, then fallback to hero images
    let imageThumbnail = null
    
    // First priority: API's OG image if it's a proper story image (not generic logo)
    if (apiData.frontmatter?.og?.["og:image"] && 
        !apiData.frontmatter.og["og:image"].includes('pcl-labs-logo.svg') &&
        apiData.frontmatter.og["og:image"].includes('stories/')) {
      imageThumbnail = apiData.frontmatter.og["og:image"]
    }
    // Second priority: Story images if available
    else if (metadata.story_count > 0 && apiData.story_packets && apiData.story_packets.length > 0) {
      // Try to use the first story packet's intro thumbnail
      const firstStory = apiData.story_packets[0]
      if (firstStory.video && firstStory.video.thumbnails && firstStory.video.thumbnails.intro) {
        imageThumbnail = `https://api.paulchrisluke.com/assets/${firstStory.video.thumbnails.intro}`
      } else {
        // Fallback to the old story image path
        const datePath = metadata.date.replace(/-/g, '/')
        const dateId = metadata.date.replace(/-/g, '')
        imageThumbnail = `https://api.paulchrisluke.com/assets/stories/${datePath}/story_${dateId}_pr42_01_intro.png`
      }
    }
    // Third priority: Direct image fields from metadata
    else if (metadata.image) {
      imageThumbnail = metadata.image
    }
    else if (metadata.og_image) {
      imageThumbnail = metadata.og_image
    }
    else if (metadata.thumbnail) {
      imageThumbnail = metadata.thumbnail
    }
    // Fourth priority: Other API frontmatter images (but avoid generic logo)
    else if (apiData.frontmatter?.og?.["og:image"] && 
             !apiData.frontmatter.og["og:image"].includes('pcl-labs-logo.svg')) {
      imageThumbnail = apiData.frontmatter.og["og:image"]
    }
    else if (apiData.frontmatter?.schema?.blogPosting?.image && 
             !apiData.frontmatter.schema.blogPosting.image.includes('pcl-labs-logo.svg')) {
      imageThumbnail = apiData.frontmatter.schema.blogPosting.image
    }
    // Final fallback: Use a proper hero image instead of logo
    else {
      imageThumbnail = 'https://paulchrisluke.com/PCL-about-header.webp'
    }
    
    return {
      _id: `blog_${metadata.date}`,
      _path: `/blog/${metadata.date}`,
      title: apiData.frontmatter?.title || metadata.title,
      content: fullContent,
      date: metadata.date,
      tags: apiData.frontmatter?.tags || metadata.tags || [],
      description: apiData.frontmatter?.description || metadata.description,
      imageThumbnail,
      author: apiData.frontmatter?.author || metadata.author,
      lead: apiData.frontmatter?.description || metadata.lead,
      canonical_url: metadata.canonical_url,
      story_count: metadata.story_count,
      has_video: metadata.has_video,
      seo_title: apiData.frontmatter?.og?.["og:title"] || apiData.frontmatter?.title,
      seo_description: apiData.frontmatter?.og?.["og:description"] || apiData.frontmatter?.description,
      keywords: apiData.metadata?.keywords || apiData.frontmatter?.tags || [],
      reading_time: metadata.reading_time,
      word_count: metadata.word_count,
      last_modified: metadata.last_modified || metadata.date,
      category: metadata.category,
      featured: metadata.featured || false,
      github_events: [],
      story_packets: apiData.story_packets || [],
      metadata: apiData.metadata || {},
      related_posts: [],
      table_of_contents: [],
      social_shares: {},
      analytics: {}
    }
  }

  return {
    fetchBlog,
    getAvailableBlogs,
    getBlogMetadata,
    getSitemap,
    getRssFeed,
    transformBlogData,
    // Legacy methods (deprecated)
    fetchBlogMarkdown,
    fetchBlogDigest,
    fetchBlogAssets
  }
}
