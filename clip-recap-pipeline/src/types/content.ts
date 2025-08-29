// Content generation types based on JSON schemas
import type { ISODateTimeString, MatchReason, ContentCategory, Score01 } from './index.js';

// Transcript segment type
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

// Transcript type
export interface Transcript {
  text?: string | null;
  language: string;
  redacted: boolean;
  segments: TranscriptSegment[];
}

// Re-export GitHubContext from the canonical location
export type { GitHubContext } from './index.js';

// ContentItem - row-level truth (one per clip)
export interface ContentItem {
  schema_version: '1.0.0';
  clip_id: string;
  clip_title: string;
  clip_url: string;
  clip_embed_url?: string | null;
  clip_thumbnail_url?: string | null;
  clip_duration: number;
  clip_view_count?: number | null;
  clip_created_at: ISODateTimeString;
  broadcaster_name?: string | null;
  creator_name?: string | null;

  processing_status: 'pending' | 'audio_ready' | 'transcribed' | 'enhanced' | 'ready_for_content';
  audio_file_url?: string | null;

  // Lightweight references instead of full objects
  transcript_url?: string | null; // R2 URL to full transcript
  transcript_summary?: string | null; // Small summary retained in item
  transcript_size_bytes?: number | null; // Size of transcript object in R2
  
  github_context_url?: string | null; // R2 URL to full GitHub context
  github_summary?: string | null; // Small summary retained in item
  github_context_size_bytes?: number | null; // Size of GitHub context object in R2

  content_score?: Score01 | null;
  content_tags?: string[] | null;
  content_category?: ContentCategory | null;

  stored_at: ISODateTimeString;
  enhanced_at?: ISODateTimeString | null;
  content_ready_at?: ISODateTimeString | null;
}

// Section type for manifest
export interface ManifestSection {
  section_id: string;
  clip_id: string;
  title: string; // max 80 chars
  bullets: string[]; // 2-4 items, max 140 chars each
  paragraph: string;
  score: Score01;
  repo?: string | null;
  pr_links?: string[] | null; // URIs
  clip_url?: string | null;
  vod_jump?: string | null; // URI
  alignment_status: 'exact' | 'estimated' | 'missing';
  start: number;
  end: number;
  entities?: string[] | null;
}

// Judge result type
export interface JudgeResult {
  overall?: Score01 | null;
  per_axis?: Record<string, Score01> | null;
  version?: string | null;
}

// Social blurbs type
export interface SocialBlurbs {
  bluesky?: string | null; // max 260 chars
  threads?: string | null; // max 260 chars
}

// Manifest - day-level composition
export interface Manifest {
  schema_version: '1.0.0';
  post_id: string; // YYYY-MM-DD format
  date_utc: ISODateTimeString;
  tz: string;
  title: string;
  headline_short?: string; // max 60 chars
  summary: string; // max 180 chars
  description?: string | null;
  category: ContentCategory;
  tags: string[];
  repos?: string[] | null;
  keywords?: string | null;
  clip_ids: string[];

  sections: ManifestSection[];

  canonical_vod: string; // URI
  md_path: string; // content/blog/development/... pattern
  target_branch: 'staging' | 'main';
  status: 'draft' | 'pr_open' | 'approved' | 'merged' | 'published';

  judge?: JudgeResult;
  social_blurbs?: SocialBlurbs;
}

// Content generation request
export interface ContentGenerationRequest {
  date_range: {
    start: ISODateTimeString;
    end: ISODateTimeString;
  };
  filters?: {
    min_views?: number;
    min_duration?: number;
    max_duration?: number;
    categories?: ContentCategory[];
    min_confidence?: number;
  };
  content_type: 'daily_recap' | 'weekly_summary' | 'topic_focus';
  repository?: string;
}

// Job status types
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

// Job progress information
export interface JobProgress {
  step: string;
  current: number;
  total: number;
}

// Job state stored in D1
export interface JobState {
  job_id: string;
  status: JobStatus;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
  expires_at: ISODateTimeString;
  progress?: JobProgress;
  progress_step?: string; // Current step name
  progress_current?: number; // Current progress value
  progress_total?: number; // Total progress value
  request_data: string; // JSON string of original request
  results?: string; // JSON string of results (when completed)
  error_message?: string; // Error details (when failed)
  worker_id?: string; // ID of worker processing the job
  started_at?: ISODateTimeString; // When processing started
  completed_at?: ISODateTimeString; // When processing completed
}

// Cursor-based pagination for efficient cloud storage queries
export interface PaginationCursor {
  next_cursor?: string; // ULID for next page
  prev_cursor?: string; // ULID for previous page
  has_next: boolean;
  has_prev: boolean;
}

// Content generation response with enhanced job information
export interface ContentGenerationResponse {
  // Job information (always present)
  job_id: string;
  job_status: JobStatus;
  status_url: string; // Absolute URL for polling job status
  expires_at: ISODateTimeString; // ISO8601 timestamp when job expires
  
  // Content items (only present in sync mode or when job_status='completed')
  content_items?: ContentItem[];
  
  // Structured date range
  date_range: {
    start: ISODateTimeString;
    end: ISODateTimeString;
  };
  
  // Cursor-based pagination metadata
  pagination: PaginationCursor;
  
  // Summary statistics
  summary: {
    total_clips: number;
    total_prs: number;
    total_commits: number;
    total_issues: number;
  };
  
  // Content suggestions (only in sync mode or completed async jobs)
  suggested_title?: string;
  suggested_tags?: ContentCategory[]; // Align with ContentCategory enum
  content_score?: Score01;
  
  // Error information (only present on failure)
  error?: {
    code: string;
    message: string;
    occurred_at: ISODateTimeString;
  };
}

// Job status response for the status endpoint
export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  status_url: string;
  expires_at: ISODateTimeString;
  progress?: JobProgress;
  results?: any; // Parsed results when completed
  error?: {
    code: string;
    message: string;
    occurred_at: ISODateTimeString;
  };
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
  started_at?: ISODateTimeString;
  completed_at?: ISODateTimeString;
}

// Queue message for background job processing
export interface JobQueueMessage {
  job_id: string;
  request_data: ContentGenerationRequest;
  worker_id?: string;
}

// Run status type for tracking pipeline runs
export interface RunStatus {
  run_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
  completed_at?: ISODateTimeString;
  error?: string;
  results?: any;
}
