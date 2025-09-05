export const useMockBlog = () => {
  // Shared delay helper
  const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

  // Mock blog data
  const mockBlogs = [
    {
      _id: 'blog_2025-01-15',
      _path: '/blog/2025-01-15',
      title: 'The Future of AI in Web Development',
      content: `# The Future of AI in Web Development

Artificial Intelligence is revolutionizing how we build and interact with websites. From automated code generation to intelligent user experiences, AI is becoming an integral part of modern web development.

## Key Trends to Watch

### 1. Automated Code Generation
AI-powered tools like GitHub Copilot and ChatGPT are helping developers write code faster and more efficiently. These tools can understand context and generate relevant code snippets, reducing development time significantly.

### 2. Intelligent User Interfaces
AI can create more personalized and adaptive user interfaces that respond to user behavior and preferences in real-time.

### 3. Enhanced Testing and Debugging
AI algorithms can automatically detect bugs, suggest fixes, and even write comprehensive test suites.

## The Impact on Developers

While some fear AI will replace developers, the reality is that it's making developers more productive and allowing them to focus on higher-level problem-solving and creative tasks.

## Conclusion

The future of web development is undoubtedly intertwined with AI. Embracing these tools and learning to work alongside them will be crucial for staying competitive in the industry.`,
      date: '2025-01-15',
      tags: ['AI', 'Web Development', 'Technology'],
      imageThumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=675&q=80',
      imageAlt: 'AI and Web Development',
      description: 'Exploring how artificial intelligence is transforming the web development landscape and what developers need to know.',
      author: 'Paul Chris Luke',
      lead: 'AI is reshaping web development in ways we never imagined.',
      wordCount: 450,
      timeRequired: 'PT3M'
    },
    {
      _id: 'blog_2025-01-10',
      _path: '/blog/2025-01-10',
      title: 'Building Scalable E-commerce Solutions',
      content: `# Building Scalable E-commerce Solutions

Creating an e-commerce platform that can handle growth requires careful planning and the right technology choices. Here's what you need to know.

## Architecture Considerations

### Database Design
Your database schema should be designed to handle millions of products and transactions. Consider using NoSQL databases for product catalogs and SQL for transactional data.

### Caching Strategies
Implement multi-layer caching to reduce database load and improve response times. Use Redis for session storage and CDN for static assets.

### Microservices Architecture
Break your application into smaller, independent services that can scale individually based on demand.

## Performance Optimization

### Image Optimization
Use WebP format and implement lazy loading to reduce page load times. Consider using a service like Cloudinary for automatic image optimization.

### Code Splitting
Implement code splitting to load only the JavaScript needed for each page, reducing initial bundle size.

## Security Best Practices

### Payment Processing
Never store credit card information. Use PCI-compliant payment processors like Stripe or PayPal.

### Data Protection
Implement proper encryption for sensitive data and follow GDPR guidelines for user privacy.

## Conclusion

Building a scalable e-commerce solution requires careful planning, but with the right architecture and technologies, you can create a platform that grows with your business.`,
      date: '2025-01-10',
      tags: ['E-commerce', 'Scalability', 'Performance'],
      imageThumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=675&q=80',
      imageAlt: 'E-commerce Solutions',
      description: 'Learn how to build e-commerce platforms that can scale with your business growth.',
      author: 'Paul Chris Luke',
      lead: 'Scale your e-commerce business with the right technical foundation.',
      wordCount: 520,
      timeRequired: 'PT4M'
    },
    {
      _id: 'blog_2025-01-05',
      _path: '/blog/2025-01-05',
      title: 'SEO Strategies for Modern Websites',
      content: `# SEO Strategies for Modern Websites

Search Engine Optimization has evolved significantly with the rise of modern web technologies. Here's how to stay ahead.

## Technical SEO Fundamentals

### Core Web Vitals
Google's Core Web Vitals are crucial ranking factors. Focus on:
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

### Mobile-First Indexing
Ensure your website is fully responsive and provides an excellent mobile experience. Google now primarily uses the mobile version of your site for indexing.

## Content Strategy

### Keyword Research
Use tools like Google Keyword Planner and Ahrefs to find relevant keywords with good search volume and manageable competition.

### Content Quality
Create comprehensive, well-researched content that provides real value to your audience. Google rewards content that thoroughly answers user queries.

## Technical Implementation

### Schema Markup
Implement structured data to help search engines understand your content better. Use JSON-LD format for best results.

### Site Speed
Optimize images, minify CSS and JavaScript, and use a Content Delivery Network (CDN) to improve loading times.

## Local SEO

### Google My Business
Claim and optimize your Google My Business listing with accurate information, photos, and regular updates.

### Local Citations
Ensure your business information is consistent across all online directories and platforms.

## Conclusion

Modern SEO requires a holistic approach that combines technical excellence with high-quality content and user experience optimization.`,
      date: '2025-01-05',
      tags: ['SEO', 'Marketing', 'Web Development'],
      imageThumbnail: 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=675&q=80',
      imageAlt: 'SEO Strategies',
      description: 'Modern SEO strategies that work in 2025 and beyond.',
      author: 'Paul Chris Luke',
      lead: 'Master the art of search engine optimization for the modern web.',
      wordCount: 480,
      timeRequired: 'PT4M'
    },
    {
      _id: 'blog_2024-12-28',
      _path: '/blog/2024-12-28',
      title: 'The Rise of Headless CMS',
      content: `# The Rise of Headless CMS

Traditional content management systems are being replaced by more flexible, API-driven solutions. Here's why headless CMS is the future.

## What is a Headless CMS?

A headless CMS separates the content management interface from the presentation layer. Content is delivered via APIs to any frontend framework or device.

## Benefits of Going Headless

### Flexibility
Use any frontend framework or technology stack. Your content isn't tied to a specific presentation layer.

### Performance
Static site generation and CDN delivery can significantly improve your website's speed and reliability.

### Developer Experience
Developers can work with their preferred tools and frameworks while content creators use familiar interfaces.

## Popular Headless CMS Options

### Strapi
Open-source, self-hosted solution with a powerful admin panel and flexible content types.

### Contentful
Cloud-based platform with excellent developer tools and a generous free tier.

### Sanity
Real-time collaboration features and powerful query language for complex content structures.

## Implementation Considerations

### API Design
Ensure your CMS provides a well-designed API that's easy to consume and cache.

### Content Modeling
Plan your content structure carefully to support multiple use cases and future growth.

### Preview Functionality
Implement preview modes so content creators can see how their changes will look before publishing.

## Conclusion

Headless CMS offers the flexibility and performance that modern websites need. While it requires more technical setup, the benefits often outweigh the complexity.`,
      date: '2024-12-28',
      tags: ['CMS', 'Headless', 'Development'],
      imageThumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=675&q=80',
      imageAlt: 'Headless CMS',
      description: 'Why headless CMS is becoming the preferred choice for modern web development.',
      author: 'Paul Chris Luke',
      lead: 'Embrace the flexibility and performance of headless content management.',
      wordCount: 420,
      timeRequired: 'PT3M'
    }
  ]

  // Fetch all blogs
  const fetchAllBlogs = async () => {
    // Simulate API delay
    await delay(100)
    return [...mockBlogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  // Fetch a specific blog by date
  const fetchBlog = async (date: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))
    const blog = mockBlogs.find(b => b._path === `/blog/${date}`)
    if (!blog) {
      throw new Error(`Blog not found for date: ${date}`)
    }
    return blog
  }

  // Get available blog dates
  const getAvailableBlogs = async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50))
    return mockBlogs.map(blog => blog.date)
  }

  return {
    fetchAllBlogs,
    fetchBlog,
    getAvailableBlogs
  }
}
