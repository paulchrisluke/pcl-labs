// Content generation types based on JSON schemas
import type { ISODateTimeString, ConfidenceLevel, MatchReason } from './index.js';

// Transcript segment type
export interface TranscriptSegment {
  start_s: number;
  end_s: number;
  text: string;
}

// Transcript type
export interface Transcript {
  text: string | null;
  language: string;
  redacted: boolean;
  segments: TranscriptSegment[];
}

// GitHub context type
export interface GitHubContext {
  linked_prs: string[]; // URIs
  linked_commits: string[];
  linked_issues: string[];
  confidence_score: number; // 0-1
  match_reason: string;
}

// ContentItem - row-level truth (one per clip)
export interface ContentItem {
  schema_version: '1.0.0';
  clip_id: string;
  clip_title: string;
  clip_url: string;
  clip_embed_url?: string;
  clip_thumbnail_url?: string;
  clip_duration: number;
  clip_view_count?: number;
  clip_created_at: ISODateTimeString;
  broadcaster_name?: string;
  creator_name?: string;

  processing_status: 'pending' | 'audio_ready' | 'transcribed' | 'enhanced' | 'ready_for_content';
  audio_file_url?: string;

  transcript?: Transcript;
  github_context?: GitHubContext;

  content_score?: number;
  content_tags?: string[];
  content_category?: 'development' | 'gaming' | 'tutorial' | 'review';

  stored_at: ISODateTimeString;
  enhanced_at?: ISODateTimeString;
  content_ready_at?: ISODateTimeString;
}

// Section type for manifest
export interface ManifestSection {
  section_id: string;
  clip_id: string;
  title: string; // max 80 chars
  bullets: string[]; // 2-4 items, max 140 chars each
  paragraph: string;
  score: number;
  repo?: string;
  pr_links?: string[]; // URIs
  clip_url?: string;
  vod_jump?: string; // URI
  alignment_status: 'exact' | 'estimated' | 'missing';
  start_s: number;
  end_s: number;
  entities?: string[];
}

// Judge result type
export interface JudgeResult {
  overall?: number;
  per_axis?: Record<string, number>;
  version?: string;
}

// Social blurbs type
export interface SocialBlurbs {
  bluesky?: string; // max 260 chars
  threads?: string; // max 260 chars
}

// Manifest - day-level composition
export interface Manifest {
  schema_version: '1.0.0';
  post_id: string; // YYYY-MM-DD format
  date_utc: ISODateTimeString;
  tz: string;
  title: string;
  headline_short: string; // max 60 chars
  summary: string; // max 180 chars
  description?: string;
  category: 'development';
  tags: string[];
  repos?: string[];
  keywords?: string;
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
    categories?: string[];
    min_confidence?: number;
  };
  content_type: 'daily_recap' | 'weekly_summary' | 'topic_focus';
  repository?: string;
}

// Content generation response
export interface ContentGenerationResponse {
  run_id: string; // ULID for tracking
  status: 'queued' | 'processing' | 'completed' | 'failed';
  content_items: ContentItem[];
  summary: {
    total_clips: number;
    total_prs: number;
    total_commits: number;
    total_issues: number;
    date_range: string;
  };
  suggested_title: string;
  suggested_tags: string[];
  content_score: number;
  manifest?: Manifest; // Only present when status is 'completed'
}

// Run status for async processing
export interface RunStatus {
  run_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
  progress?: {
    step: string;
    current: number;
    total: number;
  };
  error?: string;
  manifest?: Manifest;
}
