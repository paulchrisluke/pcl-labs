// Blog API Types for Quill Auto Blogger API Integration

export interface BlogIndexResponse {
  '@context': string
  '@type': 'Blog'
  name: string
  url: string
  description: string
  author: {
    '@type': 'Person'
    name: string
    url: string
  }
  publisher: {
    '@type': 'Organization'
    name: string
    logo: {
      '@type': 'ImageObject'
      url: string
    }
  }
  blogPost: BlogPostingSchema[]
  blogs: BlogMetadata[]
}

export interface BlogMetadata {
  date: string
  title: string
  author: string
  canonical_url: string
  api_url: string
  tags: string[]
  lead: string
  description: string
  story_count: number
  has_video: boolean
  image?: string
  og_image?: string
  thumbnail?: string
  reading_time?: number
  word_count?: number
  last_modified?: string
  category?: string
  featured?: boolean
}

export interface BlogPostingSchema {
  '@type': 'BlogPosting'
  headline: string
  description: string
  author: {
    '@type': 'Person'
    name: string
    url: string
  }
  datePublished: string
  url: string
  image?: string
}

export interface BlogPostResponse {
  '@context': string
  '@type': 'BlogPosting'
  date: string
  version: string
  frontmatter: BlogFrontmatter
  content: BlogContent
  story_packets: StoryPacket[]
  metadata: BlogPostMetadata
  api_metadata: ApiMetadata
}

export interface BlogFrontmatter {
  title: string
  date: string
  author: string
  og: {
    'og:title': string
    'og:description': string
    'og:type': string
    'og:url': string
    'og:image': string
    'og:site_name': string
  }
  schema: {
    blogPosting: BlogPostingSchema
  }
  tags: string[]
  description: string
}

export interface BlogContent {
  body: string
}

export interface StoryPacket {
  id: string
  title: string
  description: string
  image_url: string
  video_url?: string
  timestamp: string
  source: string
}

export interface BlogPostMetadata {
  total_clips: number
  total_events: number
  keywords: string[]
  date_parsed: string
}

export interface ApiMetadata {
  generated_at: string
  version: string
  api_endpoint: string
}

// Enhanced blog data structure for the frontend
export interface BlogPost {
  _id: string
  _path: string
  title: string
  content: string
  date: string
  tags: string[]
  description: string
  imageThumbnail?: string
  author: string
  lead: string
  canonical_url: string
  story_count: number
  has_video: boolean
  seo_title?: string
  seo_description?: string
  keywords?: string[]
  reading_time?: number
  word_count?: number
  last_modified?: string
  category?: string
  featured?: boolean
  github_events?: any[]
  story_packets?: StoryPacket[]
  metadata?: BlogPostMetadata
  related_posts?: any[]
  table_of_contents?: any[]
  social_shares?: Record<string, number>
  analytics?: any
}

// API Error types
export interface ApiError {
  statusCode: number
  statusMessage: string
  message?: string
}

// API Response wrapper
export interface ApiResponse<T> {
  data?: T
  error?: ApiError
  success: boolean
}
