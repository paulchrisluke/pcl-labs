import type { Environment, ContentCategory } from '../types/index.js';
import type { ContentGenerationRequest, ContentGenerationResponse, RunStatus } from '../types/content.js';

// Processing status type definition
type ProcessingStatus = 'pending' | 'audio_ready' | 'transcribed' | 'enhanced' | 'ready_for_content';

// Type guard functions for validation
const isProcessingStatus = (s: string): s is ProcessingStatus => {
  return s === 'pending' || s === 'audio_ready' || s === 'transcribed' || s === 'enhanced' || s === 'ready_for_content';
};

const isContentCategory = (s: string): s is ContentCategory => {
  return s === 'development' || s === 'gaming' || s === 'tutorial' || s === 'review' || s === 'other';
};

/**
 * Securely extract and validate a path segment from a URL
 * @param url - The URL object
 * @param expectedPath - The expected path prefix (e.g., '/api/content/items/')
 * @param segmentIndex - The index of the segment to extract (0-based)
 * @param validationRegex - Regex pattern to validate the segment
 * @returns The validated segment or null if validation fails
 */
function extractAndValidatePathSegment(
  url: URL,
  expectedPath: string,
  segmentIndex: number,
  validationRegex: RegExp
): string | null {
  const pathname = url.pathname;
  
  // Check if path starts with expected prefix
  if (!pathname.startsWith(expectedPath)) {
    return null;
  }
  
  // Split the path into segments
  const segments = pathname.split('/').filter(segment => segment.length > 0);
  
  // Find the index of the segment after the expected path
  const expectedSegments = expectedPath.split('/').filter(segment => segment.length > 0);
  const targetIndex = expectedSegments.length + segmentIndex;
  
  if (targetIndex >= segments.length) {
    return null;
  }
  
  const rawSegment = segments[targetIndex];
  
  try {
    // Decode the URL component
    const decodedSegment = decodeURIComponent(rawSegment);
    
    // Check for path traversal attempts
    if (decodedSegment.includes('..') || decodedSegment.includes('/') || decodedSegment.includes('\\')) {
      return null;
    }
    
    // Validate against the provided regex
    if (!validationRegex.test(decodedSegment)) {
      return null;
    }
    
    return decodedSegment;
  } catch {
    // decodeURIComponent throws on invalid percent encoding
    return null;
  }
}
import { ContentItemService } from '../services/content-items.js';
import { ContentMigrationService } from '../services/content-migration.js';
import { ManifestBuilderService } from '../services/manifest-builder.js';
import { BlogGeneratorService } from '../services/blog-generator.js';
import { AIJudgeService } from '../services/ai-judge.js';
import { JobManagerService } from '../services/job-manager.js';
import { requireHmacAuth } from '../utils/auth.js';
import { errorTracker } from '../utils/error-tracking.js';



// Lazy service factory functions with memoization
let contentItemServiceInstance: ContentItemService | null = null;
let migrationServiceInstance: ContentMigrationService | null = null;
let manifestBuilderInstance: ManifestBuilderService | null = null;
let blogGeneratorInstance: BlogGeneratorService | null = null;
let aiJudgeInstance: AIJudgeService | null = null;
let jobManagerInstance: JobManagerService | null = null;

function getContentItemService(env: Environment): ContentItemService {
  if (!contentItemServiceInstance) {
    contentItemServiceInstance = new ContentItemService(env);
  }
  return contentItemServiceInstance;
}

function getMigrationService(env: Environment): ContentMigrationService {
  if (!migrationServiceInstance) {
    migrationServiceInstance = new ContentMigrationService(env);
  }
  return migrationServiceInstance;
}

function getManifestBuilder(env: Environment): ManifestBuilderService {
  if (!manifestBuilderInstance) {
    manifestBuilderInstance = new ManifestBuilderService(env);
  }
  return manifestBuilderInstance;
}

function getBlogGenerator(env: Environment): BlogGeneratorService {
  if (!blogGeneratorInstance) {
    blogGeneratorInstance = new BlogGeneratorService(env);
  }
  return blogGeneratorInstance;
}

function getAIJudge(env: Environment): AIJudgeService {
  if (!aiJudgeInstance) {
    aiJudgeInstance = new AIJudgeService(env);
  }
  return aiJudgeInstance;
}

function getJobManager(env: Environment): JobManagerService {
  if (!jobManagerInstance) {
    jobManagerInstance = new JobManagerService(env);
  }
  return jobManagerInstance;
}

/**
 * Content generation API routes
 */
export async function handleContentRoutes(
  request: Request,
  env: Environment,
  url: URL
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  try {
    // Content generation endpoint
    if (path === '/api/content/generate' && method === 'POST') {
      return await handleContentGeneration(request, env);
    }

    // Content items listing endpoint
    if (path === '/api/content/items' && method === 'GET') {
      return await handleListContentItems(request, env);
    }

    // Content item detail endpoint
    if (path.startsWith('/api/content/items/') && method === 'GET') {
      const clipId = extractAndValidatePathSegment(url, '/api/content/items/', 0, /^[A-Za-z0-9_-]+$/);
      if (clipId) {
        return await handleGetContentItem(request, env, clipId);
      }
      return new Response('Invalid clip ID', { status: 400 });
    }

    // Migration endpoints
    if (path === '/api/content/migrate' && method === 'POST') {
      return await handleMigration(request, env);
    }

    if (path === '/api/content/migration-status' && method === 'GET') {
      return await handleMigrationStatus(request, env);
    }

    if (path === '/api/content/migration-failures' && method === 'GET') {
      return await handleMigrationFailures(request, env);
    }

    if (path === '/api/content/migration-session/start' && method === 'POST') {
      return await handleStartMigrationSession(request, env);
    }

    // Run status endpoint
    if (path.startsWith('/api/runs/') && method === 'GET') {
      const runId = extractAndValidatePathSegment(url, '/api/runs/', 0, /^[A-Za-z0-9_-]+$/);
      if (runId) {
        return await handleGetRunStatus(request, env, runId);
      }
      return new Response('Invalid run ID', { status: 400 });
    }

    // Content processing status endpoint
    if (path === '/api/content/status' && method === 'GET') {
      return await handleContentStatus(request, env);
    }

    // Manifest builder endpoints
    if (path === '/api/content/manifest' && method === 'POST') {
      return await handleBuildManifest(request, env);
    }

    // Blog generation endpoints
    if (path === '/api/content/blog' && method === 'POST') {
      return await handleGenerateBlog(request, env);
    }

    // Blog listing endpoint
    if (path === '/api/content/blog' && method === 'GET') {
      return await handleListBlogPosts(request, env);
    }

    // AI judge endpoints
    if (path === '/api/content/judge' && method === 'POST') {
      return await handleJudgeContent(request, env);
    }

    // Error statistics endpoint
    if (path === '/api/content/error-stats' && method === 'GET') {
      return await handleErrorStats();
    }

    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('❌ Content API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle content generation request
 */
async function handleContentGeneration(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const body = await request.text();
    let requestData: ContentGenerationRequest;
    
    try {
      requestData = JSON.parse(body);
    } catch (parseError) {
      console.error('❌ JSON parse error in content generation request:', parseError);
      console.error('Raw request body:', body);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate request
    if (!requestData.date_range || !requestData.date_range.start || !requestData.date_range.end) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required date_range'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate date_range format and ordering
    const startDate = new Date(requestData.date_range.start);
    const endDate = new Date(requestData.date_range.end);
    
    // Check if dates are valid ISO dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or unordered date_range: must be ISO dates with start <= end',
        details: {
          start: requestData.date_range.start,
          end: requestData.date_range.end,
          startValid: !isNaN(startDate.getTime()),
          endValid: !isNaN(endDate.getTime())
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if start date is before or equal to end date
    if (startDate > endDate) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or unordered date_range: must be ISO dates with start <= end',
        details: {
          start: requestData.date_range.start,
          end: requestData.date_range.end,
          startTimestamp: startDate.getTime(),
          endTimestamp: endDate.getTime()
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create job using job manager
    const jobManager = getJobManager(env);
    const { jobId, statusUrl, expiresAt } = await jobManager.createJob(requestData, 24); // 24 hour expiry

    // Try to enqueue job for background processing
    try {
      await jobManager.enqueueJob(jobId, requestData);
    } catch (queueError) {
      console.warn(`⚠️ Failed to enqueue job ${jobId} for background processing:`, queueError);
      console.log('💡 This is expected in local development where queues may not be available');
      // Continue with job creation even if enqueueing fails
    }

    // Prepare response with job information
    const response: ContentGenerationResponse = {
      job_id: jobId,
      job_status: 'queued',
      status_url: statusUrl,
      expires_at: expiresAt,
      date_range: requestData.date_range,
      pagination: {
        has_next: false,
        has_prev: false
      },
      summary: {
        total_clips: 0,
        total_prs: 0,
        total_commits: 0,
        total_issues: 0
      }
    };

    console.log(`🚀 Content generation job created: ${jobId}`);

    return new Response(JSON.stringify({
      success: true,
      data: response
    }), {
      status: 202, // Accepted
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Content generation error:', error);
    
    // Track error
    await errorTracker.trackError('content_generation_error', 
      error instanceof Error ? error.message : 'Unknown error'
    );

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process content generation request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle listing content items
 */
async function handleListContentItems(
  request: Request,
  env: Environment
): Promise<Response> {
  // Public endpoint - no authentication required

  try {
    const contentItemService = getContentItemService(env);
    const url = new URL(request.url);
    
    // Validate and parse limit parameter
    const limitParam = url.searchParams.get('limit') || '50';
    const limit = parseInt(limitParam);
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid limit parameter. Must be a number between 1 and 1000.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate and parse cursor parameter
    const cursor = url.searchParams.get('cursor') || undefined;
    
    // Validate processing_status parameter
    const processingStatus = url.searchParams.get('processing_status');
    if (processingStatus && !isProcessingStatus(processingStatus)) {
      const validProcessingStatuses: readonly ProcessingStatus[] = ['pending', 'audio_ready', 'transcribed', 'enhanced', 'ready_for_content'];
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid processing_status. Must be one of: ${validProcessingStatuses.join(', ')}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate content_category parameter
    const contentCategory = url.searchParams.get('content_category');
    if (contentCategory && !isContentCategory(contentCategory)) {
      const validContentCategories: readonly ContentCategory[] = ['development', 'gaming', 'tutorial', 'review', 'other'];
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid content_category. Must be one of: ${validContentCategories.join(', ')}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response = await contentItemService.listContentItems({
      limit,
      cursor,
      processing_status: processingStatus as ProcessingStatus | undefined,
      content_category: contentCategory as ContentCategory | undefined,
    });

    return new Response(JSON.stringify({
      success: true,
      data: response
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ List content items error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to list content items'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle getting a specific content item
 */
async function handleGetContentItem(
  request: Request,
  env: Environment,
  clipId: string
): Promise<Response> {
  // Public endpoint - no authentication required

  try {
    const contentItemService = getContentItemService(env);
    // For now, we need to know the creation date to get the item
    // In the future, we could add a lookup index
    const url = new URL(request.url);
    const createdAt = url.searchParams.get('created_at');
    
    if (!createdAt) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required created_at parameter'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const contentItem = await contentItemService.getContentItem(clipId, createdAt);

    if (!contentItem) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Content item not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: contentItem
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Get content item error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get content item'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle migration request
 */
async function handleMigration(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const migrationService = getMigrationService(env);
    const body = await request.text();
    let requestData: any = {};
    
    if (body.trim()) {
      try {
        requestData = JSON.parse(body);
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    let result;
    if (requestData.clip_id) {
      // Migrate specific clip
      try {
        result = await migrationService.migrateClipById(requestData.clip_id);
        return new Response(JSON.stringify({
          success: true,
          data: { migrated: 1, failed: 0 }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
          success: false,
          error: `Migration failed: ${errorMessage}`,
          data: { migrated: 0, failed: 1 }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Migrate all clips
      result = await migrationService.migrateExistingClips();
      return new Response(JSON.stringify({
        success: result.success,
        data: result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process migration request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle migration status request
 */
async function handleMigrationStatus(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const migrationService = getMigrationService(env);
    const status = await migrationService.getMigrationStatus();

    return new Response(JSON.stringify({
      success: true,
      data: status
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Migration status error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get migration status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle getting migration failures
 */
async function handleMigrationFailures(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const migrationService = getMigrationService(env);
    const failures = await migrationService.getMigrationFailures();

    return new Response(JSON.stringify({
      success: true,
      data: {
        failures,
        count: failures.length
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Migration failures error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get migration failures'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle starting a new migration session
 */
async function handleStartMigrationSession(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const migrationService = getMigrationService(env);
    const sessionId = await migrationService.startNewMigrationSession();

    return new Response(JSON.stringify({
      success: true,
      data: {
        sessionId,
        message: 'New migration session started. Previous failure tracking has been cleared.'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Start migration session error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to start new migration session'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle getting run status
 */
async function handleGetRunStatus(
  request: Request,
  env: Environment,
  runId: string
): Promise<Response> {
  // Public endpoint - no authentication required

  try {
    const object = await env.R2_BUCKET.get(`runs/${runId}.json`);
    
    if (!object) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Run not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const text = await object.text();
    const runStatus: RunStatus = JSON.parse(text);

    return new Response(JSON.stringify({
      success: true,
      data: runStatus
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Get run status error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get run status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle content processing status
 */
async function handleContentStatus(
  request: Request,
  env: Environment
): Promise<Response> {
  // Public endpoint - no authentication required

  try {
    const contentItemService = getContentItemService(env);
    const statusCounts = await contentItemService.getProcessingStatusCounts();

    return new Response(JSON.stringify({
      success: true,
      data: {
        processing_status: statusCounts,
        total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        ready_for_content: statusCounts.ready_for_content
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Content status error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get content status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle manifest building request
 */
async function handleBuildManifest(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const manifestBuilder = getManifestBuilder(env);
    const body = await request.text();
    let requestData: any;
    
    if (body.trim()) {
      try {
        requestData = JSON.parse(body);
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Request body is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate request
    if (!requestData.date) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required date parameter'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build manifest
    const result = await manifestBuilder.buildDailyManifest(
      requestData.date,
      requestData.timezone || 'UTC'
    );

    // Generate AI draft if requested
    if (requestData.generate_ai_draft === true) {
      console.log('🤖 Generating AI draft for manifest...');
      const manifestWithDraft = await manifestBuilder.generateAIDraft(result.manifest);
      result.manifest = manifestWithDraft;
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Manifest building error:', error);
    
    // Handle the case where no ContentItems are found
    if (error instanceof Error && error.message.includes('No ContentItems found')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No content items found for the specified date',
        details: 'The system has no content items to build a manifest from. This is normal in a development environment with no data.'
      }), {
        status: 404, // Not Found - more appropriate than 500
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to build manifest'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle blog generation request
 */
async function handleGenerateBlog(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const blogGenerator = getBlogGenerator(env);
    const body = await request.text();
    let requestData: any;
    
    if (body.trim()) {
      try {
        requestData = JSON.parse(body);
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Request body is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate request
    if (!requestData.manifest) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required manifest parameter'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate blog post
    const result = await blogGenerator.generateBlogPost(requestData.manifest);

    // Store blog post if requested
    if (requestData.store) {
      await blogGenerator.storeBlogPost(requestData.manifest, result.markdown);
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Blog generation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to generate blog post'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle blog posts listing request
 */
async function handleListBlogPosts(
  request: Request,
  env: Environment
): Promise<Response> {
  // Public endpoint - no authentication required

  try {
    const blogGenerator = getBlogGenerator(env);
    const url = new URL(request.url);
    const postId = url.searchParams.get('post_id');

    if (postId) {
      // Get specific blog post
      const blogContent = await blogGenerator.getBlogPost(postId);
      
      if (!blogContent) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Blog post not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          post_id: postId,
          content: blogContent,
          word_count: blogContent.split(/\s+/).filter(word => word.length > 0).length,
          estimated_read_time: Math.ceil(blogContent.split(/\s+/).filter(word => word.length > 0).length / 200)
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // List all blog posts
      const blogPosts = await blogGenerator.listBlogPosts();
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          blog_posts: blogPosts,
          total_count: blogPosts.length
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Blog listing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to list blog posts'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle content judging request
 */
async function handleJudgeContent(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const aiJudge = getAIJudge(env);
    const body = await request.text();
    let requestData: any;
    
    if (body.trim()) {
      try {
        requestData = JSON.parse(body);
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Request body is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate request
    if (!requestData.manifest) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required manifest parameter'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Judge content
    const evaluation = await aiJudge.judgeManifest(requestData.manifest);
    const qualityCheck = await aiJudge.meetsQualityThreshold(requestData.manifest);
    const suggestions = await aiJudge.generateImprovementSuggestions(requestData.manifest);

    return new Response(JSON.stringify({
      success: true,
      data: {
        evaluation,
        qualityCheck,
        suggestions,
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Content judging error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to judge content'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle error statistics request
 */
async function handleErrorStats(): Promise<Response> {
  // Public endpoint - no authentication required

  try {
    const stats = errorTracker.getErrorStats();

    return new Response(JSON.stringify({
      success: true,
      data: stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error stats error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get error statistics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
