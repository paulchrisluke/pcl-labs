import type { Environment } from '../types/index.js';
import type { ContentItem, Manifest, ManifestSection } from '../types/content.js';
import { ContentItemService } from './content-items.js';
import { validateManifest, sanitizeManifest } from '../utils/schema-validator.js';

export interface SelectionConfig {
  clipBudgetMin: number;
  clipBudgetMax: number;
  judgeThreshold: number;
  axisMin: number;
  alignmentToleranceS: number;
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
      const startDate = `${date}T00:00:00.000Z`;
      const endDate = `${date}T23:59:59.999Z`;
      
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
      // Must have transcript
      if (!item.transcript?.text || item.transcript.text.length < 20) {
        return false;
      }

      // Must meet minimum duration
      if (item.clip_duration < 10) {
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

      // Check hour diversity (max 2 per hour)
      const hour = new Date(item.clip_created_at).getHours();
      const hourCount = hourGroups.get(hour) || 0;
      if (hourCount >= 2) {
        continue;
      }

      // Check entity diversity (avoid too many similar entities)
      const entities = this.extractEntities(item);
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
   * Calculate content score for ranking
   */
  private calculateContentScore(item: ContentItem): number {
    let score = 0;

    // Base score from existing content_score
    if (item.content_score) {
      score += item.content_score * 10; // Scale to 0-100
    }

    // GitHub context bonus
    if (item.github_context?.confidence_score) {
      const githubBonus = item.github_context.confidence_score * 20; // 0-20 points
      score += githubBonus;
      console.log(`🔗 GitHub context bonus: +${githubBonus.toFixed(2)} for ${item.clip_id}`);
    }

    // Duration bonus (prefer longer clips)
    const durationBonus = Math.min(item.clip_duration / 60 * 5, 10); // 0-10 points
    score += durationBonus;

    // View count bonus (if available)
    if (item.clip_view_count) {
      const viewBonus = Math.min(item.clip_view_count / 100, 5); // 0-5 points
      score += viewBonus;
    }

    // Transcript quality bonus
    if (item.transcript?.text) {
      const wordCount = item.transcript.text.split(/\s+/).length;
      const transcriptBonus = Math.min(wordCount / 10, 10); // 0-10 points
      score += transcriptBonus;
    }

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Extract entities from ContentItem for diversity tracking
   */
  private extractEntities(item: ContentItem): string[] {
    const entities: string[] = [];

    // Extract from title
    const titleWords = item.clip_title.toLowerCase().split(/\s+/);
    entities.push(...titleWords.filter(word => word.length > 3));

    // Extract from transcript
    if (item.transcript?.text) {
      const transcriptWords = item.transcript.text.toLowerCase().split(/\s+/);
      entities.push(...transcriptWords.filter(word => word.length > 4));
    }

    // Extract from GitHub context
    if (item.github_context?.linked_prs) {
      entities.push('github-pr');
    }
    if (item.github_context?.linked_commits) {
      entities.push('github-commit');
    }
    if (item.github_context?.linked_issues) {
      entities.push('github-issue');
    }

    return entities.slice(0, 10); // Limit to prevent too many entities
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
        repo: this.extractRepoFromGitHubContext(item),
        pr_links: item.github_context?.linked_prs || undefined,
        clip_url: item.clip_url,
        vod_jump: this.generateVodJump(item),
        alignment_status: alignmentStatus,
        start_s: 0, // Will be filled by transcript analysis
        end_s: item.clip_duration,
        entities: this.extractEntities(item),
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

    // Extract key points from transcript
    if (item.transcript?.text) {
      const sentences = item.transcript.text
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 10 && s.length < 140);

      // Take first 2-3 meaningful sentences
      const keySentences = sentences.slice(0, 3);
      bullets.push(...keySentences);
    }

    // Add GitHub context bullets
    if (item.github_context) {
      if (item.github_context.linked_prs.length > 0) {
        bullets.push(`Linked to ${item.github_context.linked_prs.length} pull request(s)`);
      }
      if (item.github_context.linked_commits.length > 0) {
        bullets.push(`Related to ${item.github_context.linked_commits.length} commit(s)`);
      }
      if (item.github_context.linked_issues.length > 0) {
        bullets.push(`Connected to ${item.github_context.linked_issues.length} issue(s)`);
      }
    }

    // Ensure we have 2-4 bullets
    if (bullets.length < 2) {
      bullets.push('Development discussion and code review');
    }
    if (bullets.length > 4) {
      bullets.splice(4); // Keep only first 4
    }

    return bullets;
  }

  /**
   * Generate paragraph with citations
   */
  private async generateParagraph(item: ContentItem): Promise<string> {
    let paragraph = '';

    // Start with transcript summary
    if (item.transcript?.text) {
      const summary = item.transcript.text.substring(0, 200);
      paragraph += summary;
      if (summary.length >= 200) {
        paragraph += '... ';
      }
    }

    // Add GitHub context citations
    if (item.github_context?.linked_prs.length) {
      paragraph += `This discussion relates to recent pull requests and code changes. `;
    }

    // Add clip reference
    paragraph += `Watch the full clip for complete context and additional insights.`;

    return paragraph;
  }

  /**
   * Determine alignment status for VOD mapping
   */
  private determineAlignmentStatus(item: ContentItem): 'exact' | 'estimated' | 'missing' {
    // For now, assume exact if we have transcript segments
    if (item.transcript?.segments && item.transcript.segments.length > 0) {
      return 'exact';
    }
    
    // If we have duration but no segments, estimate
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
   * Extract repo from GitHub context
   */
  private extractRepoFromGitHubContext(item: ContentItem): string | undefined {
    if (item.github_context?.linked_prs.length) {
      // Extract repo from first PR URL
      const prUrl = item.github_context.linked_prs[0];
      const match = prUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
      return match ? match[1] : undefined;
    }
    return undefined;
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
    const repos = this.extractRepos(selectedItems);

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
    const hasGitHubContext = selectedItems.some(item => item.github_context);
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
    const githubContextCount = selectedItems.filter(item => item.github_context).length;

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
      if (item.github_context?.linked_prs.length) {
        tags.add('pull-requests');
      }
      if (item.github_context?.linked_commits.length) {
        tags.add('commits');
      }
      if (item.github_context?.linked_issues.length) {
        tags.add('issues');
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
  private extractRepos(selectedItems: ContentItem[]): string[] {
    const repos = new Set<string>();

    selectedItems.forEach(item => {
      const repo = this.extractRepoFromGitHubContext(item);
      if (repo) {
        repos.add(repo);
      }
    });

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
    const averageScore = selected.reduce((sum, item) => sum + (this.calculateContentScore(item)), 0) / selectedCount;
    const githubContextCount = selected.filter(item => item.github_context).length;

    // Calculate diversity score (simplified)
    const uniqueHours = new Set(selected.map(item => new Date(item.clip_created_at).getHours())).size;
    const diversityScore = (uniqueHours / selectedCount) * 100;

    return {
      totalCandidates,
      selectedCount,
      averageScore,
      diversityScore,
      githubContextCount,
    };
  }
}
