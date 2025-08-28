import type { Environment } from '../types/index.js';
import type { JobStatusResponse } from '../types/content.js';
import { JobManagerService } from '../services/job-manager.js';
import { requireHmacAuth } from '../utils/auth.js';

/**
 * Job management routes
 */
export async function handleJobRoutes(
  request: Request,
  env: Environment,
  url: URL
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  try {
    // Job status endpoint: GET /api/jobs/{jobId}/status
    const statusMatch = path.match(/^\/api\/jobs\/([^\/]+)\/status$/);
    if (statusMatch && method === 'GET') {
      return await handleJobStatus(request, env, statusMatch[1]);
    }

    // Job listing endpoint: GET /api/jobs
    if (path === '/api/jobs' && method === 'GET') {
      return await handleListJobs(request, env);
    }

    // Job statistics endpoint: GET /api/jobs/stats
    if (path === '/api/jobs/stats' && method === 'GET') {
      return await handleJobStats(request, env);
    }

    // Job cleanup endpoint: POST /api/jobs/cleanup
    if (path === '/api/jobs/cleanup' && method === 'POST') {
      return await handleJobCleanup(request, env);
    }

    // 404 for unknown job routes
    return new Response(JSON.stringify({
      success: false,
      error: 'Job route not found'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Job route error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle job status requests
 */
async function handleJobStatus(
  request: Request,
  env: Environment,
  jobId: string
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const jobManager = new JobManagerService(env);
    const jobStatus = await jobManager.getJobStatus(jobId);

    if (!jobStatus) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: jobStatus
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error(`❌ Error getting job status for ${jobId}:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get job status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle job listing requests with cursor-based pagination
 */
async function handleListJobs(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const url = new URL(request.url);
    const jobManager = new JobManagerService(env);

    // Parse query parameters
    const status = url.searchParams.get('status') as any;
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const cursor = url.searchParams.get('cursor') || undefined;
    const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';

    // Validate parameters
    if (limit < 1 || limit > 100) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Limit must be between 1 and 100'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (order !== 'asc' && order !== 'desc') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Order must be "asc" or "desc"'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await jobManager.listJobs({
      status,
      limit,
      cursor,
      order
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        jobs: result.jobs,
        pagination: result.pagination,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('❌ Error listing jobs:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to list jobs'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle job statistics requests
 */
async function handleJobStats(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const jobManager = new JobManagerService(env);
    const stats = await jobManager.getJobStats();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...stats,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // Cache for 1 minute
      }
    });

  } catch (error) {
    console.error('❌ Error getting job stats:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get job statistics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle job cleanup requests
 */
async function handleJobCleanup(
  request: Request,
  env: Environment
): Promise<Response> {
  // Check authentication
  const authResponse = await requireHmacAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  try {
    const jobManager = new JobManagerService(env);
    const result = await jobManager.cleanupExpiredJobs();

    console.log(`🧹 Cleaned up ${result.deleted} expired jobs`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        deleted_jobs: result.deleted,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error cleaning up jobs:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to clean up expired jobs'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
