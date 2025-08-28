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
  TwitchClip
} from '../types/index.js';

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
      const event: GitHubEvent = {
        id: deliveryId,
        event_type: eventType,
        repository,
        timestamp: new Date().toISOString(),
        action: payload.action,
        payload,
        processed: false
      };

      // Store by date for easy querying
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      const key = `github-events/${year}/${month}/${day}/${deliveryId}.json`;
      
      await this.env.R2_BUCKET.put(key, JSON.stringify(event, null, 2), {
        httpMetadata: {
          contentType: 'application/json',
        },
      });

      console.log(`✅ Stored GitHub event: ${eventType} (${deliveryId}) for ${repository}`);
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
        const objects = await this.env.R2_BUCKET.list({ prefix: `github-events/${dateKey}/` });
        
        for (const obj of objects.objects) {
          try {
            const response = await this.env.R2_BUCKET.get(obj.key);
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
          // Only include pushes to main branch
          if (pushEvent.payload.ref === 'refs/heads/main') {
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
   * Enhance a clip with GitHub context
   */
  async enhanceClipWithGitHubContext(
    clip: TwitchClip,
    repository?: string
  ): Promise<TwitchClip & { github_context?: GitHubContext }> {
    const { prs, commits, issues } = await this.findEventsForClip(clip, repository);
    
    if (prs.length === 0 && commits.length === 0 && issues.length === 0) {
      return clip;
    }
    
    const githubContext: GitHubContext = {
      linked_prs: prs,
      linked_commits: commits,
      linked_issues: issues
    };
    
    return {
      ...clip,
      github_context: githubContext
    };
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
          const response = await this.env.R2_BUCKET.get(eventKey);
          if (response) {
            const event = await response.json() as GitHubEvent;
            event.processed = true;
            
            await this.env.R2_BUCKET.put(eventKey, JSON.stringify(event, null, 2), {
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
        
        const objects = await this.env.R2_BUCKET.list(listOptions);
        
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
    this.config = { ...this.config, ...config };
  }
}
