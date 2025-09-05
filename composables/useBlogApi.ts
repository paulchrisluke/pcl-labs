export const useBlogApi = () => {
  const API_BASE_URL = 'https://api.paulchrisluke.com/blogs'

  // Transform API data to match our frontend structure
  const transformApiData = (apiData: any) => {
    return {
      _id: apiData.url?.split('/').pop() || apiData.datePublished,
      _path: apiData.url?.replace('https://paulchrisluke.com', '') || `/blog/${apiData.datePublished}`,
      title: apiData.content?.title || '',
      content: apiData.content?.body || '',
      date: apiData.datePublished || '',
      dateModified: apiData.dateModified || '',
      tags: apiData.content?.tags || [],
      imageThumbnail: apiData.media?.hero?.image || '',
      imageAlt: apiData.content?.title || 'PCL Labs Blog Post',
      description: apiData.content?.summary || '',
      author: apiData.schema?.author?.name || 'Paul Chris Luke',
      lead: apiData.content?.summary || '',
      wordCount: apiData.wordCount || 0,
      timeRequired: apiData.timeRequired || 'PT3M',
      url: apiData.url || '',
      schema: apiData.schema || null,
      headers: apiData.headers || null
    }
  }

  // Fetch a specific blog by date
  const fetchBlog = async (date: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${date}/${date}_page.publish.json`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Blog not found for date: ${date}`)
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const apiData = await response.json()
      return transformApiData(apiData)
    } catch (error) {
      console.error('Error fetching blog from API:', error)
      throw error
    }
  }

  // Fetch all available blogs from the blog index endpoint
  const fetchAllBlogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const apiData = await response.json()
      
      // Transform the blogs array from the API response
      if (apiData.blogs && Array.isArray(apiData.blogs)) {
        return apiData.blogs.map(blog => ({
          _id: blog.date,
          _path: blog.canonical_url?.replace('https://paulchrisluke.com', '') || `/blog/${blog.date}`,
          title: blog.title || '',
          content: '', // Content is not included in the index, only in individual blog endpoints
          date: blog.date || '',
          dateModified: blog.date || '', // Index doesn't have modified date
          tags: blog.tags || [],
          imageThumbnail: '', // Index doesn't include images
          imageAlt: blog.title || 'PCL Labs Blog Post',
          description: blog.description || '',
          author: blog.author || 'Paul Chris Luke',
          lead: blog.description || '',
          wordCount: 0, // Not available in index
          timeRequired: 'PT3M', // Default value
          url: blog.canonical_url || '',
          apiUrl: blog.api_url || '',
          storyCount: blog.story_count || 0,
          hasVideo: blog.has_video || false,
          schema: null, // Not included in index
          headers: null // Not included in index
        }))
      }
      
      return []
    } catch (error) {
      console.error('Error fetching all blogs from API:', error)
      throw error
    }
  }

  // Get available blog dates from the blog index endpoint
  const getAvailableBlogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const apiData = await response.json()
      
      // Return just the dates from the blogs array
      if (apiData.blogs && Array.isArray(apiData.blogs)) {
        return apiData.blogs.map(blog => blog.date).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      }
      
      return []
    } catch (error) {
      console.error('Error getting available blogs from API:', error)
      throw error
    }
  }

  return {
    fetchBlog,
    fetchAllBlogs,
    getAvailableBlogs
  }
}
