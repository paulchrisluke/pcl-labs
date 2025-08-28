# Cloudflare Worker Pipeline Plan

## Current Implementation Status (August 28, 2025)

### ✅ Working Components
1. **Authentication System**: ✅ **COMPLETE** - HMAC authentication deployed to all API endpoints
2. **Transcription Pipeline**: ✅ **WORKING** - 9/10 clips transcribed successfully (90% success rate)
3. **R2 Assets Worker**: ✅ **WORKING** - Asset serving via main worker
4. **Python Audio API**: ✅ **WORKING** - Redis integration, health endpoints functional
5. **GitHub Event Storage (M8)**: ✅ **WORKING** - Temporal matching and event storage implemented
6. **Twitch Integration**: ✅ **WORKING** - Clip fetching, storage, and validation
7. **GitHub Integration**: ✅ **WORKING** - API access, webhook handling, event storage

### Current Data State
- **Total clips processed**: 10 clips with full pipeline (video, audio, transcript)
- **Storage**: R2 bucket with organized structure (clips/, audio/, transcripts/)
- **GitHub Events**: Temporal matching system implemented
- **Authentication**: All endpoints protected with HMAC signatures
- **All tests passing**: Health, Twitch, GitHub, Pipeline, Deduplication, Audio, Transcription

### Current Pipeline Status
- **Asset serving**: ✅ Working via main worker
- **Python API**: ✅ Working with Redis
- **R2 storage**: ✅ All components functional
- **Authentication**: ✅ All endpoints protected
- **GitHub Events**: ✅ Temporal matching working

## Next Milestone: Content Generation Schema (CURRENT PRIORITY)

### Problem Analysis
**Current Data Fragmentation:**
- Twitch clips stored as raw JSON in R2
- GitHub events stored separately by date
- Transcripts stored as separate files
- No unified schema for content generation
- No easy way to query "clips from yesterday with GitHub context"

**Missing Components:**
- Unified data model for content generation
- Content-ready API endpoints
- Blog post generation pipeline
- AI content scoring system

### Solution: Unified Content Schema

#### **1. ContentItem Schema**
```typescript
import type { 
  ISODateTimeString, 
  GitHubContext, 
  Transcript, 
  TranscriptSegment 
} from '../types/index.js';

export type ContentCategory = 'development' | 'gaming' | 'tutorial' | 'review' | 'other';
export type Platform = 'twitch' | 'youtube' | 'unknown';
export type ProcessingStatus = 'pending' | 'queued' | 'audio_ready' | 'transcribed' | 'enhanced' | 'ready_for_content' | 'failed';

export interface ContentItem {
  // Schema versioning
  schema_version: '1.0.0';
  content_item_id: string;
  
  // Core clip data
  clip_id: string;
  clip_title: string;
  clip_url: string;
  clip_embed_url: string;
  clip_thumbnail_url: string;
  clip_duration: number;
  clip_view_count: number;
  clip_created_at: ISODateTimeString;
  broadcaster_name: string;
  creator_name: string;
  platform: Platform;
  
  // Processing status with enhanced states
  processing_status: ProcessingStatus;
  audio_file_url?: string;
  transcript?: Transcript;
  
  // GitHub context (enhanced data)
  github_context?: GitHubContext;
  
  // Content generation metadata
  content_score?: number;
  content_tags?: string[];
  content_category?: ContentCategory;
  
  // Error handling
  error?: {
    code: string;
    message: string;
    occurred_at: ISODateTimeString;
  };
  
  // Timestamps
  stored_at: ISODateTimeString;
  enhanced_at?: ISODateTimeString;
  content_ready_at?: ISODateTimeString;
  updated_at?: ISODateTimeString;
}
```

#### **2. Content Generation API**
```typescript
import type { ISODateTimeString, ContentCategory } from '../types/index.js';

// Request schema with pagination, sorting, and async support
export interface ContentGenerationRequest {
  // Pagination and sorting
  page?: number; // Default: 1
  limit?: number; // Default: 20, max: 100
  sort_by?: 'created_at' | 'view_count' | 'content_score' | 'duration';
  sort_order?: 'asc' | 'desc'; // Default: 'desc'
  
  // Date range
  date_range: {
    start: ISODateTimeString;
    end: ISODateTimeString;
  };
  
  // Filters
  filters?: {
    min_views?: number;
    min_duration?: number;
    max_duration?: number;
    categories?: ContentCategory[]; // Use shared ContentCategory enum
    min_confidence?: number;
    platform?: 'twitch' | 'youtube' | 'unknown';
    processing_status?: ProcessingStatus[];
  };
  
  // Content generation parameters
  content_type: 'daily_recap' | 'weekly_summary' | 'topic_focus';
  repository?: string;
  
  // Async processing and idempotency
  mode?: 'sync' | 'async'; // Default: 'sync'
  idempotency_key?: string; // For replay protection
}

// Response schema with structured pagination and async support
export interface ContentGenerationResponse {
  // Async job information (only present when mode='async')
  job_id?: string;
  job_status?: 'queued' | 'processing' | 'completed' | 'failed';
  
  // Content items (only present in sync mode or when job_status='completed')
  content_items?: ContentItem[];
  
  // Structured date range
  date_range: {
    start: ISODateTimeString;
    end: ISODateTimeString;
  };
  
  // Pagination metadata
  pagination: {
    total_items: number;
    total_pages: number;
    current_page: number;
    per_page: number;
    has_next: boolean;
    has_prev: boolean;
  };
  
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
  content_score?: number;
  
  // Error information (only present on failure)
  error?: {
    code: string;
    message: string;
    occurred_at: ISODateTimeString;
  };
}
```

### Implementation Plan

#### **Phase 1: Data Organization Service (Week 1)**
1. **Create ContentItem Service**
   - `src/services/content-items.ts` - Unified data management
   - Methods: create, update, query, enhance with GitHub context
   - R2 storage with organized ContentItem objects

2. **Data Migration Pipeline**
   - Process existing 10 clips into ContentItem format
   - Enhance with GitHub context using temporal matching
   - Store unified objects in R2 with proper indexing

3. **Content Generation Endpoint**
   - `POST /api/content/generate` - Main content generation API
   - Real-time processing with batch fallback
   - Filtering and sorting capabilities

#### **Phase 2: Content Generation Pipeline (Week 2)**
4. **Blog Post Generation Service**
   - AI-powered content selection and scoring
   - Markdown generation with proper front-matter
   - Integration with existing blog structure

5. **AI Content Judge System**
   - Content quality scoring (coherence, correctness, dev signal)
   - Approval/rejection workflow
   - Confidence scoring for GitHub matches

#### **Phase 3: GitHub Integration (Week 3)**
6. **Automated PR Creation**
   - Generate PRs with created blog posts
   - PR review workflow integration
   - Discord notifications for status updates

#### **Phase 4: Production Readiness (Week 4)**
7. **Monitoring & Observability**
   - Comprehensive logging for all pipeline stages
   - Error tracking and alerting
   - Performance metrics collection

### Technical Requirements
- **Storage**: R2 for ContentItem objects (unified schema)
- **Real-time**: Primary processing with batch fallback
- **Authentication**: HMAC signatures for all endpoints
- **AI Integration**: Workers AI for content scoring and generation
- **GitHub Integration**: Existing webhook and API infrastructure

#### **Performance & Reliability Requirements**
- **Indexing**: KV/D1 indexes for efficient queries; avoid R2 list scans
- **Replay Protection**: Enforce idempotency keys and key rotation
- **Cost Controls**: Add egress and Workers AI budget caps
- **Monitoring**: Comprehensive observability for all pipeline stages

### Files to Create/Modify
- `src/services/content-items.ts` - New unified data service
- `src/types/content.ts` - ContentItem and generation types
- `src/services/content-generation.ts` - Blog post generation
- `src/services/ai-judge.ts` - Content quality scoring
- Update existing clip processing to create ContentItems
- Update GitHub event enhancement to update ContentItems

### Success Metrics
- **Data Organization**: All clips in unified ContentItem format
- **Content Generation**: Working API endpoint for blog post generation
- **GitHub Integration**: Enhanced clips with proper GitHub context
- **Quality**: AI-scored content with confidence metrics

#### **Performance SLOs**
- **Synchronous Request Acknowledgement**: P95 < 200ms, P99 < 500ms
- **Async Content Generation**: P95 < 3s, P99 < 6s
- **Index Lookup Performance**: P95 < 50ms, P99 < 200ms
- **End-to-End User-Facing**: P95 < 2s, P99 < 5s

**Measurement**: 24-hour rolling window using synthetic + real-user telemetry

### Migration Strategy
- **Brand new app**: Can drop existing data if needed
- **Pipeline will regenerate**: All data will be recreated by pipeline
- **No data loss concerns**: Focus on clean implementation
- **Backup strategy**: R2 versioning for safety

## Current Issues to Fix (IMMEDIATE)
- ✅ ~~R2 asset serving URLs returning 404s~~ - **FIXED**
- ✅ ~~Python API deployment failing~~ - **FIXED**
- ✅ ~~Redis integration missing~~ - **FIXED**
- ✅ ~~Server configuration error (missing admin tokens)~~ - **FIXED**
- ✅ ~~Authentication missing from API endpoints~~ - **FIXED**
- 🔄 **Content generation schema missing** - **IN PROGRESS**

## Development Focus Areas
- **AI and Payment Apps**: Content will focus on development topics
- **Tech Stack**: Vue, Laravel, Inertia, React, Cloudflare Workers, Python
- **Real-time Processing**: Primary with batch fallback
- **R2 Storage**: Unified schema approach
- **Clean Architecture**: Separation of concerns with clear data contracts
