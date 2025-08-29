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

## Security Specification: HMAC Authentication System

### **Required Security Headers**
All authenticated API endpoints require the following headers:

- **X-Signature**: HMAC-SHA256 signature of the request
- **X-Timestamp**: RFC3339 timestamp (e.g., `2025-01-15T10:30:00Z`)
- **X-Nonce**: Unique random string for replay protection
- **X-Key-Id** (optional): Key identifier for key rotation
- **X-Idempotency-Key** (optional): For idempotent request handling

### **Signature Base String Format**
The signature is computed over the following canonical string:
```
METHOD\nPATH\nQUERY\nsha256(body)\nX-Timestamp\nX-Nonce
```

**Components:**
- **METHOD**: HTTP method (GET, POST, PUT, DELETE, etc.)
- **PATH**: Request path without query parameters (e.g., `/api/content/generate`)
- **QUERY**: URL-encoded query string (empty string if no query params)
- **sha256(body)**: SHA256 hash of request body (empty string hash for GET requests)
- **X-Timestamp**: RFC3339 timestamp from header
- **X-Nonce**: Nonce value from header

### **Request Body Hashing**
- **POST/PUT/PATCH requests**: Compute SHA256 hash of raw request body
- **GET/DELETE requests**: Use empty string hash (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`)
- **Content-Type**: Must be `application/json` for requests with bodies

### **Clock Skew Protection**
- **Maximum skew**: 300 seconds (5 minutes)
- **Rejection**: Requests with timestamp difference > 300s are rejected with HTTP 401
- **Server time**: All timestamps compared against server's UTC time

### **Nonce Replay Protection**
- **Storage**: Recent nonces stored per API key in KV/D1 with TTL
- **TTL window**: 300 seconds (matches clock skew limit)
- **Rejection**: Duplicate nonces within TTL window rejected with HTTP 401
- **Cleanup**: Automatic cleanup of expired nonces

### **Key Rotation Semantics**
- **Active keys**: Current valid API keys for signature verification
- **Previous keys**: Recently rotated keys still valid for grace period
- **Grace period**: 24 hours for key rotation (allows for client updates)
- **X-Key-Id**: Optional header to specify which key was used
- **Key lookup**: If X-Key-Id provided, verify against specific key; otherwise try all active keys

### **Error Handling**
- **Missing headers**: HTTP 400 Bad Request for any required header
- **Invalid signature**: HTTP 401 Unauthorized with error details
- **Clock skew**: HTTP 401 Unauthorized with "Clock skew too large" message
- **Replay attack**: HTTP 401 Unauthorized with "Nonce already used" message
- **Invalid key**: HTTP 401 Unauthorized with "Invalid API key" message

### **Signature Generation Example**
```bash
# Example for POST /api/content/generate
METHOD="POST"
PATH="/api/content/generate"
QUERY=""
BODY='{"date_range":{"start":"2025-01-01T00:00:00Z","end":"2025-01-02T00:00:00Z"},"content_type":"daily_recap"}'
BODY_HASH=$(echo -n "$BODY" | openssl dgst -sha256 -binary | xxd -p -c 64)
TIMESTAMP="2025-01-15T10:30:00Z"
NONCE="abc123def456ghi789"

# Create signature base string
SIGNATURE_STRING="${METHOD}\n${PATH}\n${QUERY}\n${BODY_HASH}\n${TIMESTAMP}\n${NONCE}"

# Generate HMAC signature
SIGNATURE=$(echo -e "$SIGNATURE_STRING" | openssl dgst -sha256 -hmac "$API_SECRET" -binary | xxd -p -c 64)

# Headers
X-Signature: $SIGNATURE
X-Timestamp: $TIMESTAMP
X-Nonce: $NONCE
X-Key-Id: key_2025_01
X-Idempotency-Key: req_123456789
```

### **Implementation Requirements**
- **Web Crypto API**: Use `crypto.subtle.importKey()` and `crypto.subtle.sign()` for HMAC
- **Key storage**: Secure storage of API keys in Cloudflare Workers environment variables
- **Nonce storage**: KV or D1 for nonce tracking with automatic TTL
- **Clock synchronization**: Use Cloudflare Workers' built-in time functions
- **Logging**: Log all authentication attempts (success/failure) for security monitoring

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
  
  // Lightweight references instead of full objects
  transcript_url?: string; // R2 URL to full transcript
  transcript_summary?: string; // Small summary retained in item
  transcript_size_bytes?: number; // Size of transcript object in R2
  
  github_context_url?: string; // R2 URL to full GitHub context
  github_summary?: string; // Small summary retained in item
  github_context_size_bytes?: number; // Size of GitHub context object in R2
  
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
import type { ISODateTimeString, ContentCategory, ProcessingStatus, ContentItem } from '../types/index.js';

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
  request_data: string; // JSON string of original request
  results?: string; // JSON string of results (when completed)
  error_message?: string; // Error details (when failed)
  worker_id?: string; // ID of worker processing the job
  started_at?: ISODateTimeString; // When processing started
  completed_at?: ISODateTimeString; // When processing completed
}

// Response schema with enhanced job management
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
```

### Job Management System

The pipeline now includes a comprehensive job management system that provides:

#### **Persistent Job State Management**
- **D1 Database**: Stores job state, progress, results, and expiry information
- **Job Lifecycle**: queued → processing → completed/failed
- **Progress Tracking**: Step-by-step progress with current/total counters
- **Expiry Management**: Automatic cleanup of expired jobs (24-hour default)

#### **Background Processing**
- **Cloudflare Queues**: Asynchronous job processing off the request path
- **Worker Processing**: Dedicated job processor service handles content generation
- **Error Handling**: Comprehensive error tracking and retry mechanisms
- **Status Updates**: Real-time progress updates during processing

#### **API Endpoints**
- **POST /api/content/generate**: Creates jobs and returns job information
- **GET /api/jobs/{jobId}/status**: Poll job status and retrieve results
- **GET /api/jobs**: List jobs with cursor-based pagination
- **GET /api/jobs/stats**: Get job statistics and system health
- **POST /api/jobs/cleanup**: Manual cleanup of expired jobs

#### **Job Response Schema**
```typescript
{
  job_id: string;           // ULID for unique job identification
  job_status: JobStatus;    // Current job state
  status_url: string;       // Absolute URL for polling status
  expires_at: string;       // ISO8601 timestamp when job expires
  // ... other response fields
}
```

#### **Cursor-Based Pagination**
The system uses cursor-based pagination for efficient cloud storage queries:

```typescript
// Pagination interface
interface PaginationCursor {
  next_cursor?: string; // ULID for next page
  prev_cursor?: string; // ULID for previous page
  has_next: boolean;
  has_prev: boolean;
}

// Job listing response
{
  jobs: JobStatusResponse[];
  pagination: PaginationCursor;
  timestamp: string;
}
```

**Benefits:**
- **Efficient**: No expensive COUNT queries or full table scans
- **Scalable**: Works well with distributed systems and cloud storage
- **Consistent**: Handles concurrent updates gracefully
- **Flexible**: Supports both forward and backward navigation

#### **Status Endpoint Response**
```typescript
{
  job_id: string;
  status: JobStatus;
  status_url: string;
  expires_at: string;
  progress?: JobProgress;   // Current processing step
  results?: any;           // Final results when completed
  error?: ErrorInfo;       // Error details if failed
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}
```

#### **Cleanup and Maintenance**
- **Automatic Cleanup**: Cron job runs every 12 hours to remove expired jobs
- **Statistics**: Track job counts by status for monitoring
- **Discord Notifications**: Alert on significant cleanup events

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
- **Authentication**: HMAC signatures for all endpoints (see Security Specification above)
- **AI Integration**: Workers AI for content scoring and generation
- **GitHub Integration**: Existing webhook and API infrastructure

#### **Performance & Reliability Requirements**
- **Indexing**: KV/D1 indexes for efficient queries; avoid R2 list scans
- **Security**: HMAC signature verification with nonce replay protection and key rotation
- **Replay Protection**: Enforce idempotency keys and key rotation (see Security Specification)
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
