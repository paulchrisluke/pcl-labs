// Environment interface
export interface Environment {
  ai: any; // Workers AI binding
  VECTORIZE: any; // Vectorize binding
  R2_BUCKET: any; // R2 bucket binding
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
  ADMIN_FORCE_TRANSCRIBE_TOKEN?: string; // Admin token for force re-transcription endpoint
  ADMIN_KEY?: string; // Admin key for Whisper API and other admin endpoints
  WORKER_ORIGIN?: string; // Origin header for API requests (set via wrangler secret put), defaults to production worker URL
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
  overall: number;
  per_axis: {
    coherence: number;
    correctness: number;
    dev_signal: number;
    narrative_flow: number;
    length: number;
    safety: number;
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
