

export const useQuillApi = () => {
  const config = useRuntimeConfig()
  const baseUrl = 'https://quill-blog-api.paulchrisluke.workers.dev'

  // Parse YAML frontmatter and markdown content
  const parseBlogResponse = (response: string) => {
    try {
      // Split on the first --- to separate frontmatter from content
      const parts = response.split('---')
      if (parts.length < 3) {
        throw new Error('Invalid blog format')
      }
      
      const frontmatter = parts[1].trim()
      const content = parts.slice(2).join('---').trim()
      
      // Parse frontmatter (simple YAML parsing)
      const frontmatterObj: any = {}
      frontmatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':')
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim()
          let value = line.substring(colonIndex + 1).trim()
          
          // Remove quotes if present
          if ((value.startsWith("'") && value.endsWith("'")) || 
              (value.startsWith('"') && value.endsWith('"'))) {
            value = value.slice(1, -1)
          }
          
          frontmatterObj[key] = value
        }
      })
      
      return {
        frontmatter: frontmatterObj,
        content: { raw: content },
        date: frontmatterObj.date
      }
    } catch (error) {
      console.error('Error parsing blog response:', error)
      return null
    }
  }

  // Fetch complete blog data for a specific date
  const fetchBlog = async (date: string) => {
    try {
      const response = await $fetch<string>(`${baseUrl}/api/blog/${date}`)
      // Parse the YAML + markdown response
      const parsedBlog = parseBlogResponse(response)
      
      if (!parsedBlog) {
        throw new Error('Failed to parse blog response')
      }
      
      // Try to fetch story images if available
      try {
        const storyImages = await fetchBlogAssets(date)
        if (storyImages && storyImages.images && storyImages.images.length > 0) {
          parsedBlog.storyImages = storyImages.images
        }
      } catch (assetError) {
        // Story images are optional, don't fail the whole request
        console.warn(`Could not fetch story images for ${date}:`, assetError)
      }
      
      return parsedBlog
    } catch (error) {
      console.error(`Error fetching blog for ${date}:`, error)
      throw error
    }
  }

  // Fetch markdown content for a specific date
  const fetchBlogMarkdown = async (date: string) => {
    try {
      const response = await $fetch(`${baseUrl}/api/blog/${date}/markdown`)
      return response
    } catch (error) {
      console.error(`Error fetching blog markdown for ${date}:`, error)
      throw error
    }
  }

  // Fetch digest data for a specific date
  const fetchBlogDigest = async (date: string) => {
    try {
      const response = await $fetch(`${baseUrl}/api/blog/${date}/digest`)
      return response
    } catch (error) {
      console.error(`Error fetching blog digest for ${date}:`, error)
      throw error
    }
  }

  // Fetch assets for a specific date
  const fetchBlogAssets = async (date: string) => {
    try {
      const response = await $fetch(`${baseUrl}/api/assets/blog/${date}`)
      return response
    } catch (error) {
      console.error(`Error fetching blog assets for ${date}:`, error)
      throw error
    }
  }

  // Get available blog dates from the API
  const getAvailableBlogs = async () => {
    try {
      // Try to fetch from the API first
      const response = await $fetch<string[]>(`${baseUrl}/api/blogs`)
      if (response && Array.isArray(response)) {
        return response
      }
      
      // Fallback to known dates if API endpoint doesn't exist yet
      console.warn('API endpoint /api/blogs not available, using fallback dates')
      return ['2025-08-27', '2025-08-29']
    } catch (error) {
      console.warn('Error fetching available blogs from API, using fallback dates:', error)
      // Fallback to known dates if API is unavailable
      return ['2025-08-27', '2025-08-29']
    }
  }

  return {
    fetchBlog,
    fetchBlogMarkdown,
    fetchBlogDigest,
    fetchBlogAssets,
    getAvailableBlogs
  }
}
