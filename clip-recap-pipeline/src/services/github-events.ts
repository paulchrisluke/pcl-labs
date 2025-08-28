import type { 
  Environment, 
  GitHubEvent, 
  GitHubPullRequestEvent, 
  GitHubPushEvent, 
  GitHubIssueEvent,
  GitHubContext,
  LinkedPullRequest,
  LinkedCommit,
  LinkedIssue,
  TemporalMatchingConfig,
  TwitchClip,
  MatchReason
} from '../types/index.js';
import { uploadGitHubContextToR2 } from '../utils/content-storage.js';

export interface GitHubContextMetadata {
  url: string;
  summary: string;
  sizeBytes: number;
}

export class GitHubEventService {
  private config: TemporalMatchingConfig;

  constructor(private env: Environment) {
    this.config = {
      timeWindowHours: 2, // Default 2 hour window
      confidenceThresholds: {
        high: 30, // 30 minutes
        medium: 60, // 1 hour
        low: 120 // 2 hours
      }
    };
  }

  /**
   * Get the R2 bucket safely, throwing an error if not available
   */
  private getBucket() {
    if (!this.env.R2_BUCKET) {
      throw new Error('R2_BUCKET is not available in this environment');
    }
    return this.env.R2_BUCKET;
  }

  /**
   * Extract canonical timestamp from GitHub webhook payload
   * Prioritizes event-specific timestamps, falls back to delivery time, then current time
   */
  private extractEventTimestamp(eventType: string, payload: any): string {
    // Try event-specific timestamp fields first
    switch (eventType) {
      case 'push':
        // Use the most recent commit timestamp
        if (payload.head_commit?.timestamp) {
          return payload.head_commit.timestamp;
        }
        // Fall back to first commit if no head_commit
        if (payload.commits?.[0]?.timestamp) {
          return payload.commits[0].timestamp;
        }
        break;
        
      case 'pull_request':
        // Prefer merged_at or closed_at to reflect the meaningful event moment
        if (payload.action === 'opened' && payload.pull_request?.created_at) {
          return payload.pull_request.created_at;
        }
        if (payload.action === 'closed' && payload.pull_request?.merged_at) {
          return payload.pull_request.merged_at;
        }
        if (payload.pull_request?.closed_at) {
          return payload.pull_request.closed_at;
        }
        if (payload.pull_request?.updated_at) {
          return payload.pull_request.updated_at;
        }
        if (payload.pull_request?.created_at) {
          return payload.pull_request.created_at;
        }
        break;
        
      case 'issues':
        // Use updated_at for most actions, created_at for new issues
        if (payload.action === 'opened' && payload.issue?.created_at) {
          return payload.issue.created_at;
        }
        if (payload.action === 'closed' && payload.issue?.closed_at) {
          return payload.issue.closed_at;
        }
        if (payload.issue?.updated_at) {
          return payload.issue.updated_at;
        }
        if (payload.issue?.created_at) {
          return payload.issue.created_at;
        }
        break;
        
      case 'release':
        if (payload.release?.published_at) {
          return payload.release.published_at;
        }
        if (payload.release?.created_at) {
          return payload.release.created_at;
        }
        break;
        
      case 'create':
        if (payload.created_at) {
          return payload.created_at;
        }
        break;
        
      case 'delete':
        if (payload.deleted_at) {
          return payload.deleted_at;
        }
        break;
        
      case 'fork':
        if (payload.forkee?.created_at) {
          return payload.forkee.created_at;
        }
        break;
        
      case 'star':
        if (payload.starred_at) {
          return payload.starred_at;
        }
        break;
        
      case 'watch':
        // WatchEvent webhooks never include starred_at
        // Use StarEvent payload handler or fetch from Stars API for star timestamps
        break;
        
      case 'gollum':
        if (payload.pages?.[0]?.updated_at) {
          return payload.pages[0].updated_at;
        }
        break;
        
      case 'page_build':
        if (payload.build?.created_at) {
          return payload.build.created_at;
        }
        break;
        
      case 'public':
        if (payload.repository?.created_at) {
          return payload.repository.created_at;
        }
        break;
        
      case 'repository':
        if (payload.repository?.created_at) {
          return payload.repository.created_at;
        }
        if (payload.repository?.updated_at) {
          return payload.repository.updated_at;
        }
        break;
        
      case 'deployment':
        if (payload.deployment?.created_at) {
          return payload.deployment.created_at;
        }
        break;
        
      case 'deployment_status':
        if (payload.deployment_status?.created_at) {
          return payload.deployment_status.created_at;
        }
        break;
        
      case 'discussion':
        if (payload.discussion?.created_at) {
          return payload.discussion.created_at;
        }
        if (payload.discussion?.updated_at) {
          return payload.discussion.updated_at;
        }
        break;
        
      case 'discussion_comment':
        if (payload.comment?.created_at) {
          return payload.comment.created_at;
        }
        if (payload.comment?.updated_at) {
          return payload.comment.updated_at;
        }
        break;
        
      case 'commit_comment':
        if (payload.comment?.created_at) {
          return payload.comment.created_at;
        }
        if (payload.comment?.updated_at) {
          return payload.comment.updated_at;
        }
        break;
        
      case 'issue_comment':
        if (payload.comment?.created_at) {
          return payload.comment.created_at;
        }
        if (payload.comment?.updated_at) {
          return payload.comment.updated_at;
        }
        break;
        
      case 'pull_request_review':
        if (payload.review?.submitted_at) {
          return payload.review.submitted_at;
        }
        break;
        
      case 'pull_request_review_comment':
        if (payload.comment?.created_at) {
          return payload.comment.created_at;
        }
        if (payload.comment?.updated_at) {
          return payload.comment.updated_at;
        }
        break;
        
      case 'workflow_run':
        if (payload.workflow_run?.created_at) {
          return payload.workflow_run.created_at;
        }
        break;
        
      case 'check_run':
        if (payload.check_run?.started_at) {
          return payload.check_run.started_at;
        }
        if (payload.check_run?.completed_at) {
          return payload.check_run.completed_at;
        }
        break;
        
      case 'check_suite':
        if (payload.check_suite?.created_at) {
          return payload.check_suite.created_at;
        }
        break;
        
      case 'code_scanning_alert':
        if (payload.alert?.created_at) {
          return payload.alert.created_at;
        }
        if (payload.alert?.updated_at) {
          return payload.alert.updated_at;
        }
        break;
        
      case 'dependabot_alert':
        if (payload.alert?.created_at) {
          return payload.alert.created_at;
        }
        if (payload.alert?.updated_at) {
          return payload.alert.updated_at;
        }
        break;
        
      case 'secret_scanning_alert':
        if (payload.alert?.created_at) {
          return payload.alert.created_at;
        }
        if (payload.alert?.updated_at) {
          return payload.alert.updated_at;
        }
        break;
    }
    
    // Fall back to delivery time if available
    if (payload.delivery_time) {
      return payload.delivery_time;
    }
    
    // Fall back to generic timestamp field
    if (payload.timestamp) {
      return payload.timestamp;
    }
    
    // Last resort: current time
    return new Date().toISOString();
  }

  /**
   * Get a shallow copy of the current configuration
   */
  getConfig(): TemporalMatchingConfig {
    return { ...this.config };
  }

  /**
   * Store a GitHub webhook event in R2
   */
  async storeEvent(
    deliveryId: string,
    eventType: string,
    payload: any,
    repository: string
  ): Promise<boolean> {
    try {
      // Extract canonical timestamp from payload
      const eventTimestamp = this.extractEventTimestamp(eventType, payload);
      
      // Normalize and validate the event timestamp
      let date: Date;
      try {
        date = new Date(eventTimestamp);
        if (!isFinite(date.getTime())) {
          console.warn(`⚠️ Invalid timestamp for event ${deliveryId}: ${eventTimestamp}, falling back to current time`);
          date = new Date();
        }
      } catch {
        console.warn(`⚠️ Failed to parse timestamp for event ${deliveryId}: ${eventTimestamp}, falling back to current time`);
        date = new Date();
      }
      
      const normalizedTimestamp = date.toISOString();
      const event: GitHubEvent = {
        id: deliveryId,
        event_type: eventType,
        repository,
        timestamp: normalizedTimestamp,
        action: payload.action,
        payload,
        processed: false
      };

      // Store by event date for temporal matching using the same normalized date
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      const key = `github-events/${year}/${month}/${day}/${deliveryId}.json`;
      
      await this.getBucket().put(key, JSON.stringify(event, null, 2), {
        httpMetadata: {
          contentType: 'application/json',
        },
      });

      console.log(`✅ Stored GitHub event: ${eventType} (${deliveryId}) for ${repository} at ${normalizedTimestamp}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to store GitHub event ${deliveryId}:`, error);
      return false;
    }
  }

  /**
   * Get GitHub events for a specific date range
   */
  async getEventsForDateRange(
    startDate: Date,
    endDate: Date,
    repository?: string
  ): Promise<GitHubEvent[]> {
    const events: GitHubEvent[] = [];
    
    try {
      // Generate date keys to check
      const dateKeys = this.generateDateKeys(startDate, endDate);
      
      for (const dateKey of dateKeys) {
        const objects = await this.getBucket().list({ prefix: `github-events/${dateKey}/` });
        
        for (const obj of objects.objects) {
          try {
            const response = await this.getBucket().get(obj.key);
            if (response) {
              const event = await response.json() as GitHubEvent;
              
              // Filter by repository if specified
              if (!repository || event.repository === repository) {
                events.push(event);
              }
            }
          } catch (error) {
            console.error(`Error reading event from ${obj.key}:`, error);
          }
        }
      }
      
      // Sort by timestamp (newest first)
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return events;
    } catch (error) {
      console.error('Error fetching GitHub events:', error);
      return [];
    }
  }

  /**
   * Find GitHub events that occurred within the time window of a clip
   */
  async findEventsForClip(
    clip: TwitchClip,
    repository?: string
  ): Promise<{
    prs: LinkedPullRequest[];
    commits: LinkedCommit[];
    issues: LinkedIssue[];
  }> {
    const clipTime = new Date(clip.created_at);
    const startTime = new Date(clipTime.getTime() - (this.config.timeWindowHours * 60 * 60 * 1000));
    const endTime = new Date(clipTime.getTime() + (this.config.timeWindowHours * 60 * 60 * 1000));
    
    const events = await this.getEventsForDateRange(startTime, endTime, repository);
    
    const prs: LinkedPullRequest[] = [];
    const commits: LinkedCommit[] = [];
    const issues: LinkedIssue[] = [];
    
    for (const event of events) {
      const eventTime = new Date(event.timestamp);
      const timeDiffMinutes = Math.abs(eventTime.getTime() - clipTime.getTime()) / (1000 * 60);
      
      // Determine confidence based on time difference
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (timeDiffMinutes <= this.config.confidenceThresholds.high) {
        confidence = 'high';
      } else if (timeDiffMinutes <= this.config.confidenceThresholds.medium) {
        confidence = 'medium';
      }
      
      switch (event.event_type) {
        case 'pull_request': {
          const prEvent = event as GitHubPullRequestEvent;
          if (prEvent.payload.action === 'closed' && prEvent.payload.pull_request.merged) {
            prs.push({
              number: prEvent.payload.pull_request.number,
              title: prEvent.payload.pull_request.title,
              url: prEvent.payload.pull_request.html_url,
              merged_at: prEvent.payload.pull_request.merged_at || event.timestamp,
              confidence,
              match_reason: 'temporal_proximity'
            });
          }
          break;
        }
        
        case 'push': {
          const pushEvent = event as GitHubPushEvent;
          // Only include pushes to the repository's default branch
          const defaultBranch = pushEvent.payload.repository?.default_branch;
          const expectedRef = defaultBranch ? `refs/heads/${defaultBranch}` : 'refs/heads/main';
          
          if (pushEvent.payload.ref === expectedRef) {
            for (const commit of pushEvent.payload.commits) {
              commits.push({
                sha: commit.id,
                message: commit.message,
                url: commit.url,
                timestamp: commit.timestamp
              });
            }
          }
          break;
        }
        
        case 'issues': {
          const issueEvent = event as GitHubIssueEvent;
          if (issueEvent.payload.action === 'closed') {
            issues.push({
              number: issueEvent.payload.issue.number,
              title: issueEvent.payload.issue.title,
              url: issueEvent.payload.issue.html_url,
              closed_at: issueEvent.payload.issue.closed_at || event.timestamp,
              confidence,
              match_reason: 'temporal_proximity'
            });
          }
          break;
        }
      }
    }
    
    return { prs, commits, issues };
  }

  /**
   * Enhance a clip with GitHub context and return metadata
   * Returns metadata for ContentItem instead of embedding full context
   */
  async enhanceClipWithGitHubContext(
    clip: TwitchClip,
    repository?: string
  ): Promise<GitHubContextMetadata | null> {
    const { prs, commits, issues } = await this.findEventsForClip(clip, repository);
    
    if (prs.length === 0 && commits.length === 0 && issues.length === 0) {
      return null;
    }
    
    const githubContext: GitHubContext = {
      linked_prs: prs,
      linked_commits: commits,
      linked_issues: issues,
      confidence_score: 0.8, // Default confidence score
      match_reason: 'temporal_proximity' as MatchReason
    };
    
    // Upload to R2 and return metadata
    return await uploadGitHubContextToR2(this.env, clip.id, githubContext);
  }

  /**
   * Mark events as processed to avoid duplicate processing
   */
  async markEventsAsProcessed(eventIds: string[]): Promise<void> {
    for (const eventId of eventIds) {
      try {
        // Search for the event file across all dates
        const eventKey = await this.findEventKey(eventId);
        
        if (eventKey) {
          const response = await this.getBucket().get(eventKey);
          if (response) {
            const event = await response.json() as GitHubEvent;
            event.processed = true;
            
            await this.getBucket().put(eventKey, JSON.stringify(event, null, 2), {
              httpMetadata: {
                contentType: 'application/json',
              },
            });
            
            console.log(`✅ Marked event ${eventId} as processed`);
          }
        } else {
          console.warn(`⚠️ Event ${eventId} not found in R2 storage`);
        }
      } catch (error) {
        console.error(`Error marking event ${eventId} as processed:`, error);
      }
    }
  }

  /**
   * Find the R2 key for a specific event ID by searching through all stored events
   */
  private async findEventKey(eventId: string): Promise<string | null> {
    try {
      // List all objects under the github-events prefix
      let continuationToken: string | undefined;
      
      do {
        const listOptions: any = { prefix: 'github-events/' };
        if (continuationToken) {
          listOptions.cursor = continuationToken;
        }
        
        const objects = await this.getBucket().list(listOptions);
        
        // Look for the event file
        for (const obj of objects.objects) {
          if (obj.key.endsWith(`${eventId}.json`)) {
            return obj.key;
          }
        }
        
        continuationToken = objects.cursor;
      } while (continuationToken);
      
      return null;
    } catch (error) {
      console.error(`Error searching for event ${eventId}:`, error);
      return null;
    }
  }

  /**
   * Generate date keys for a date range
   */
  private generateDateKeys(startDate: Date, endDate: Date): string[] {
    const keys: string[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      
      keys.push(`${year}/${month}/${day}`);
      
      current.setDate(current.getDate() + 1);
    }
    
    return keys;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TemporalMatchingConfig>): void {
    // Merge top-level properties
    this.config = { ...this.config, ...config };
    
    // Explicitly merge confidenceThresholds if provided
    if (config.confidenceThresholds) {
      this.config.confidenceThresholds = {
        ...this.config.confidenceThresholds,
        ...config.confidenceThresholds
      };
    }
  }
}
