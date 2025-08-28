import type { Environment } from '../types/index.js';
import type { ContentGenerationRequest, ContentGenerationResponse, RunStatus } from '../types/content.js';
import { ContentItemService } from '../services/content-items.js';
import { ContentMigrationService } from '../services/content-migration.js';
import { requireHmacAuth } from '../utils/auth.js';

/**
 * Generate ULID for run tracking
 */
function generateULID(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp.toString(36)}${random}`;
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
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const processingStatus = url.searchParams.get('processing_status') as any;
    const contentCategory = url.searchParams.get('content_category') as any;

    const response = await contentItemService.listContentItems({
      limit,
      offset,
      processing_status: processingStatus,
      content_category: contentCategory,
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
    const requestData = body ? JSON.parse(body) : {};

    let result;
    if (requestData.clip_id) {
      // Migrate specific clip
      result = await migrationService.migrateClipById(requestData.clip_id);
      return new Response(JSON.stringify({
        success: result,
        data: { migrated: result ? 1 : 0, failed: result ? 0 : 1 }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
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
