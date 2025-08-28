import type { Environment } from '../types/index.js';
import type { Manifest, ManifestSection } from '../types/content.js';
import { validateClipId } from '../utils/validation.js';
import { stringify } from 'yaml';

export interface BlogPostResult {
  markdown: string;
  frontMatter: Record<string, any>;
  wordCount: number;
  estimatedReadTime: number;
}

/**
 * Blog Post Generator Service
 * Converts manifests to Markdown blog posts
 */
export class BlogGeneratorService {
  private env: Environment;

  constructor(env: Environment) {
    this.env = env;
  }

  /**
   * Generate blog post from manifest
   */
  async generateBlogPost(manifest: Manifest): Promise<BlogPostResult> {
    try {
      console.log(`📝 Generating blog post for ${manifest.post_id}...`);

      // Generate front matter
      const frontMatter = this.generateFrontMatter(manifest);

      // Generate markdown content
      const markdownContent = this.generateMarkdownContent(manifest);

      // Combine front matter and content
      const markdown = this.combineFrontMatterAndContent(frontMatter, markdownContent);

      // Calculate metrics
      const wordCount = this.calculateWordCount(markdownContent);
      const estimatedReadTime = this.calculateReadTime(wordCount);

      console.log(`✅ Generated blog post: ${wordCount} words, ~${estimatedReadTime} min read`);

      return {
        markdown,
        frontMatter,
        wordCount,
        estimatedReadTime,
      };
    } catch (error) {
      console.error('❌ Failed to generate blog post:', error);
      throw error;
    }
  }

  /**
   * Generate front matter for the blog post
   */
  private generateFrontMatter(manifest: Manifest): Record<string, any> {
    const frontMatter: Record<string, any> = {
      title: manifest.title,
      date: manifest.date_utc,
      description: manifest.summary,
      category: manifest.category,
      tags: manifest.tags,
      image: this.generateCoverImageUrl(),
      canonical: this.generateCanonicalUrl(manifest),
      layout: 'post',
      published: false, // Will be set to true after approval
    };

    // Add optional fields if they exist
    if (manifest.keywords) {
      frontMatter.keywords = manifest.keywords;
    }

    if (manifest.repos && manifest.repos.length > 0) {
      frontMatter.repos = manifest.repos;
    }

    // Add social media metadata
    if (manifest.social_blurbs) {
      if (manifest.social_blurbs.bluesky) {
        frontMatter.social_bluesky = manifest.social_blurbs.bluesky;
      }
      if (manifest.social_blurbs.threads) {
        frontMatter.social_threads = manifest.social_blurbs.threads;
      }
    }

    // Add judge results if available
    if (manifest.judge) {
      frontMatter.judge_score = manifest.judge.overall;
      frontMatter.judge_version = manifest.judge.version;
    }

    return frontMatter;
  }

  /**
   * Generate markdown content from manifest sections
   */
  private generateMarkdownContent(manifest: Manifest): string {
    let content = '';

    // Add introduction
    content += this.generateIntroduction(manifest);

    // Add sections
    content += this.generateSections(manifest.sections);

    // Add conclusion
    content += this.generateConclusion(manifest);

    // Add footer
    content += this.generateFooter(manifest);

    return content;
  }

  /**
   * Generate introduction section
   */
  private generateIntroduction(manifest: Manifest): string {
    let intro = '';

    intro += `# ${manifest.title}\n\n`;

    // Add summary
    intro += `${manifest.summary}\n\n`;

    // Add clip count and GitHub context info
    const clipCount = manifest.clip_ids.length;
    const githubContextCount = manifest.sections.filter(s => Array.isArray(s.pr_links) && s.pr_links.length > 0).length;

    intro += `## Overview\n\n`;
    intro += `Today's development session included **${clipCount} clips** covering various development topics.`;

    if (githubContextCount > 0) {
      intro += ` ${githubContextCount} of these clips are connected to GitHub activity, including pull requests, commits, and issue discussions.`;
    }

    intro += `\n\n`;

    // Add table of contents if we have multiple sections
    if (manifest.sections.length > 3) {
      intro += this.generateTableOfContents(manifest.sections);
    }

    return intro;
  }

  /**
   * Generate table of contents
   */
  private generateTableOfContents(sections: ManifestSection[]): string {
    let toc = '## Table of Contents\n\n';

    sections.forEach((section, index) => {
      const sectionNumber = index + 1;
      toc += `${sectionNumber}. [${section.title}](#section-${sectionNumber})\n`;
    });

    toc += '\n---\n\n';
    return toc;
  }

  /**
   * Generate sections content
   */
  private generateSections(sections: ManifestSection[]): string {
    let sectionsContent = '';

    sections.forEach((section, index) => {
      const sectionNumber = index + 1;
      
      sectionsContent += `<a id="section-${sectionNumber}"></a>\n## ${sectionNumber}. ${section.title}\n\n`;

      // Add clip embed if available
      if (section.clip_url) {
        sectionsContent += this.generateClipEmbed(section);
      }

      // Add bullets
      if (section.bullets && section.bullets.length > 0) {
        sectionsContent += '### Key Points\n\n';
        section.bullets.forEach(bullet => {
          sectionsContent += `- ${bullet}\n`;
        });
        sectionsContent += '\n';
      }

      // Add paragraph
      if (section.paragraph) {
        sectionsContent += `${section.paragraph}\n\n`;
      }

      // Add GitHub context if available
      if (Array.isArray(section.pr_links) && section.pr_links.length > 0) {
        sectionsContent += this.generateGitHubContext(section);
      }

      // Add separator between sections
      if (index < sections.length - 1) {
        sectionsContent += '---\n\n';
      }
    });

    return sectionsContent;
  }

  /**
   * Securely parse and validate clip URL
   * Validates URL format, checks trusted domains, and extracts clip ID safely
   */
  private parseClipUrl(clipUrl: string): string {
    if (!clipUrl || typeof clipUrl !== 'string') {
      return '';
    }

    try {
      // Parse URL using URL constructor for proper validation
      const url = new URL(clipUrl);
      
      // Validate hostname against trusted domains
      const trustedDomains = [
        'clips.twitch.tv',
        'www.twitch.tv',
        'twitch.tv'
      ];
      
      if (!trustedDomains.includes(url.hostname)) {
        console.warn(`Untrusted domain for clip URL: ${url.hostname}`);
        return '';
      }
      
      // Extract clip ID from pathname
      const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
      
      // Look for 'clip' segment followed by the clip ID
      const clipIndex = pathSegments.findIndex(segment => segment === 'clip');
      if (clipIndex === -1 || clipIndex >= pathSegments.length - 1) {
        console.warn('No valid clip ID found in URL path');
        return '';
      }
      
      const clipId = pathSegments[clipIndex + 1];
      
      // Validate the extracted clip ID using existing validation function
      const validation = validateClipId(clipId);
      if (!validation.isValid) {
        console.warn(`Invalid clip ID: ${validation.error}`);
        return '';
      }
      
      return clipId;
      
    } catch (error) {
      console.warn(`Failed to parse clip URL: ${error}`);
      return '';
    }
  }

  /**
   * Generate clip embed
   */
  private generateClipEmbed(section: ManifestSection): string {
    if (!section.clip_url) return '';

    // Securely extract and validate clip ID
    const clipId = this.parseClipUrl(section.clip_url);
    if (!clipId) return '';

    // URL-encode the clip ID for safe embedding
    const encodedClipId = encodeURIComponent(clipId);
    
    return `<div class="clip-embed">
  <iframe src="https://clips.twitch.tv/embed?clip=${encodedClipId}&parent=paulchrisluke.com" 
          width="640" height="360" frameborder="0" scrolling="no" 
          allowfullscreen></iframe>
  <p><a href="${section.clip_url}" target="_blank">Watch on Twitch</a></p>
</div>

`;
  }

  /**
   * Generate GitHub context section
   */
  private generateGitHubContext(section: ManifestSection): string {
    if (!Array.isArray(section.pr_links) || section.pr_links.length === 0) return '';

    let context = '### Related GitHub Activity\n\n';

    section.pr_links.forEach((prUrl, index) => {
      const prNumber = index + 1;
      context += `${prNumber}. [Pull Request](${prUrl})\n`;
    });

    context += '\n';
    return context;
  }

  /**
   * Generate conclusion
   */
  private generateConclusion(manifest: Manifest): string {
    let conclusion = '## Summary\n\n';

    const clipCount = manifest.clip_ids.length;
    const githubContextCount = manifest.sections.filter(s => Array.isArray(s.pr_links) && s.pr_links.length > 0).length;

    conclusion += `Today's development session was productive with ${clipCount} clips covering various topics.`;

    if (githubContextCount > 0) {
      conclusion += ` The session included significant GitHub activity with ${githubContextCount} clips connected to pull requests and code changes.`;
    }

    conclusion += `\n\n`;

    // Add call to action
    conclusion += `### Follow the Development\n\n`;
    conclusion += `- **Twitch Channel**: [paulchrisluke](https://twitch.tv/paulchrisluke)\n`;
    conclusion += `- **GitHub**: [paulchrisluke](https://github.com/paulchrisluke)\n`;
    conclusion += `- **Previous Recaps**: [Development Blog](/blog/development)\n\n`;

    return conclusion;
  }

  /**
   * Generate footer
   */
  private generateFooter(manifest: Manifest): string {
    let footer = '---\n\n';

    footer += `*This recap was automatically generated from today's development stream. `;
    footer += `The clips and GitHub context were processed using AI to create a comprehensive summary of the day's work.*\n\n`;

    // Add metadata
    footer += `**Generated**: ${new Date().toISOString()}\n`;
    footer += `**Clips**: ${manifest.clip_ids.length}\n`;
    footer += `**Tags**: ${manifest.tags.join(', ')}\n`;

    if (manifest.repos && manifest.repos.length > 0) {
      footer += `**Repositories**: ${manifest.repos.join(', ')}\n`;
    }

    return footer;
  }

  /**
   * Combine front matter and content
   */
  private combineFrontMatterAndContent(frontMatter: Record<string, any>, content: string): string {
    const frontMatterYaml = this.objectToYaml(frontMatter);
    
    return `---\n${frontMatterYaml}---\n\n${content}`;
  }

  /**
   * Convert object to YAML using proper YAML library
   */
  private objectToYaml(obj: Record<string, any>): string {
    // Filter out undefined values to avoid YAML serialization issues
    const filteredObj = Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined && value !== null)
    );
    
    // Use the yaml library to safely serialize the object
    // This handles all edge cases: multiline strings, special characters, booleans, numbers, nested objects, etc.
    return stringify(filteredObj, {
      indent: 2,
      lineWidth: 0, // Disable line wrapping to keep it simple
      minContentWidth: 0, // Disable content width restrictions
      doubleQuotedAsJSON: false, // Use YAML-style quoting instead of JSON-style
      doubleQuotedMinMultiLineLength: 40, // Use block scalars for longer strings
    });
  }

  /**
   * Calculate word count
   */
  private calculateWordCount(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Calculate estimated read time (average 200 words per minute)
   */
  private calculateReadTime(wordCount: number): number {
    return Math.ceil(wordCount / 200);
  }

  /**
   * Generate cover image URL
   */
  private generateCoverImageUrl(): string {
    // For now, use a default cover image
    // In the future, this could generate a custom image based on the content
    return '/img/blog/default-cover.jpg';
  }

  /**
   * Generate canonical URL
   */
  private generateCanonicalUrl(manifest: Manifest): string {
    return `https://paulchrisluke.com/blog/development/${manifest.post_id}-daily-recap`;
  }

  /**
   * Store blog post in R2
   */
  async storeBlogPost(manifest: Manifest, markdown: string): Promise<boolean> {
    try {
      const key = `blog-posts/${manifest.post_id}.md`;
      
      await this.env.R2_BUCKET.put(key, markdown, {
        httpMetadata: {
          contentType: 'text/markdown',
        },
        customMetadata: {
          'post-id': manifest.post_id,
          'title': manifest.title,
          'category': manifest.category,
          'generated-at': new Date().toISOString(),
        },
      });

      console.log(`✅ Stored blog post: ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to store blog post:', error);
      return false;
    }
  }

  /**
   * Get stored blog post
   */
  async getBlogPost(postId: string): Promise<string | null> {
    try {
      const key = `blog-posts/${postId}.md`;
      const object = await this.env.R2_BUCKET.get(key);
      
      if (!object) {
        return null;
      }

      return await object.text();
    } catch (error) {
      console.error('❌ Failed to get blog post:', error);
      return null;
    }
  }

  /**
   * List stored blog posts
   */
  async listBlogPosts(): Promise<string[]> {
    try {
      const objects = await this.env.R2_BUCKET.list({ prefix: 'blog-posts/' });
      return objects.objects.map((obj: any) => obj.key.replace('blog-posts/', '').replace('.md', ''));
    } catch (error) {
      console.error('❌ Failed to list blog posts:', error);
      return [];
    }
  }
}
