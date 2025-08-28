import type { Environment, ContentCategory } from '../types/index.js';
import type { ContentGenerationRequest, ContentGenerationResponse, RunStatus } from '../types/content.js';
import { ContentItemService } from '../services/content-items.js';
import { ContentMigrationService } from '../services/content-migration.js';
import { ManifestBuilderService } from '../services/manifest-builder.js';
import { BlogGeneratorService } from '../services/blog-generator.js';
import { AIJudgeService } from '../services/ai-judge.js';
import { requireHmacAuth } from '../utils/auth.js';
import { errorTracker } from '../utils/error-tracking.js';
import { ulid } from 'ulid';

/**
 * Generate ULID for run tracking
 * Uses the 'ulid' library which implements the ULID spec correctly:
 * - 48-bit timestamp (10 chars) + 80-bit randomness (16 chars)
 * - Crockford base32 encoding for lexicographic ordering
 * - Cryptographically strong entropy
 */
function generateULID(): string {
  return ulid();
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

  // Initialize services
  const contentItemService = new ContentItemService(env);
  const migrationService = new ContentMigrationService(env);
  const manifestBuilder = new ManifestBuilderService(env);
  const blogGenerator = new BlogGeneratorService(env);
  const aiJudge = new AIJudgeService(env);

  try {
    // Content generation endpoint
    if (path === '/api/content/generate' && method === 'POST') {
      return await handleContentGeneration(request, env, contentItemService);
    }

    // Content items listing endpoint
    if (path === '/api/content/items' && method === 'GET') {
      return await handleListContentItems(request, env, contentItemService);
    }

    // Content item detail endpoint
    if (path.startsWith('/api/content/items/') && method === 'GET') {
      const clipId = path.split('/').pop();
      if (clipId) {
        return await handleGetContentItem(request, env, contentItemService, clipId);
      }
    }

    // Migration endpoints
    if (path === '/api/content/migrate' && method === 'POST') {
      return await handleMigration(request, env, migrationService);
    }

    if (path === '/api/content/migration-status' && method === 'GET') {
      return await handleMigrationStatus(request, env, migrationService);
    }

    // Run status endpoint
    if (path.startsWith('/api/runs/') && method === 'GET') {
      const runId = path.split('/').pop();
      if (runId) {
        return await handleGetRunStatus(request, env, runId);
      }
    }

    // Content processing status endpoint
    if (path === '/api/content/status' && method === 'GET') {
      return await handleContentStatus(request, env, contentItemService);
    }

    // Manifest builder endpoints
    if (path === '/api/content/manifest' && method === 'POST') {
      return await handleBuildManifest(request, env, manifestBuilder);
    }

    // Blog generation endpoints
    if (path === '/api/content/blog' && method === 'POST') {
      return await handleGenerateBlog(request, env, blogGenerator);
    }

    // AI judge endpoints
    if (path === '/api/content/judge' && method === 'POST') {
      return await handleJudgeContent(request, env, aiJudge);
    }

    // Error statistics endpoint
    if (path === '/api/content/error-stats' && method === 'GET') {
      return await handleErrorStats(request, env);
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
  env: Environment,
  contentItemService: ContentItemService
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const body = await request.text();
    const requestData: ContentGenerationRequest = JSON.parse(body);

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

    // Generate run ID for tracking
    const runId = generateULID();

    // For now, return immediate response with run ID
    // In the future, this would kick off a Workflow job
    const response: ContentGenerationResponse = {
      run_id: runId,
      status: 'queued',
      content_items: [],
      summary: {
        total_clips: 0,
        total_prs: 0,
        total_commits: 0,
        total_issues: 0,
        date_range: `${requestData.date_range.start} to ${requestData.date_range.end}`
      },
      suggested_title: '',
      suggested_tags: [],
      content_score: 0
    };

    // Store run status in R2 for tracking
    const runStatus: RunStatus = {
      run_id: runId,
      status: 'queued',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      progress: {
        step: 'initialized',
        current: 0,
        total: 0
      }
    };

    await env.R2_BUCKET.put(`runs/${runId}.json`, JSON.stringify(runStatus));

    console.log(`🚀 Content generation queued: ${runId}`);

    return new Response(JSON.stringify({
      success: true,
      data: response
    }), {
      status: 202, // Accepted
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Content generation error:', error);
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
  env: Environment,
  contentItemService: ContentItemService
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
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
    const validProcessingStatuses = ['pending', 'audio_ready', 'transcribed', 'enhanced', 'ready_for_content'] as const;
    if (processingStatus && !validProcessingStatuses.includes(processingStatus as any)) {
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
    const validContentCategories: ContentCategory[] = ['development', 'gaming', 'tutorial', 'review', 'other'];
    if (contentCategory && !validContentCategories.includes(contentCategory as any)) {
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
      processing_status: processingStatus as typeof validProcessingStatuses[number] | undefined,
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
  contentItemService: ContentItemService,
  clipId: string
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
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
  env: Environment,
  migrationService: ContentMigrationService
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const body = await request.text();
    let requestData: any = {};
    
    if (body.trim()) {
      try {
        requestData = JSON.parse(body);
      } catch (parseError) {
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
  env: Environment,
  migrationService: ContentMigrationService
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
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
 * Handle getting run status
 */
async function handleGetRunStatus(
  request: Request,
  env: Environment,
  runId: string
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

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

    const runStatus: RunStatus = await object.json();

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
  env: Environment,
  contentItemService: ContentItemService
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
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
  env: Environment,
  manifestBuilder: ManifestBuilderService
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const body = await request.text();
    let requestData: any;
    
    if (body.trim()) {
      try {
        requestData = JSON.parse(body);
      } catch (parseError) {
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

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Manifest building error:', error);
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
  env: Environment,
  blogGenerator: BlogGeneratorService
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const body = await request.text();
    let requestData: any;
    
    if (body.trim()) {
      try {
        requestData = JSON.parse(body);
      } catch (parseError) {
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
 * Handle content judging request
 */
async function handleJudgeContent(
  request: Request,
  env: Environment,
  aiJudge: AIJudgeService
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const body = await request.text();
    let requestData: any;
    
    if (body.trim()) {
      try {
        requestData = JSON.parse(body);
      } catch (parseError) {
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
async function handleErrorStats(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

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
