// Environment interface
export interface Environment {
  ai: any; // Workers AI binding
  VECTORIZE: any; // Vectorize binding
  R2_BUCKET: any; // R2 bucket binding
  JOB_STORE: D1Database; // D1 database for job state management
  JOB_QUEUE: Queue; // Queue for background job processing
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
  TWITCH_BROADCASTER_ID: string;
  TWITCH_BROADCASTER_LOGIN?: string; // Optional login for broadcaster ID lookup
  GITHUB_APP_ID: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_TOKEN?: string;
  GITHUB_TOKEN_PAULCHRISLUKE?: string;
  GITHUB_TOKEN_BLAWBY?: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_REVIEW_CHANNEL_ID: string;
  CONTENT_REPO_OWNER: string;
  CONTENT_REPO_NAME: string;
  CONTENT_REPO_MAIN_BRANCH: string;
  AUDIO_PROCESSOR_URL?: string;
  HMAC_SHARED_SECRET: string;
  DISABLE_AUTH?: string; // Set to 'true' or '1' to disable authentication for testing
  WORKER_ORIGIN?: string; // Origin header for API requests (set via wrangler secret put), defaults to production worker URL
  R2_PUBLIC_BASE_URL?: string; // Public base URL for R2 objects (required for content storage operations)
  JOB_CLEANUP_NOTIFY_THRESHOLD?: string; // Threshold for job cleanup notifications (optional, defaults to 10)
  WRANGLER_DEV?: string; // Set to 'true' when running in wrangler dev mode
  NODE_ENV?: string; // Node environment (development, production, etc.)
}

// Health endpoint response interface
export interface HealthResponse {
  status: 'healthy';
  timestamp: string;
  service: string;
  version: string;
  uptime: string;
}

// ISO DateTime string type for consistent date handling
export type ISODateTimeString = string;

// Shared union types for clip-GitHub linking
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type MatchReason = 'temporal_proximity' | 'content_analysis' | 'manual_override';

// Content categorization
export type ContentCategory = 'development' | 'gaming' | 'tutorial' | 'review' | 'other';

// Score type for 0-1 scale values
export type Score01 = number;

// GitHub event action types
export type PullRequestAction = 'opened' | 'edited' | 'closed' | 'reopened' | 'synchronize' | 'ready_for_review' | 'converted_to_draft';

// Twitch API types
export interface TwitchClip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number | null;
}

export interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// Content generation types
export interface ClipSection {
  clip_id: string;
  h2: string;
  bullets: string[];
  paragraph: string;
  clip_url: string;
  vod_jump?: string;
  repo?: string;
  pr_links?: string[];
}

export interface BlogPost {
  title: string;
  date: string;
  clip_count: number;
  sections: ClipSection[];
  intro: string;
  tags: string[];
}

// Judge evaluation types
export interface JudgeResult {
  overall: Score01;
  per_axis: {
    coherence: Score01;
    correctness: Score01;
    dev_signal: Score01;
    narrative_flow: Score01;
    length: Score01;
    safety: Score01;
  };
  reasons: string[];
  action: 'approve' | 'needs-polish';
}

// GitHub types
export interface GitHubPR {
  title: string;
  body: string;
  head: string;
  base: string;
  draft: boolean;
}

// Flexible GitHub Check Run interface that matches the API
export interface GitHubCheckRun {
  name: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
  completed_at?: ISODateTimeString;
  output?: {
    title: string;
    summary: string;
    text?: string;
  };
}

// Stricter interface for completed check runs
export interface CompletedGitHubCheckRun extends Omit<GitHubCheckRun, 'status' | 'conclusion' | 'completed_at' | 'output'> {
  status: 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
  completed_at: ISODateTimeString;
  output: {
    title: string;
    summary: string;
    text?: string;
  };
}

// GitHub Event Storage Types (M8 - GitHub Integration)
export interface GitHubEvent {
  id: string; // x-github-delivery UUID
  event_type: string; // x-github-event
  repository: string; // org/repo
  timestamp: ISODateTimeString;
  action?: string; // For events with actions (pull_request, issues, etc.)
  payload: any; // Full webhook payload
  processed: boolean; // Whether this event has been processed for clip linking
}

export interface GitHubPullRequestEvent extends GitHubEvent {
  event_type: 'pull_request';
  action: PullRequestAction;
  payload: {
    action: PullRequestAction;
    pull_request: {
      number: number;
      title: string;
      body: string | null;
      html_url: string;
      state: string;
      merged: boolean;
      merged_at: ISODateTimeString | null;
      created_at: ISODateTimeString;
      updated_at: ISODateTimeString;
      closed_at: ISODateTimeString | null;
      user: {
        login: string;
      };
      head: {
        ref: string;
        sha: string;
      };
      base: {
        ref: string;
        sha: string;
      };
    };
    repository: {
      full_name: string;
    };
  };
}

export interface GitHubPushEvent extends GitHubEvent {
  event_type: 'push';
  payload: {
    ref: string;
    before: string;
    after: string;
    commits: Array<{
      id: string;
      message: string;
      timestamp: ISODateTimeString;
      url: string;
      author: {
        name: string;
        email: string;
      };
    }>;
    repository: {
      full_name: string;
      default_branch?: string;
    };
  };
}

export interface GitHubIssueEvent extends GitHubEvent {
  event_type: 'issues';
  action: 'opened' | 'edited' | 'deleted' | 'pinned' | 'unpinned' | 'closed' | 'reopened' | 'assigned' | 'unassigned' | 'labeled' | 'unlabeled' | 'locked' | 'unlocked' | 'transferred' | 'milestoned' | 'demilestoned';
  payload: {
    action: string;
    issue: {
      number: number;
      title: string;
      body: string | null;
      html_url: string;
      state: string;
      created_at: ISODateTimeString;
      updated_at: ISODateTimeString;
      closed_at: ISODateTimeString | null;
      user: {
        login: string;
      };
    };
    repository: {
      full_name: string;
    };
  };
}

// Clip-GitHub Linking Types
export interface GitHubContext {
  linked_prs?: LinkedPullRequest[];
  linked_commits?: LinkedCommit[];
  linked_issues?: LinkedIssue[];
  confidence_score?: number; // 0-1
  match_reason?: MatchReason;
}

export interface LinkedPullRequest {
  number: number;
  title: string;
  url: string;
  merged_at: ISODateTimeString;
  confidence: ConfidenceLevel;
  match_reason: MatchReason;
}

export interface LinkedCommit {
  sha: string;
  message: string;
  url: string;
  timestamp: ISODateTimeString;
  confidence: ConfidenceLevel;
  match_reason: MatchReason;
}

export interface LinkedIssue {
  number: number;
  title: string;
  url: string;
  closed_at: ISODateTimeString | null;
  confidence: ConfidenceLevel;
  match_reason: MatchReason;
}

// Enhanced Clip Metadata with GitHub Context
export interface EnhancedTwitchClip extends TwitchClip {
  github_context?: GitHubContext;
}

// Temporal Matching Configuration
export interface TemporalMatchingConfig {
  timeWindowHours: number; // Default: 2 hours
  confidenceThresholds: {
    high: number; // Minutes
    medium: number; // Minutes
    low: number; // Minutes
  };
}
