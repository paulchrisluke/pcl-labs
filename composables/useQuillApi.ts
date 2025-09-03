

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
      return parseBlogResponse(response)
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

  // Get available blog dates (this would need to be implemented on your API)
  const getAvailableBlogs = async () => {
    try {
      // For now, we'll return the known dates from your API docs
      // You could add an endpoint like /api/blogs to get all available dates
      return ['2025-08-27', '2025-08-29']
    } catch (error) {
      console.error('Error fetching available blogs:', error)
      return []
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
