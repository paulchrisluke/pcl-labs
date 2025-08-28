import type { Environment } from '../types/index.js';
import type { ContentItem, Transcript, GitHubContext } from '../types/content.js';
import { ContentItemService } from './content-items.js';
import { getGitHubEventsForDateRange } from './github-events.js';

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
          if (contentItem) {
            const success = await this.contentItemService.storeContentItem(contentItem);
            if (success) {
              result.migrated++;
              console.log(`✅ Migrated clip: ${clip.id}`);
            } else {
              result.failed++;
              result.errors.push(`Failed to store ContentItem for clip ${clip.id}`);
            }
          } else {
            result.failed++;
            result.errors.push(`Failed to convert clip ${clip.id} to ContentItem`);
          }
        } catch (error) {
          result.failed++;
          const errorMsg = `Error migrating clip ${clip.id}: ${error}`;
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
   * Get existing clips from R2 storage
   */
  private async getExistingClips(): Promise<any[]> {
    try {
      // List existing clips from the clips/ directory
      const objects = await this.env.R2_BUCKET.list({ prefix: 'clips/' });
      const clips: any[] = [];

      for (const obj of objects.objects) {
        if (obj.key.endsWith('/meta.json')) {
          try {
            const object = await this.env.R2_BUCKET.get(obj.key);
            if (object) {
              const clipData = await object.json();
              clips.push(clipData);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to read clip metadata from ${obj.key}:`, error);
          }
        }
      }

      return clips;
    } catch (error) {
      console.error('❌ Failed to get existing clips:', error);
      return [];
    }
  }

  /**
   * Convert existing clip data to ContentItem format
   */
  private async convertClipToContentItem(clipData: any): Promise<ContentItem | null> {
    try {
      // Extract basic clip information
      const clipId = clipData.id || clipData.clip_id;
      if (!clipId) {
        console.error('❌ Clip missing ID:', clipData);
        return null;
      }

      // Get transcript if available
      const transcript = await this.getTranscriptForClip(clipId);
      
      // Get GitHub context if available
      const githubContext = await this.getGitHubContextForClip(clipId, clipData.created_at);

      // Determine processing status
      const processingStatus = this.determineProcessingStatus(clipData, transcript);

      // Create ContentItem
      const contentItem: ContentItem = {
        schema_version: '1.0.0',
        clip_id: clipId,
        clip_title: clipData.title || 'Untitled Clip',
        clip_url: clipData.url || `https://www.twitch.tv/paulchrisluke/clip/${clipId}`,
        clip_embed_url: clipData.embed_url,
        clip_thumbnail_url: clipData.thumbnail_url,
        clip_duration: clipData.duration || 0,
        clip_view_count: clipData.view_count,
        clip_created_at: clipData.created_at,
        broadcaster_name: clipData.broadcaster_name || 'paulchrisluke',
        creator_name: clipData.creator_name || clipData.broadcaster_name || 'paulchrisluke',

        processing_status: processingStatus,
        audio_file_url: clipData.audio_file?.url,

        transcript,
        github_context: githubContext,

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
      return null;
    }
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
        
        // Convert to our Transcript format
        const transcript: Transcript = {
          text: transcriptData.text || null,
          language: transcriptData.language || 'en',
          redacted: transcriptData.redacted || false,
          segments: transcriptData.segments || transcriptData.chunks || [],
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

      const githubEvents = await getGitHubEventsForDateRange(
        this.env,
        startDate.toISOString(),
        endDate.toISOString()
      );

      if (githubEvents.length === 0) {
        return undefined;
      }

      // Extract linked items from GitHub events
      const linkedPrs: string[] = [];
      const linkedCommits: string[] = [];
      const linkedIssues: string[] = [];

      for (const event of githubEvents) {
        if (event.event_type === 'pull_request') {
          const pr = event.payload.pull_request;
          linkedPrs.push(pr.html_url);
        } else if (event.event_type === 'push') {
          for (const commit of event.payload.commits) {
            linkedCommits.push(commit.sha);
          }
        } else if (event.event_type === 'issues') {
          const issue = event.payload.issue;
          linkedIssues.push(issue.html_url);
        }
      }

      // Calculate confidence score based on temporal proximity
      const timeDiff = Math.abs(clipDate.getTime() - new Date(githubEvents[0].timestamp).getTime());
      const confidenceScore = Math.max(0, 1 - (timeDiff / (2 * 60 * 60 * 1000))); // 0-1 based on time difference

      return {
        linked_prs: linkedPrs,
        linked_commits: linkedCommits,
        linked_issues: linkedIssues,
        confidence_score: confidenceScore,
        match_reason: 'temporal_proximity',
      };
    } catch (error) {
      console.warn(`⚠️ Failed to get GitHub context for clip ${clipId}:`, error);
      return undefined;
    }
  }

  /**
   * Determine processing status based on available data
   */
  private determineProcessingStatus(clipData: any, transcript?: Transcript): ContentItem['processing_status'] {
    if (transcript && transcript.text && transcript.text.length > 0) {
      // Has transcript, check if it has GitHub context
      if (clipData.github_context || clipData.linked_prs || clipData.linked_commits) {
        return 'ready_for_content';
      } else {
        return 'transcribed';
      }
    } else if (clipData.audio_file?.exists) {
      return 'audio_ready';
    } else {
      return 'pending';
    }
  }

  /**
   * Migrate a specific clip by ID
   */
  async migrateClipById(clipId: string): Promise<boolean> {
    try {
      // Get clip metadata
      const clipKey = `clips/${clipId}/meta.json`;
      const object = await this.env.R2_BUCKET.get(clipKey);
      
      if (!object) {
        console.error(`❌ Clip not found: ${clipId}`);
        return false;
      }

      const clipData = await object.json();
      const contentItem = await this.convertClipToContentItem(clipData);
      
      if (contentItem) {
        return await this.contentItemService.storeContentItem(contentItem);
      }

      return false;
    } catch (error) {
      console.error(`❌ Failed to migrate clip ${clipId}:`, error);
      return false;
    }
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
      // Count existing clips
      const existingClips = await this.getExistingClips();
      const totalClips = existingClips.length;

      // Count migrated ContentItems
      const statusCounts = await this.contentItemService.getProcessingStatusCounts();
      const migratedClips = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

      return {
        total_clips: totalClips,
        migrated_clips: migratedClips,
        pending_clips: totalClips - migratedClips,
        failed_clips: 0, // Would need to track this separately
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
