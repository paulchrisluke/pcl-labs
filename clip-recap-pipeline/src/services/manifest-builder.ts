import type { Environment, ContentCategory } from '../types/index.js';
import type { Manifest, ManifestSection, ContentItem, JudgeResult, SocialBlurbs } from '../types/content.js';
import { getTranscriptFromR2, getGitHubContextFromR2 } from '../utils/content-storage.js';
import { DateTime } from 'luxon';
import { ContentItemService } from './content-items.js';
import { validateManifest, sanitizeManifest } from '../utils/schema-validator.js';
import { calculateWeightedContentScore, calculateDetailedScore } from '../utils/scoring.js';
import { DEFAULT_SCORING_CONFIG } from '../config/scoring.js';

/**
 * Robust sentence segmentation that handles abbreviations, decimals, URLs, etc.
 * Uses Intl.Segmenter when available, falls back to sophisticated regex
 */
function segmentSentences(text: string): string[] {
  // Use sophisticated regex approach for better handling of abbreviations, decimals, URLs
  // Intl.Segmenter is available but doesn't handle technical content as well
  // We'll use our custom approach for more accurate sentence boundaries

  // Fallback: sophisticated regex that handles common edge cases
  // This regex looks for sentence boundaries while avoiding:
  // - Abbreviations (Mr., Dr., etc.)
  // - Decimal numbers (3.14, 1.5, etc.)
  // - URLs (example.com, etc.)
  // - Ellipses (...)
  // - Multiple punctuation marks (?!, etc.)
  
  // More sophisticated approach: split on sentence boundaries but be more careful
  // First, normalize the text to handle edge cases
  let normalizedText = text
    // Temporarily replace common abbreviations to prevent splitting
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|Inc|Ltd|Corp|Co|St|Ave|Blvd|Rd|Ct|Ln|Pl|Cir|Way|Hwy|Pkwy|Alley|Terrace|Heights|Gardens|Manor|Village|Square|Court|Drive|Lane|Place|Road|Street|Boulevard|Avenue|Terrace|Heights|Gardens|Manor|Village|Square|Court|Drive|Lane|Place|Road|Street|Boulevard|Avenue)\./gi, '$1_ABBREV_')
    // Temporarily replace decimal numbers
    .replace(/(\d+)\.(\d+)/g, '$1_DECIMAL_$2')
    // Temporarily replace URLs
    .replace(/(https?:\/\/[^\s]+)/g, '_URL_$1')
    .replace(/(www\.[^\s]+)/g, '_URL_$1')
    .replace(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '_URL_$1');
  
  // Now split on sentence boundaries
  const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])/g;
  const sentences = normalizedText.split(sentenceRegex);
  
  // Restore the original text in each sentence and clean up
  return sentences
    .map(sentence => sentence.trim())
    .map(sentence => {
      // Restore abbreviations
      sentence = sentence.replace(/(\w+)_ABBREV_/g, '$1.');
      // Restore decimals
      sentence = sentence.replace(/(\d+)_DECIMAL_(\d+)/g, '$1.$2');
      // Restore URLs
      sentence = sentence.replace(/_URL_(https?:\/\/[^\s]+)/g, '$1');
      sentence = sentence.replace(/_URL_(www\.[^\s]+)/g, '$1');
      sentence = sentence.replace(/_URL_([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1');
      return sentence;
    })
    .filter(sentence => {
      // Skip empty sentences
      if (!sentence || sentence.length === 0) return false;
      
      // Skip sentences that are just punctuation
      if (/^[.!?,\s]+$/.test(sentence)) return false;
      
      // Skip very short fragments that are likely not complete sentences
      if (sentence.length < 5) return false;
      
      return true;
    })
    .map(sentence => {
      // Ensure sentence ends with proper punctuation
      if (!/[.!?]$/.test(sentence)) {
        sentence += '.';
      }
      return sentence;
    });
}

export interface SelectionConfig {
  clipBudgetMin: number;
  clipBudgetMax: number;
  judgeThreshold: number;
  axisMin: number;
  alignmentToleranceS: number;
  minTranscriptLength: number;
  minClipDurationSeconds: number;
}

export interface SelectionResult {
  selectedItems: ContentItem[];
  manifest: Manifest;
  selectionMetrics: {
    totalCandidates: number;
    selectedCount: number;
    averageScore: number;
    diversityScore: number;
    githubContextCount: number;
  };
}

/**
 * Manifest Builder Service
 * Implements content selection, ranking, and manifest generation
 */
export class ManifestBuilderService {
  private env: Environment;
  private contentItemService: ContentItemService;
  private config: SelectionConfig;

  constructor(env: Environment, config?: Partial<SelectionConfig>) {
    this.env = env;
    this.contentItemService = new ContentItemService(env);
    this.config = {
      clipBudgetMin: 6,
      clipBudgetMax: 12,
      judgeThreshold: 80,
      axisMin: 60,
      alignmentToleranceS: 5,
      minTranscriptLength: 20,
      minClipDurationSeconds: 10,
      ...config,
    };
  }

  /**
   * Build a daily recap manifest from ContentItems
   */
  async buildDailyManifest(
    date: string, // YYYY-MM-DD format
    timezone: string = 'UTC'
  ): Promise<SelectionResult> {
    try {
      console.log(`🏗️ Building daily manifest for ${date}...`);

      // Get ContentItems for the date range
      // Parse the input date in the given timezone, take that zone's startOf('day') and endOf('day'),
      // then convert those DateTime values to UTC ISO strings for use in the query
      const dateInTimezone = DateTime.fromISO(date, { zone: timezone });
      if (!dateInTimezone.isValid) {
        throw new Error(`Invalid date format or timezone: ${date}, ${timezone}`);
      }
      
      const startDate = dateInTimezone.startOf('day').toUTC().toISO();
      const endDate = dateInTimezone.endOf('day').toUTC().toISO();
      
      if (!startDate || !endDate) {
        throw new Error(`Failed to generate UTC date range for ${date} in timezone ${timezone}`);
      }
      
      const contentItems = await this.contentItemService.getContentItemsForDateRange(startDate, endDate);
      console.log(`📊 Found ${contentItems.length} ContentItems for ${date}`);

      if (contentItems.length === 0) {
        throw new Error(`No ContentItems found for date ${date}`);
      }

      // Select and rank ContentItems
      const selectedItems = await this.selectContentItems(contentItems);
      console.log(`✅ Selected ${selectedItems.length} ContentItems for manifest`);

      // Build manifest sections
      const sections = await this.buildManifestSections(selectedItems);

      // Generate manifest metadata
      const manifest = await this.generateManifest(date, timezone, selectedItems, sections);

      // Calculate selection metrics
      const metrics = this.calculateSelectionMetrics(contentItems, selectedItems);

      return {
        selectedItems,
        manifest,
        selectionMetrics: metrics,
      };
    } catch (error) {
      console.error('❌ Failed to build daily manifest:', error);
      throw error;
    }
  }

  /**
   * Select ContentItems using ranking and diversity constraints
   */
  private async selectContentItems(candidates: ContentItem[]): Promise<ContentItem[]> {
    // Filter candidates by minimum requirements
    const filteredCandidates = candidates.filter(item => {
      // Must have valid transcript (either summary or transcript_url)
      const hasValidSummary = item.transcript_summary && 
        item.transcript_summary.length >= this.config.minTranscriptLength;
      const hasTranscriptUrl = item.transcript_url && 
        (!item.transcript_size_bytes || item.transcript_size_bytes > 0);
      
      if (!hasValidSummary && !hasTranscriptUrl) {
        return false;
      }

      // Must meet minimum duration
      if (item.clip_duration < this.config.minClipDurationSeconds) {
        return false;
      }

      return true;
    });

    console.log(`🔍 Filtered to ${filteredCandidates.length} valid candidates`);

    // Score and rank candidates
    const scoredCandidates = filteredCandidates.map(item => ({
      item,
      score: this.calculateContentScore(item),
    }));

    // Sort by score (highest first)
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Apply diversity constraints
    const selectedItems: ContentItem[] = [];
    const hourGroups = new Map<number, number>(); // hour -> count
    const entityGroups = new Set<string>();

    for (const { item, score } of scoredCandidates) {
      // Check if we've reached the maximum
      if (selectedItems.length >= this.config.clipBudgetMax) {
        break;
      }

      // Check hour diversity (max 2 per hour) - use UTC for consistent timezone handling
      const hour = new Date(item.clip_created_at).getUTCHours();
      const hourCount = hourGroups.get(hour) || 0;
      if (hourCount >= 2) {
        continue;
      }

      // Check entity diversity (avoid too many similar entities)
      const entities = await this.extractEntities(item);
      const hasNewEntity = entities.some(entity => !entityGroups.has(entity));
      
      // If we have enough items and no new entities, be more selective
      if (selectedItems.length >= this.config.clipBudgetMin && !hasNewEntity) {
        continue;
      }

      // Add to selection
      selectedItems.push(item);
      hourGroups.set(hour, hourCount + 1);
      entities.forEach(entity => entityGroups.add(entity));

      console.log(`✅ Selected: ${item.clip_title} (score: ${score.toFixed(2)})`);
    }

    // Ensure minimum selection
    if (selectedItems.length < this.config.clipBudgetMin) {
      console.warn(`⚠️ Only selected ${selectedItems.length} items, below minimum ${this.config.clipBudgetMin}`);
    }

    return selectedItems;
  }

  /**
   * Calculate content score for ranking using normalized components and configurable weights
   * 
   * Uses the new scoring system that normalizes each component to 0-1 range,
   * applies configurable weights, and scales the final result to 0-100.
   * 
   * @param item - The content item to score
   * @returns Final score from 0-100
   */
  private calculateContentScore(item: ContentItem): number {
    const score = calculateWeightedContentScore(item, DEFAULT_SCORING_CONFIG);
    
    // Log detailed scoring information for debugging
    if (item.github_summary) {
      const details = calculateDetailedScore(item, DEFAULT_SCORING_CONFIG);
      console.log(`🔗 Scoring breakdown for ${item.clip_id}:`, {
        finalScore: details.finalScore,
        githubConfidence: details.components.githubConfidence,
        weightedComponents: details.weightedComponents,
      });
    }
    
    return score;
  }

  /**
   * Extract entities from ContentItem for diversity tracking
   * Uses a sophisticated pipeline with normalization, filtering, and frequency analysis
   */
  private async extractEntities(item: ContentItem): Promise<string[]> {
    // Configuration for entity extraction
    const config = {
      minTokenLength: 3,
      maxTokenLength: 20,
      titleMaxEntities: 5,
      transcriptMaxEntities: 20,
      overallMaxEntities: 10,
      stopwords: new Set([
        // Common English stopwords
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
        'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
        'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
        'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
        'am', 'is', 'are', 'was', 'were', 'been', 'being',
        // Common technical stopwords
        'get', 'set', 'use', 'see', 'go', 'make', 'take', 'come', 'look', 'want', 'need', 'like',
        'know', 'think', 'say', 'tell', 'ask', 'give', 'find', 'work', 'try', 'call', 'put',
        'let', 'way', 'time', 'year', 'day', 'week', 'month', 'thing', 'way', 'case', 'point',
        'right', 'left', 'good', 'bad', 'new', 'old', 'big', 'small', 'long', 'short', 'high', 'low',
        'first', 'last', 'next', 'previous', 'current', 'recent', 'early', 'late',
        // Programming/tech specific
        'var', 'let', 'const', 'function', 'class', 'if', 'else', 'for', 'while', 'return', 'import', 'export',
        'true', 'false', 'null', 'undefined', 'async', 'await', 'try', 'catch', 'finally',
        'public', 'private', 'protected', 'static', 'final', 'abstract', 'interface', 'extends', 'implements'
      ])
    };

    // Track entities by source for deduplication and caps
    const titleEntities = new Map<string, number>();
    const transcriptEntities = new Map<string, number>();
    const fixedContextTags: string[] = [];

    // Extract fixed context tags first (these are always included)
    if (item.github_context_url) {
      fixedContextTags.push('github-context');
    }

    // Helper function to normalize and tokenize text
    const normalizeAndTokenize = (text: string): string[] => {
      return text
        .toLowerCase()
        // Remove punctuation but preserve word boundaries
        .replace(/[^\w\s]/g, ' ')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(token => {
          // Filter by length
          if (token.length < config.minTokenLength || token.length > config.maxTokenLength) {
            return false;
          }
          // Filter stopwords
          if (config.stopwords.has(token)) {
            return false;
          }
          // Filter numeric tokens
          if (/^\d+$/.test(token)) {
            return false;
          }
          // Filter tokens that are just repeated characters
          if (/^(.)\1+$/.test(token)) {
            return false;
          }
          return true;
        });
    };

    // Process title
    if (item.clip_title) {
      const titleTokens = normalizeAndTokenize(item.clip_title);
      titleTokens.forEach(token => {
        titleEntities.set(token, (titleEntities.get(token) || 0) + 1);
      });
    }

    // Process transcript
    if (item.transcript_summary) {
      const transcriptTokens = normalizeAndTokenize(item.transcript_summary);
      transcriptTokens.forEach(token => {
        transcriptEntities.set(token, (transcriptEntities.get(token) || 0) + 1);
      });
    }

    // Select top entities from each source
    const selectTopEntities = (entityMap: Map<string, number>, maxCount: number): string[] => {
      return Array.from(entityMap.entries())
        .sort((a, b) => {
          // Sort by frequency (descending), then alphabetically (ascending) for stability
          if (b[1] !== a[1]) {
            return b[1] - a[1];
          }
          return a[0].localeCompare(b[0]);
        })
        .slice(0, maxCount)
        .map(([token]) => token);
    };

    const topTitleEntities = selectTopEntities(titleEntities, config.titleMaxEntities);
    const topTranscriptEntities = selectTopEntities(transcriptEntities, config.transcriptMaxEntities);

    // Combine all entities and select top overall
    const allEntities = [...fixedContextTags, ...topTitleEntities, ...topTranscriptEntities];
    
    // Remove duplicates while preserving order
    const uniqueEntities = allEntities.filter((entity, index) => allEntities.indexOf(entity) === index);
    
    // Return top N entities (including fixed context tags)
    return uniqueEntities.slice(0, config.overallMaxEntities);
  }

  /**
   * Build manifest sections from selected ContentItems
   */
  private async buildManifestSections(selectedItems: ContentItem[]): Promise<ManifestSection[]> {
    const sections: ManifestSection[] = [];

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const sectionId = `section-${i + 1}`;

      // Generate section title (normalize clip title)
      const title = this.normalizeClipTitle(item.clip_title);

      // Generate bullets from transcript and GitHub context
      const bullets = await this.generateBullets(item);

      // Generate paragraph with citations
      const paragraph = await this.generateParagraph(item);

      // Calculate section score
      const score = this.calculateContentScore(item);

      // Determine alignment status
      const alignmentStatus = this.determineAlignmentStatus(item);

      // Build section
      const section: ManifestSection = {
        section_id: sectionId,
        clip_id: item.clip_id,
        title,
        bullets,
        paragraph,
        score,
        repo: await this.extractRepoFromGitHubContext(item),
        pr_links: await this.extractPrLinks(item),
        clip_url: item.clip_url,
        vod_jump: this.generateVodJump(item),
        alignment_status: alignmentStatus,
        start: 0, // Clips start at 0, VOD offsets would be handled separately
        end: item.clip_duration,
        entities: await this.extractEntities(item),
      };

      sections.push(section);
    }

    return sections;
  }

  /**
   * Normalize clip title for section headers
   */
  private normalizeClipTitle(title: string): string {
    // Remove stream noise and normalize
    let normalized = title
      .replace(/^(yo|hey|so|okay|right|now|let's|let me|i'm|i am)\s+/i, '')
      .replace(/\s+(lol|haha|omg|wow|nice|cool|awesome|amazing)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize first letter of each word
    normalized = normalized.replace(/\b\w/g, l => l.toUpperCase());

    // Limit to 80 characters
    if (normalized.length > 80) {
      normalized = normalized.substring(0, 77) + '...';
    }

    return normalized;
  }

  /**
   * Generate bullets from transcript and GitHub context
   */
  private async generateBullets(item: ContentItem): Promise<string[]> {
    const bullets: string[] = [];
    
    // Get full transcript if available
    let transcript = null;
    if (item.transcript_url) {
      transcript = await getTranscriptFromR2(this.env, item.transcript_url);
    }
    
    // Get full GitHub context if available
    let githubContext = null;
    if (item.github_context_url) {
      githubContext = await getGitHubContextFromR2(this.env, item.github_context_url);
    }

    // Generate bullets from transcript
    if (transcript?.text) {
      const sentences = transcript.text.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
      const keySentences = sentences.slice(0, 3); // Take first 3 meaningful sentences
      
      for (const sentence of keySentences) {
        const bullet = sentence.trim().substring(0, 140); // Limit to 140 chars
        if (bullet.length > 20) { // Only add if substantial
          bullets.push(bullet);
        }
      }
    } else if (item.transcript_summary) {
      const sentences = item.transcript_summary.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
      const keySentences = sentences.slice(0, 2); // Take first 2 meaningful sentences
      
      for (const sentence of keySentences) {
        const bullet = sentence.trim().substring(0, 140); // Limit to 140 chars
        if (bullet.length > 20) { // Only add if substantial
          bullets.push(bullet);
        }
      }
    }

    // Generate bullets from GitHub context
    if (githubContext) {
      if (githubContext.linked_prs?.length) {
        const prBullet = `Linked to ${githubContext.linked_prs.length} pull request${githubContext.linked_prs.length > 1 ? 's' : ''}`;
        bullets.push(prBullet);
      }
      
      if (githubContext.linked_commits?.length) {
        const commitBullet = `Linked to ${githubContext.linked_commits.length} commit${githubContext.linked_commits.length > 1 ? 's' : ''}`;
        bullets.push(commitBullet);
      }
      
      if (githubContext.linked_issues?.length) {
        const issueBullet = `Linked to ${githubContext.linked_issues.length} issue${githubContext.linked_issues.length > 1 ? 's' : ''}`;
        bullets.push(issueBullet);
      }
    }

    // Ensure we have at least 2 bullets, max 4
    if (bullets.length < 2) {
      bullets.push('Content covers development topics and coding practices');
      bullets.push('Includes practical examples and real-world scenarios');
    }

    return bullets.slice(0, 4);
  }

  /**
   * Generate paragraph with citations
   */
  private async generateParagraph(item: ContentItem): Promise<string> {
    let paragraph = '';
    
    // Get full transcript if available
    let transcript = null;
    if (item.transcript_url) {
      transcript = await getTranscriptFromR2(this.env, item.transcript_url);
    }
    
    // Get full GitHub context if available
    let githubContext = null;
    if (item.github_context_url) {
      githubContext = await getGitHubContextFromR2(this.env, item.github_context_url);
    }

    // Build paragraph from transcript
    if (transcript?.text) {
      const sentences = transcript.text.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
      const keySentences = sentences.slice(0, 2); // Take first 2 meaningful sentences
      paragraph = keySentences.join('. ').trim() + '.';
    } else if (item.transcript_summary) {
      const sentences = item.transcript_summary.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
      const keySentences = sentences.slice(0, 2); // Take first 2 meaningful sentences
      paragraph = keySentences.join('. ').trim() + '.';
    }

    // Add GitHub context information
    if (githubContext) {
      const contextInfo = [];
      if (githubContext.linked_prs?.length) {
        contextInfo.push(`${githubContext.linked_prs.length} pull request${githubContext.linked_prs.length > 1 ? 's' : ''}`);
      }
      if (githubContext.linked_commits?.length) {
        contextInfo.push(`${githubContext.linked_commits.length} commit${githubContext.linked_commits.length > 1 ? 's' : ''}`);
      }
      if (githubContext.linked_issues?.length) {
        contextInfo.push(`${githubContext.linked_issues.length} issue${githubContext.linked_issues.length > 1 ? 's' : ''}`);
      }
      
      if (contextInfo.length > 0) {
        paragraph += ` This content is linked to ${contextInfo.join(', ')} in the repository.`;
      }
    }

    return paragraph || 'Content covers development topics and coding practices with practical examples.';
  }

  /**
   * Determine alignment status for VOD mapping
   */
  private determineAlignmentStatus(item: ContentItem): 'exact' | 'estimated' | 'missing' {
    // For now, assume exact if we have transcript URL
    if (item.transcript_url) {
      return 'exact';
    }
    
    // If we have duration but no transcript URL, estimate
    if (item.clip_duration > 0) {
      return 'estimated';
    }
    
    return 'missing';
  }

  /**
   * Generate VOD jump URL
   */
  private generateVodJump(item: ContentItem): string | undefined {
    // This would need VOD offset information
    // For now, return undefined
    return undefined;
  }

  /**
   * Extract repository from GitHub context
   */
  private async extractRepoFromGitHubContext(item: ContentItem): Promise<string | null> {
    if (!item.github_context_url) {
      return null;
    }
    
    const githubContext = await getGitHubContextFromR2(this.env, item.github_context_url);
    if (!githubContext?.linked_prs?.length) {
      return null;
    }
    
    // Extract repo from first PR URL
    const firstPr = githubContext.linked_prs[0];
    if (!firstPr) return null;
    const match = firstPr.url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract PR links from GitHub context
   */
  private async extractPrLinks(item: ContentItem): Promise<string[] | null> {
    if (!item.github_context_url) {
      return null;
    }
    
    const githubContext = await getGitHubContextFromR2(this.env, item.github_context_url);
    if (!githubContext?.linked_prs) return null;
    
    // Convert LinkedPullRequest objects to URLs
    return githubContext.linked_prs.map(pr => pr.url);
  }

  /**
   * Generate manifest metadata
   */
  private async generateManifest(
    date: string,
    timezone: string,
    selectedItems: ContentItem[],
    sections: ManifestSection[]
  ): Promise<Manifest> {
    // Generate title
    const title = await this.generateTitle(selectedItems);
    const headlineShort = title.length > 60 ? title.substring(0, 57) + '...' : title;

    // Generate summary
    const summary = await this.generateSummary(selectedItems);

    // Extract tags
    const tags = this.extractTags(selectedItems);

    // Extract repos
    const repos = await this.extractRepos(selectedItems);

    // Generate canonical VOD (use first clip for now)
    const canonicalVod = selectedItems[0]?.clip_url || '';

    // Build manifest
    const manifest: Manifest = {
      schema_version: '1.0.0',
      post_id: date,
      date_utc: `${date}T12:00:00.000Z`,
      tz: timezone,
      title,
      headline_short: headlineShort,
      summary,
      description: undefined,
      category: 'development',
      tags,
      repos,
      keywords: undefined,
      clip_ids: selectedItems.map(item => item.clip_id),
      sections,
      canonical_vod: canonicalVod,
      md_path: `content/blog/development/${date}-daily-recap.md`,
      target_branch: 'staging',
      status: 'draft',
      judge: undefined,
      social_blurbs: undefined,
    };

    // Validate and sanitize manifest
    const validation = sanitizeManifest(manifest);
    if (!validation.isValid) {
      throw new Error(`Manifest validation failed: ${validation.errors?.join(', ')}`);
    }

    return validation.sanitizedData as Manifest;
  }

  /**
   * Generate title from selected items
   */
  private async generateTitle(selectedItems: ContentItem[]): Promise<string> {
    // Count different types of content
    const hasGitHubContext = selectedItems.some(item => item.github_context_url);
    const hasMultipleClips = selectedItems.length > 1;

    if (hasGitHubContext) {
      return `Daily Dev Recap: ${selectedItems.length} Clips with GitHub Context`;
    } else if (hasMultipleClips) {
      return `Daily Dev Recap: ${selectedItems.length} Development Clips`;
    } else {
      return 'Daily Dev Recap: Development Discussion';
    }
  }

  /**
   * Generate summary from selected items
   */
  private async generateSummary(selectedItems: ContentItem[]): Promise<string> {
    const clipCount = selectedItems.length;
    const githubContextCount = selectedItems.filter(item => item.github_context_url).length;

    if (githubContextCount > 0) {
      return `Today's development session featured ${clipCount} clips with ${githubContextCount} connected to GitHub activity, including pull requests, commits, and issue discussions.`;
    } else {
      return `Today's development session included ${clipCount} clips covering various development topics and discussions.`;
    }
  }

  /**
   * Extract tags from selected items
   */
  private extractTags(selectedItems: ContentItem[]): string[] {
    const tags = new Set<string>();

    // Add base tags
    tags.add('development');
    tags.add('daily-recap');

    // Add tags from GitHub context
    selectedItems.forEach(item => {
      if (item.github_context_url) {
        tags.add('github-context');
      }
    });

    // Add content category tags
    selectedItems.forEach(item => {
      if (item.content_category) {
        tags.add(item.content_category);
      }
    });

    return Array.from(tags);
  }

  /**
   * Extract repos from selected items
   */
  private async extractRepos(selectedItems: ContentItem[]): Promise<string[]> {
    const repos = new Set<string>();

    for (const item of selectedItems) {
      const repo = await this.extractRepoFromGitHubContext(item);
      if (repo) {
        repos.add(repo);
      }
    }

    return Array.from(repos);
  }

  /**
   * Calculate selection metrics
   */
  private calculateSelectionMetrics(
    candidates: ContentItem[],
    selected: ContentItem[]
  ) {
    const totalCandidates = candidates.length;
    const selectedCount = selected.length;
    
    // Guard against division by zero
    let averageScore = 0;
    let diversityScore = 0;
    
    if (selectedCount > 0) {
      averageScore = selected.reduce((sum, item) => sum + (this.calculateContentScore(item)), 0) / selectedCount;
      
      // Calculate diversity score (simplified) - use UTC for consistent timezone handling
      const uniqueHours = new Set(selected.map(item => new Date(item.clip_created_at).getUTCHours())).size;
      diversityScore = (uniqueHours / selectedCount) * 100;
    }
    
    const githubContextCount = selected.filter(item => item.github_context_url).length;

    return {
      totalCandidates,
      selectedCount,
      averageScore,
      diversityScore,
      githubContextCount,
    };
  }
}
