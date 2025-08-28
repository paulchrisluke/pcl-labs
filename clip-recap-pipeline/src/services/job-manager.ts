import type { Environment } from '../types/index.js';
import type { 
  JobState, 
  JobStatus, 
  JobProgress, 
  JobStatusResponse, 
  JobQueueMessage,
  ContentGenerationRequest,
  PaginationCursor
} from '../types/content.js';
import { ulid } from 'ulid';

/**
 * Job Manager Service
 * Handles persistent job state management using D1 database
 */
export class JobManagerService {
  private env: Environment;
  private workerId: string;

  constructor(env: Environment) {
    this.env = env;
    // Generate unique worker ID for this instance
    this.workerId = `worker-${ulid()}`;
  }

  /**
   * Create a new job and store initial state
   */
  async createJob(
    requestData: ContentGenerationRequest,
    expiresInHours: number = 24
  ): Promise<{ jobId: string; statusUrl: string; expiresAt: string }> {
    const jobId = ulid();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    const jobState: JobState = {
      job_id: jobId,
      status: 'queued',
      created_at: now,
      updated_at: now,
      expires_at: expiresAt,
      request_data: JSON.stringify(requestData),
      progress: {
        step: 'initialized',
        current: 0,
        total: 0
      }
    };

    // Insert job into D1
    await this.env.JOB_STORE.prepare(`
      INSERT INTO jobs (
        job_id, status, created_at, updated_at, expires_at, 
        progress_step, progress_current, progress_total, request_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      jobState.job_id,
      jobState.status,
      jobState.created_at,
      jobState.updated_at,
      jobState.expires_at,
      jobState.progress?.step,
      jobState.progress?.current,
      jobState.progress?.total,
      jobState.request_data
    ).run();

    // Generate status URL
    const statusUrl = `${this.getWorkerOrigin()}/api/jobs/${jobId}/status`;

    return {
      jobId,
      statusUrl,
      expiresAt
    };
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse | null> {
    const result = await this.env.JOB_STORE.prepare(`
      SELECT * FROM jobs WHERE job_id = ?
    `).bind(jobId).first<JobState>();

    if (!result) {
      return null;
    }

    // Parse results if present
    let parsedResults: any = undefined;
    if (result.results) {
      try {
        parsedResults = JSON.parse(result.results);
      } catch (error) {
        console.error(`Failed to parse job results for ${jobId}:`, error);
      }
    }

    // Parse request data
    let requestData: ContentGenerationRequest;
    try {
      requestData = JSON.parse(result.request_data);
    } catch (error) {
      console.error(`Failed to parse request data for ${jobId}:`, error);
      throw new Error('Invalid job data');
    }

    const statusUrl = `${this.getWorkerOrigin()}/api/jobs/${jobId}/status`;

    return {
      job_id: result.job_id,
      status: result.status,
      status_url: statusUrl,
      expires_at: result.expires_at,
      progress: result.progress_step ? {
        step: result.progress_step,
        current: result.progress_current || 0,
        total: result.progress_total || 0
      } : undefined,
      results: parsedResults,
      error: result.error_message ? {
        code: 'JOB_ERROR',
        message: result.error_message,
        occurred_at: result.updated_at
      } : undefined,
      created_at: result.created_at,
      updated_at: result.updated_at,
      started_at: result.started_at,
      completed_at: result.completed_at
    };
  }

  /**
   * Update job status and progress
   */
  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    progress?: JobProgress,
    results?: any,
    errorMessage?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const bindValues: any[] = [];

    updates.push('status = ?', 'updated_at = ?');
    bindValues.push(status, now);

    if (progress) {
      updates.push('progress_step = ?', 'progress_current = ?', 'progress_total = ?');
      bindValues.push(progress.step, progress.current, progress.total);
    }

    if (results) {
      updates.push('results = ?');
      bindValues.push(JSON.stringify(results));
    }

    if (errorMessage) {
      updates.push('error_message = ?');
      bindValues.push(errorMessage);
    }

    if (status === 'processing' && !progress?.step?.includes('started')) {
      updates.push('started_at = ?', 'worker_id = ?');
      bindValues.push(now, this.workerId);
    }

    if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = ?');
      bindValues.push(now);
    }

    bindValues.push(jobId);

    await this.env.JOB_STORE.prepare(`
      UPDATE jobs SET ${updates.join(', ')} WHERE job_id = ?
    `).bind(...bindValues).run();
  }

  /**
   * Enqueue job for background processing
   */
  async enqueueJob(jobId: string, requestData: ContentGenerationRequest): Promise<void> {
    const message: JobQueueMessage = {
      job_id: jobId,
      request_data: requestData,
      worker_id: this.workerId
    };

    await this.env.JOB_QUEUE.send(message);
  }

  /**
   * Clean up expired jobs
   */
  async cleanupExpiredJobs(): Promise<{ deleted: number }> {
    const result = await this.env.JOB_STORE.prepare(`
      DELETE FROM jobs WHERE expires_at < datetime('now')
    `).run();

    return { deleted: result.meta.changes || 0 };
  }

  /**
   * List jobs with cursor-based pagination
   */
  async listJobs(options: {
    status?: JobStatus;
    limit?: number;
    cursor?: string;
    order?: 'asc' | 'desc';
  } = {}): Promise<{
    jobs: JobStatusResponse[];
    pagination: PaginationCursor;
  }> {
    const {
      status,
      limit = 50,
      cursor,
      order = 'desc'
    } = options;

    // Build query with cursor-based pagination
    let query = 'SELECT * FROM jobs';
    const conditions: string[] = [];
    const bindValues: any[] = [];

    if (status) {
      conditions.push('status = ?');
      bindValues.push(status);
    }

    if (cursor) {
      const operator = order === 'desc' ? '<' : '>';
      conditions.push(`job_id ${operator} ?`);
      bindValues.push(cursor);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY job_id ${order.toUpperCase()}`;
    query += ` LIMIT ${limit + 1}`; // Fetch one extra to determine if there's a next page

    const results = await this.env.JOB_STORE.prepare(query)
      .bind(...bindValues)
      .all<JobState>();

    const jobs = results.results || [];
    const hasNext = jobs.length > limit;
    
    // Remove the extra item if we fetched more than requested
    if (hasNext) {
      jobs.pop();
    }

    // Convert to JobStatusResponse format
    const jobResponses = await Promise.all(
      jobs.map(async (job) => {
        const statusUrl = `${this.getWorkerOrigin()}/api/jobs/${job.job_id}/status`;
        
        // Parse results if present
        let parsedResults: any = undefined;
        if (job.results) {
          try {
            parsedResults = JSON.parse(job.results);
          } catch (error) {
            console.error(`Failed to parse job results for ${job.job_id}:`, error);
          }
        }

        return {
          job_id: job.job_id,
          status: job.status,
          status_url: statusUrl,
          expires_at: job.expires_at,
          progress: job.progress_step ? {
            step: job.progress_step,
            current: job.progress_current || 0,
            total: job.progress_total || 0
          } : undefined,
          results: parsedResults,
          error: job.error_message ? {
            code: 'JOB_ERROR',
            message: job.error_message,
            occurred_at: job.updated_at
          } : undefined,
          created_at: job.created_at,
          updated_at: job.updated_at,
          started_at: job.started_at,
          completed_at: job.completed_at
        };
      })
    );

    // Build pagination cursors
    const pagination: PaginationCursor = {
      has_next: hasNext,
      has_prev: !!cursor
    };

    if (jobs.length > 0) {
      if (hasNext) {
        pagination.next_cursor = jobs[jobs.length - 1].job_id;
      }
      if (cursor) {
        pagination.prev_cursor = jobs[0].job_id;
      }
    }

    return {
      jobs: jobResponses,
      pagination
    };
  }

  /**
   * Get job statistics (simplified - no expensive counts)
   */
  async getJobStats(): Promise<{
    recent_jobs: number; // Jobs created in last 24 hours
    active_jobs: number; // Jobs that are queued or processing
    recent_completed: number; // Jobs completed in last 24 hours
    recent_failed: number; // Jobs failed in last 24 hours
  }> {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [recentJobs, activeJobs, recentCompleted, recentFailed] = await Promise.all([
      // Recent jobs (last 24 hours)
      this.env.JOB_STORE.prepare(`
        SELECT COUNT(*) as count FROM jobs 
        WHERE created_at > ?
      `).bind(yesterday).first<{ count: number }>(),

      // Active jobs (queued or processing)
      this.env.JOB_STORE.prepare(`
        SELECT COUNT(*) as count FROM jobs 
        WHERE status IN ('queued', 'processing')
      `).first<{ count: number }>(),

      // Recently completed jobs
      this.env.JOB_STORE.prepare(`
        SELECT COUNT(*) as count FROM jobs 
        WHERE status = 'completed' AND completed_at > ?
      `).bind(yesterday).first<{ count: number }>(),

      // Recently failed jobs
      this.env.JOB_STORE.prepare(`
        SELECT COUNT(*) as count FROM jobs 
        WHERE status = 'failed' AND completed_at > ?
      `).bind(yesterday).first<{ count: number }>()
    ]);

    return {
      recent_jobs: recentJobs?.count || 0,
      active_jobs: activeJobs?.count || 0,
      recent_completed: recentCompleted?.count || 0,
      recent_failed: recentFailed?.count || 0
    };
  }

  /**
   * Get worker origin for status URLs
   */
  private getWorkerOrigin(): string {
    return this.env.WORKER_ORIGIN || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';
  }
}
