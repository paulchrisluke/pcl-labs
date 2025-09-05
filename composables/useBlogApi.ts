// Type definitions for API responses and blog data
interface ApiBlogData {
  url?: string
  datePublished?: string
  dateModified?: string
  content?: {
    title?: string
    body?: string
    tags?: string[]
    summary?: string
  }
  media?: {
    hero?: {
      image?: string
    }
  }
  schema?: {
    author?: {
      name?: string
    }
  } | null
  headers?: any
  wordCount?: number
  timeRequired?: string
}

interface ApiBlogIndexItem {
  '@type': string
  headline: string
  description: string
  url: string
  datePublished: string
  author: {
    '@type': string
    name: string
  }
  publisher: {
    '@type': string
    name: string
    logo: {
      '@type': string
      url: string
    }
  }
}

interface ApiBlogIndexResponse {
  '@context': string
  '@type': string
  name: string
  url: string
  description: string
  author: {
    '@type': string
    name: string
    url: string
  }
  publisher: {
    '@type': string
    name: string
    logo: {
      '@type': string
      url: string
    }
  }
  blogPost: ApiBlogIndexItem[]
}

// Canonical blog DTO interface
interface BlogData {
  _id: string
  _path: string
  title: string
  content: string
  date: string
  dateModified: string
  tags: string[]
  imageThumbnail: string
  imageAlt: string
  description: string
  author: string
  lead: string
  wordCount: number
  timeRequired: string
  url: string
  schema: any
  headers: any
}

// Configuration for retry logic
interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  timeout: number
}

export const useBlogApi = () => {
  const API_BASE_URL = 'https://api.paulchrisluke.com/blogs'
  
  // Default retry configuration
  const defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    timeout: 30000
  }

  // Input validation for API data
  const validateApiData = (apiData: unknown): apiData is ApiBlogData => {
    if (!apiData || typeof apiData !== 'object') {
      return false
    }
    
    const data = apiData as Record<string, any>
    
    // Check for required structure
    return (
      (typeof data.url === 'string' || typeof data.datePublished === 'string') &&
      (data.content === undefined || typeof data.content === 'object') &&
      (data.media === undefined || typeof data.media === 'object') &&
      (data.schema === undefined || typeof data.schema === 'object' || data.schema === null)
    )
  }

  // Input validation for blog index data
  const validateBlogIndexData = (apiData: unknown): apiData is ApiBlogIndexResponse => {
    if (!apiData || typeof apiData !== 'object') {
      return false
    }
    
    const data = apiData as Record<string, any>
    return Array.isArray(data.blogPost)
  }

  // Transform API data to match our frontend structure with type safety
  const transformApiData = (apiData: unknown): BlogData => {
    if (!validateApiData(apiData)) {
      throw new Error('Invalid API data structure received')
    }

    const data = apiData as ApiBlogData
    
    return {
      _id: data.url?.split('/').pop() || data.datePublished || '',
      _path: data.url?.replace('https://paulchrisluke.com', '') || `/blog/${data.datePublished || ''}`,
      title: data.content?.title || '',
      content: data.content?.body || '',
      date: data.datePublished || '',
      dateModified: data.dateModified || '',
      tags: data.content?.tags || [],
      imageThumbnail: data.media?.hero?.image || '',
      imageAlt: data.content?.title || 'PCL Labs Blog Post',
      description: data.content?.summary || '',
      author: data.schema?.author?.name || 'Paul Chris Luke',
      lead: data.content?.summary || '',
      wordCount: data.wordCount || 0,
      timeRequired: data.timeRequired || 'PT3M',
      url: data.url || '',
      schema: data.schema || null,
      headers: data.headers || null
    }
  }

  // Helper function to determine if an error should be retried
  const shouldRetry = (error: any, attempt: number): boolean => {
    // Don't retry if we've exceeded max attempts
    if (attempt >= defaultRetryConfig.maxRetries) {
      return false
    }
    
    // Don't retry on 4xx errors (except 408, 429)
    if (error.status >= 400 && error.status < 500) {
      return error.status === 408 || error.status === 429
    }
    
    // Retry on network errors, 5xx errors, and timeouts
    return error.name === 'AbortError' || error.status >= 500 || !error.status
  }

  // Helper function to calculate delay with exponential backoff and jitter
  const calculateDelay = (attempt: number): number => {
    const exponentialDelay = defaultRetryConfig.baseDelay * Math.pow(2, attempt)
    const jitter = Math.random() * 0.1 * exponentialDelay // 10% jitter
    return Math.min(exponentialDelay + jitter, defaultRetryConfig.maxDelay)
  }

  // Fetch a specific blog by date with timeout and retry logic
  const fetchBlog = async (date: string, retryConfig: Partial<RetryConfig> = {}): Promise<BlogData> => {
    const config = { ...defaultRetryConfig, ...retryConfig }
    let lastError: any

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => {
        abortController.abort()
      }, config.timeout)

      try {
        console.log(`Fetching blog for date ${date}, attempt ${attempt + 1}/${config.maxRetries + 1}`)
        
        const response = await fetch(`${API_BASE_URL}/${date}/${date}_page.publish.json`, {
          signal: abortController.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          const error = new Error(`HTTP error! status: ${response.status}`)
          ;(error as any).status = response.status
          
          if (response.status === 404) {
            throw new Error(`Blog not found for date: ${date}`)
          }
          
          if (shouldRetry(error, attempt)) {
            lastError = error
            const delay = calculateDelay(attempt)
            console.log(`Retrying in ${delay}ms due to error:`, error.message)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          
          throw error
        }
        
        const apiData = await response.json()
        const transformedData = transformApiData(apiData)
        
        console.log(`Successfully fetched blog for date ${date}`)
        return transformedData
        
      } catch (error: any) {
        clearTimeout(timeoutId)
        
        if (error.name === 'AbortError') {
          const timeoutError = new Error(`Request timeout after ${config.timeout}ms`)
          ;(timeoutError as any).status = 408
          lastError = timeoutError
        } else {
          lastError = error
        }
        
        if (shouldRetry(lastError, attempt)) {
          const delay = calculateDelay(attempt)
          console.log(`Retrying in ${delay}ms due to error:`, lastError.message)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        console.error(`Error fetching blog from API (attempt ${attempt + 1}):`, lastError)
        throw lastError
      }
    }
    
    // This should never be reached, but TypeScript requires it
    throw lastError
  }

  // Transform blog index item to consistent DTO
  const transformBlogIndexItem = (blog: ApiBlogIndexItem): BlogData => {
    return {
      _id: blog.datePublished,
      _path: blog.url?.replace('https://paulchrisluke.com', '') || `/blog/${blog.datePublished}`,
      title: blog.headline || '',
      content: '', // Content is not included in the index, only in individual blog endpoints
      date: blog.datePublished || '',
      dateModified: blog.datePublished || '', // Index doesn't have modified date
      tags: [], // Tags not available in index
      imageThumbnail: '', // Index doesn't include images
      imageAlt: blog.headline || 'PCL Labs Blog Post',
      description: blog.description || '',
      author: blog.author?.name || 'Paul Chris Luke',
      lead: blog.description || '',
      wordCount: 0, // Not available in index
      timeRequired: 'PT3M', // Default value
      url: blog.url || '',
      schema: null, // Not included in index
      headers: null // Not included in index
    }
  }

  // Fetch all available blogs from the blog index endpoint
  const fetchAllBlogs = async (): Promise<BlogData[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const apiData = await response.json()
      
      // Validate the API response structure
      if (!validateBlogIndexData(apiData)) {
        throw new Error('Invalid blog index API response structure')
      }
      
      const validatedData = apiData as ApiBlogIndexResponse
      
      // Transform the blogPost array from the API response
      if (validatedData.blogPost && Array.isArray(validatedData.blogPost)) {
        return validatedData.blogPost.map(blog => transformBlogIndexItem(blog))
      }
      
      return []
    } catch (error) {
      console.error('Error fetching all blogs from API:', error)
      throw error
    }
  }

  // Get available blog dates from the blog index endpoint
  const getAvailableBlogs = async (): Promise<string[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const apiData = await response.json()
      
      // Validate the API response structure
      if (!validateBlogIndexData(apiData)) {
        throw new Error('Invalid blog index API response structure')
      }
      
      const validatedData = apiData as ApiBlogIndexResponse
      
      // Return just the dates from the blogPost array
      if (validatedData.blogPost && Array.isArray(validatedData.blogPost)) {
        return validatedData.blogPost
          .map(blog => blog.datePublished)
          .filter(date => date) // Filter out empty dates
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
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

// Export types for consumers
export type { BlogData, RetryConfig }
