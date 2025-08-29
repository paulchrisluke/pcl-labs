import type { Environment, GitHubContext, LinkedPullRequest, LinkedCommit, LinkedIssue, MatchReason, GitHubEvent } from '../types/index.js';
import type { ContentItem, Transcript, TranscriptSegment } from '../types/content.js';
import { uploadTranscriptToR2, uploadGitHubContextToR2 } from '../utils/content-storage.js';

// Type for raw clip data from R2 storage
interface ClipData {
  id?: string;
  clip_id?: string; // Alternative field name for id
  title: string;
  url: string;
  embed_url?: string;
  thumbnail_url?: string;
  duration?: number;
  view_count?: number;
  created_at: string;
  broadcaster_name?: string;
  creator_name?: string;
  stored_at?: string;
  audio_file?: {
    url?: string;
    exists?: boolean;
    size?: number;
    duration?: number;
    format?: string;
    [key: string]: any; // Allow additional audio file properties
  };
  github_context?: GitHubContext;
  linked_prs?: LinkedPullRequest[];
  linked_commits?: LinkedCommit[];
  [key: string]: any; // Allow additional properties that might exist in raw data
}

// Type for raw transcript data from R2 storage
interface TranscriptData {
  text?: string | null;
  language?: string;
  redacted?: boolean;
  segments?: unknown[];
  chunks?: unknown[];
  [key: string]: unknown; // Allow additional properties that might exist in raw data
}


import { ContentItemService } from './content-items.js';
import { GitHubEventService } from './github-events.js';
import { trackContentMigrationError } from '../utils/error-tracking.js';

export interface MigrationResult {
  success: boolean;
  migrated: number;
  failed: number;
  errors: string[];
}

/**
 * Content Migration Service
 * Converts existing Twitch clips and GitHub events into unified ContentItem format
 */
export class ContentMigrationService {
  private env: Environment;
  private contentItemService: ContentItemService;

  constructor(env: Environment) {
    this.env = env;
    this.contentItemService = new ContentItemService(env);
  }

  /**
   * Migrate existing clips to ContentItem format
   */
  async migrateExistingClips(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migrated: 0,
      failed: 0,
      errors: [],
    };

    try {
      console.log('🔄 Starting migration of existing clips to ContentItem format...');

      // Get existing clips from R2
      const existingClips = await this.getExistingClips();
      console.log(`📊 Found ${existingClips.length} existing clips to migrate`);

      for (const clip of existingClips) {
        try {
          const contentItem = await this.convertClipToContentItem(clip);
          const success = await this.contentItemService.storeContentItem(contentItem);
          if (success) {
            result.migrated++;
            const clipId = clip.id || clip.clip_id || 'unknown';
            console.log(`✅ Migrated clip: ${clipId}`);
          } else {
            result.failed++;
            const clipId = clip.id || clip.clip_id || 'unknown';
            const errorMsg = `Failed to store ContentItem for clip ${clipId}`;
            result.errors.push(errorMsg);
            trackContentMigrationError('storage_failed', errorMsg, { clipId });
          }
        } catch (error) {
          result.failed++;
          const clipId = clip.id || clip.clip_id || 'unknown';
          const errorMsg = `Error migrating clip ${clipId}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log(`🎉 Migration complete: ${result.migrated} migrated, ${result.failed} failed`);
      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error}`);
      console.error('❌ Migration failed:', error);
      return result;
    }
  }

  /**
   * Validate clip metadata structure and types
   * @param clipData - The parsed clip data to validate
   * @param objectKey - The R2 object key for contextual logging
   * @returns Validation result
   */
  private validateClipMetadata(clipData: ClipData): { isValid: boolean; error?: string } {
    try {
      // Check if clipData is a plain object
      if (!clipData || typeof clipData !== 'object' || Array.isArray(clipData)) {
        return {
          isValid: false,
          error: `Clip data must be a plain object, got ${typeof clipData}`
        };
      }

          // Validate required fields (id can be either 'id' or 'clip_id')
    const requiredFields = ['title', 'url', 'created_at'];
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (!(field in clipData)) {
        missingFields.push(field);
      }
    }

    // Check for id field (can be 'id' or 'clip_id')
    const clipId = clipData.id || clipData.clip_id;
    if (!clipId) {
      missingFields.push('id/clip_id');
    }

    if (missingFields.length > 0) {
      return {
        isValid: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      };
    }

          // Validate field types
    const typeErrors: string[] = [];

    // Validate id field type (already checked for existence above)
    if (typeof clipId !== 'string') {
      typeErrors.push('id/clip_id must be a string');
    }

      // Validate title
      if (typeof clipData.title !== 'string') {
        typeErrors.push('title must be a string');
      }

      // Validate url
      if (typeof clipData.url !== 'string') {
        typeErrors.push('url must be a string');
      }

      // Validate created_at (should be ISO date string)
      if (typeof clipData.created_at !== 'string') {
        typeErrors.push('created_at must be a string');
      } else {
        const date = new Date(clipData.created_at);
        if (isNaN(date.getTime())) {
          typeErrors.push('created_at must be a valid ISO date string');
        }
      }

      // Validate optional fields if present
      if (clipData.duration !== undefined && typeof clipData.duration !== 'number') {
        typeErrors.push('duration must be a number');
      }

      if (clipData.view_count !== undefined && typeof clipData.view_count !== 'number') {
        typeErrors.push('view_count must be a number');
      }

      if (clipData.broadcaster_name !== undefined && typeof clipData.broadcaster_name !== 'string') {
        typeErrors.push('broadcaster_name must be a string');
      }

      if (clipData.creator_name !== undefined && typeof clipData.creator_name !== 'string') {
        typeErrors.push('creator_name must be a string');
      }

      if (clipData.embed_url !== undefined && typeof clipData.embed_url !== 'string') {
        typeErrors.push('embed_url must be a string');
      }

      if (clipData.thumbnail_url !== undefined && typeof clipData.thumbnail_url !== 'string') {
        typeErrors.push('thumbnail_url must be a string');
      }

      if (typeErrors.length > 0) {
        return {
          isValid: false,
          error: `Type validation errors: ${typeErrors.join('; ')}`
        };
      }

      return {
        isValid: true
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get existing clips from R2 storage
   */
  private async getExistingClips(): Promise<ClipData[]> {
    try {
      const clips: ClipData[] = [];
      let continuationToken: string | undefined;
      let pageCount = 0;

      console.log('📋 Starting R2 bucket listing for clips...');

      do {
        pageCount++;
        console.log(`📄 Fetching page ${pageCount} of clips...`);

        // List objects with pagination
        const listOptions: { prefix: string; cursor?: string } = { prefix: 'clips/' };
        if (continuationToken) {
          listOptions.cursor = continuationToken;
        }

        const objects = await this.env.R2_BUCKET.list(listOptions);
        
        console.log(`📊 Page ${pageCount}: Found ${objects.objects.length} objects`);

        // Process objects in this page
        for (const obj of objects.objects) {
          // Look for both old format (clips/[clipId].json) and new format (clips/[clipId]/meta.json)
          if (obj.key.endsWith('.json') && (obj.key.endsWith('/meta.json') || obj.key.match(/^clips\/[^\/]+\.json$/))) {
            try {
              const object = await this.env.R2_BUCKET.get(obj.key);
              if (object) {
                // Parse JSON with error handling
                let clipData: ClipData;
                try {
                  clipData = await object.json();
                } catch (jsonError) {
                  console.error(`❌ Failed to parse JSON from ${obj.key}:`, jsonError);
                  const errorMsg = 'Failed to parse clip metadata JSON';
                  trackContentMigrationError('json_parse_failed', errorMsg, {
                    objectKey: obj.key,
                    error: jsonError instanceof Error ? jsonError.message : String(jsonError)
                  });
                  // Skip this clip due to JSON parse error
                  continue;
                }

                // Validate the parsed clip data
                const validation = this.validateClipMetadata(clipData);
                
                if (!validation.isValid) {
                  console.error(`❌ Invalid clip metadata in ${obj.key}: ${validation.error}`);
                  const errorMsg = 'Clip metadata validation failed';
                  trackContentMigrationError('clip_validation_failed', errorMsg, {
                    objectKey: obj.key,
                    error: validation.error,
                    clipDataKeys: Object.keys(clipData),
                    clipDataSample: {
                      id: clipData.id || clipData.clip_id,
                      title: clipData.title,
                      url: clipData.url,
                      created_at: clipData.created_at
                    }
                  });
                  // Skip this clip due to validation failure
                  continue;
                }

                // Use the raw clip data
                clips.push(clipData);
              }
            } catch (error) {
              console.warn(`⚠️ Failed to read clip metadata from ${obj.key}:`, error);
              const errorMsg = 'Failed to read clip metadata from R2';
              trackContentMigrationError('clip_read_failed', errorMsg, {
                objectKey: obj.key,
                error: error instanceof Error ? error.message : String(error)
              });
              // Failed to read clip metadata
            }
          }
        }

        // Update continuation token for next page
        continuationToken = objects.cursor;
        
        console.log(`✅ Page ${pageCount} processed. Total clips so far: ${clips.length}`);

      } while (continuationToken);

      console.log(`🎉 R2 listing complete! Processed ${pageCount} pages, found ${clips.length} clips`);
      return clips;
    } catch (error) {
      console.error('❌ Failed to get existing clips:', error);
      return [];
    }
  }

  /**
   * Efficiently count existing clips without fetching metadata
   * This is much faster than getExistingClips() when only the count is needed
   */
  private async countExistingClips(): Promise<number> {
    try {
      let totalCount = 0;
      let continuationToken: string | undefined;
      let pageCount = 0;

      console.log('📊 Starting efficient clip count...');

      do {
        pageCount++;
        console.log(`📄 Counting page ${pageCount}...`);

        // List objects with pagination
        const listOptions: { prefix: string; cursor?: string } = { prefix: 'clips/' };
        if (continuationToken) {
          listOptions.cursor = continuationToken;
        }

        const objects = await this.env.R2_BUCKET.list(listOptions);
        
        // Count both old format (clips/[clipId].json) and new format (clips/[clipId]/meta.json)
        const clipJsonCount = objects.objects.filter((obj: { key: string }) => 
          obj.key.endsWith('.json') && (obj.key.endsWith('/meta.json') || obj.key.match(/^clips\/[^\/]+\.json$/))
        ).length;
        totalCount += clipJsonCount;
        
        console.log(`📊 Page ${pageCount}: Found ${clipJsonCount} clips, total so far: ${totalCount}`);

        // Update continuation token for next page
        continuationToken = objects.cursor;

      } while (continuationToken);

      console.log(`🎉 Clip count complete! Found ${totalCount} clips across ${pageCount} pages`);
      return totalCount;
    } catch (error) {
      console.error('❌ Failed to count existing clips:', error);
      return 0;
    }
  }

  /**
   * Convert existing clip data to ContentItem format
   * @throws {Error} When clip data is invalid or conversion fails
   */
  private async convertClipToContentItem(clipData: ClipData): Promise<ContentItem> {
    try {
      // Extract clip ID (can be either 'id' or 'clip_id')
      const clipId = clipData.id || clipData.clip_id;
      if (!clipId) {
        throw new Error('Clip data must have either id or clip_id field');
      }
      
      // Get transcript if available
      const transcript = await this.getTranscriptForClip(clipId);
      
      // Get GitHub context if available
      const githubContext = await this.getGitHubContextForClip(clipId, clipData.created_at);

      // Determine processing status
      const processingStatus = this.determineProcessingStatus(clipData, transcript);

      // Use existing transcript and GitHub context URLs instead of re-uploading
      let transcriptUrl: string | null = null;
      let transcriptSummary: string | null = null;
      let transcriptSizeBytes: number | null = null;
      let githubContextUrl: string | null = null;
      let githubSummary: string | null = null;
      let githubContextSizeBytes: number | null = null;

      if (transcript) {
        // Use existing transcript URL from clip data
        transcriptUrl = clipData.transcript?.json?.url || null;
        transcriptSummary = transcript.text 
          ? transcript.text.substring(0, 200) + (transcript.text.length > 200 ? '...' : '')
          : `Transcript with ${transcript.segments.length} segments in ${transcript.language}`;
        transcriptSizeBytes = clipData.transcript?.json?.size || null;
      }

      if (githubContext) {
        // For now, skip GitHub context upload during migration
        // We can add this later if needed
        githubSummary = `GitHub context with ${githubContext.linked_prs?.length || 0} PRs, ${githubContext.linked_commits?.length || 0} commits`;
      }

      // Create ContentItem using the sanitized data
      const contentItem: ContentItem = {
        schema_version: '1.0.0',
        clip_id: clipId,
        clip_title: clipData.title,
        clip_url: clipData.url,
        clip_embed_url: clipData.embed_url,
        clip_thumbnail_url: clipData.thumbnail_url,
        clip_duration: clipData.duration || 0,
        clip_view_count: clipData.view_count,
        clip_created_at: clipData.created_at || clipData.stored_at || new Date().toISOString(),
        broadcaster_name: clipData.broadcaster_name || 'paulchrisluke',
        creator_name: clipData.creator_name || clipData.broadcaster_name || 'paulchrisluke',

        processing_status: processingStatus,
        audio_file_url: clipData.audio_file?.url,

        // Lightweight references instead of full objects
        transcript_url: transcriptUrl,
        transcript_summary: transcriptSummary,
        transcript_size_bytes: transcriptSizeBytes,
        github_context_url: githubContextUrl,
        github_summary: githubSummary,
        github_context_size_bytes: githubContextSizeBytes,

        content_score: undefined, // Will be calculated later
        content_tags: undefined, // Will be generated later
        content_category: 'development', // Default category

        stored_at: clipData.stored_at || new Date().toISOString(),
        enhanced_at: githubContext ? new Date().toISOString() : undefined,
        content_ready_at: processingStatus === 'ready_for_content' ? new Date().toISOString() : undefined,
      };

      return contentItem;
    } catch (error) {
      console.error('❌ Failed to convert clip to ContentItem:', error);
      throw error;
    }
  }

  /**
   * Validate transcript data structure
   */
  private validateTranscriptData(data: TranscriptData, clipId: string): data is { text?: string | null; language?: string; redacted?: boolean; segments?: unknown[]; chunks?: unknown[] } {
    // Basic type checks
    if (typeof data !== 'object' || data === null) {
      console.warn(`⚠️ Invalid transcript data for clip ${clipId}: data is not an object`);
      return false;
    }

    // Check for required fields with proper types
    if (data.text !== undefined && typeof data.text !== 'string' && data.text !== null) {
      console.warn(`⚠️ Invalid transcript data for clip ${clipId}: text field must be string or null, got ${typeof data.text}`);
      return false;
    }

    if (data.language !== undefined && typeof data.language !== 'string') {
      console.warn(`⚠️ Invalid transcript data for clip ${clipId}: language field must be string, got ${typeof data.language}`);
      return false;
    }

    if (data.redacted !== undefined && typeof data.redacted !== 'boolean') {
      console.warn(`⚠️ Invalid transcript data for clip ${clipId}: redacted field must be boolean, got ${typeof data.redacted}`);
      return false;
    }

    // Check segments/chunks arrays
    if (data.segments !== undefined && !Array.isArray(data.segments)) {
      console.warn(`⚠️ Invalid transcript data for clip ${clipId}: segments field must be array, got ${typeof data.segments}`);
      return false;
    }

    if (data.chunks !== undefined && !Array.isArray(data.chunks)) {
      console.warn(`⚠️ Invalid transcript data for clip ${clipId}: chunks field must be array, got ${typeof data.chunks}`);
      return false;
    }

    return true;
  }

  /**
   * Get transcript for a clip
   */
  private async getTranscriptForClip(clipId: string): Promise<Transcript | undefined> {
    try {
      // Try to get transcript from transcripts/ directory
      const transcriptKey = `transcripts/${clipId}.json`;
      const object = await this.env.R2_BUCKET.get(transcriptKey);
      
      if (object) {
        const transcriptData = await object.json();
        
        // Validate the parsed JSON structure before using it
        if (!this.validateTranscriptData(transcriptData, clipId)) {
          console.warn(`⚠️ Skipping invalid transcript data for clip ${clipId}`);
          return undefined;
        }
        
        // Convert to our Transcript format with validated data
        const transcript: Transcript = {
          text: transcriptData.text || null,
          language: transcriptData.language || 'en',
          redacted: transcriptData.redacted || false,
          segments: (transcriptData.segments || transcriptData.chunks || []) as TranscriptSegment[],
        };

        return transcript;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to get transcript for clip ${clipId}:`, error);
    }

    return undefined;
  }

  /**
   * Get GitHub context for a clip using temporal matching
   */
  private async getGitHubContextForClip(clipId: string, clipCreatedAt: string): Promise<GitHubContext | undefined> {
    try {
      // Get GitHub events around the clip creation time
      const clipDate = new Date(clipCreatedAt);
      const startDate = new Date(clipDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
      const endDate = new Date(clipDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours after

      const githubEventService = new GitHubEventService(this.env);
      const githubEvents = await githubEventService.getEventsForDateRange(
        startDate,
        endDate,
        undefined
      );

      if (githubEvents.length === 0) {
        return undefined;
      }

      // Extract linked items from GitHub events
      const linkedPrs: LinkedPullRequest[] = [];
      const linkedCommits: LinkedCommit[] = [];
      const linkedIssues: LinkedIssue[] = [];

      for (const event of githubEvents) {
        // Defensive check: ensure payload exists before accessing its properties
        if (!event.payload) {
          console.warn(`⚠️ Skipping GitHub event with missing payload: ${event.event_type}`);
          continue;
        }

        if (event.event_type === 'pull_request') {
          const pr = event.payload.pull_request;
          if (pr?.html_url) {
            linkedPrs.push({
              number: pr.number,
              title: pr.title,
              url: pr.html_url,
              merged_at: pr.merged_at || event.timestamp,
              confidence: 'medium' as const,
              match_reason: 'temporal_proximity' as const
            });
          }
        } else if (event.event_type === 'push') {
          // Safely iterate over commits array, skip if undefined or not an array
          const commits = event.payload.commits;
          if (Array.isArray(commits)) {
            for (const commit of commits) {
              if (commit?.sha) {
                linkedCommits.push({
                  sha: commit.sha,
                  message: commit.message,
                  url: commit.url,
                  timestamp: commit.timestamp,
                  confidence: 'medium' as const,
                  match_reason: 'temporal_proximity' as const
                });
              }
            }
          }
        } else if (event.event_type === 'issues') {
          const issue = event.payload.issue;
          if (issue?.html_url) {
            linkedIssues.push({
              number: issue.number,
              title: issue.title,
              url: issue.html_url,
              closed_at: issue.closed_at || null,
              confidence: 'medium' as const,
              match_reason: 'temporal_proximity' as const
            });
          }
        }
      }

      // Calculate confidence score based on temporal proximity
      const confidenceScore = this.calculateTemporalConfidence(clipDate, githubEvents);

      // Create GitHub context
      const githubContext: GitHubContext = {
        linked_prs: linkedPrs.length > 0 ? linkedPrs : undefined,
        linked_commits: linkedCommits.length > 0 ? linkedCommits : undefined,
        linked_issues: linkedIssues.length > 0 ? linkedIssues : undefined,
        confidence_score: confidenceScore,
        match_reason: 'temporal_proximity' as MatchReason
      };

      return githubContext;
    } catch (error) {
      console.error(`❌ Failed to get GitHub context for clip ${clipId}:`, error);
      return undefined;
    }
  }

  /**
   * Calculate confidence score based on temporal proximity
   */
  private calculateTemporalConfidence(clipDate: Date, githubEvents: GitHubEvent[]): number {
    if (githubEvents.length === 0) {
      return 0;
    }

    // Find the closest event in time
    let minTimeDiff = Infinity;
    for (const event of githubEvents) {
      const eventDate = new Date(event.timestamp);
      const timeDiff = Math.abs(clipDate.getTime() - eventDate.getTime());
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
      }
    }

    // Convert to confidence score (0-1) based on time difference
    // 2 hour window = 7200000 ms
    return Math.max(0, 1 - (minTimeDiff / (2 * 60 * 60 * 1000)));
  }

  /**
   * Determine processing status based on available data
   */
  private determineProcessingStatus(clipData: ClipData, transcript?: Transcript): ContentItem['processing_status'] {
    if (transcript && transcript.text && transcript.text.length > 0) {
      // Has transcript, check if it has audio file
      if (clipData.audio_file?.url) {
        return 'ready_for_content';
      } else {
        return 'transcribed';
      }
    } else if (clipData.audio_file?.url) {
      return 'audio_ready';
    } else {
      return 'pending';
    }
  }

  /**
   * Migrate a specific clip by ID
   * @throws {Error} When clip is not found or migration fails
   */
  async migrateClipById(clipId: string): Promise<boolean> {
    try {
      // Try new format first, then fall back to old format
      let clipKey = `clips/${clipId}/meta.json`;
      let object = await this.env.R2_BUCKET.get(clipKey);
      
      if (!object) {
        // Try old format
        clipKey = `clips/${clipId}.json`;
        object = await this.env.R2_BUCKET.get(clipKey);
      }
      
      if (!object) {
        const errorMessage = `Clip not found in storage`;
        trackContentMigrationError('clip_not_found_in_storage', errorMessage, { clipId, clipKey });
        throw new Error(`${errorMessage}: ${clipId} (tried keys: clips/${clipId}/meta.json, clips/${clipId}.json)`);
      }

      const clipData: ClipData = await object.json();
      const contentItem = await this.convertClipToContentItem(clipData);
      
      const success = await this.contentItemService.storeContentItem(contentItem);
      if (!success) {
        const errorMessage = `Failed to store ContentItem for clip`;
        trackContentMigrationError('storage_failed', errorMessage, { clipId });
        throw new Error(`${errorMessage}: ${clipId}`);
      }

      return true;
    } catch (error) {
      // Re-throw the error with additional context
      if (error instanceof Error) {
        throw new Error(`Failed to migrate clip ${clipId}: ${error.message}`);
      } else {
        throw new Error(`Failed to migrate clip ${clipId}: ${String(error)}`);
      }
    }
  }

  /**
   * Start a new migration session
   */
  async startNewMigrationSession(): Promise<string> {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get detailed failure information for the current migration session
   */
  async getMigrationFailures(): Promise<Array<{
    clipId: string;
    errorType: string;
    errorMessage: string;
    context?: Record<string, any>;
    timestamp: string;
  }>> {
    // Simplified implementation - return empty array since we're not tracking failures
    return [];
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    total_clips: number;
    migrated_clips: number;
    pending_clips: number;
    failed_clips: number;
  }> {
    try {
      // Efficiently count existing clips without fetching all metadata
      const totalClips = await this.countExistingClips();

      // Count migrated ContentItems
      const statusCounts = await this.contentItemService.getProcessingStatusCounts();
      const migratedClips = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

      // Simplified failure count - return 0 since we're not tracking failures
      const failedClips = 0;

      return {
        total_clips: totalClips,
        migrated_clips: migratedClips,
        pending_clips: totalClips - migratedClips,
        failed_clips: failedClips,
      };
    } catch (error) {
      console.error('❌ Failed to get migration status:', error);
      return {
        total_clips: 0,
        migrated_clips: 0,
        pending_clips: 0,
        failed_clips: 0,
      };
    }
  }
}
