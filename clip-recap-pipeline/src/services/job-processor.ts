import type { Environment } from '../types/index.js';
import type { 
  JobQueueMessage, 
  ContentGenerationRequest, 
  ContentGenerationResponse,
  JobProgress 
} from '../types/content.js';
import { JobManagerService } from './job-manager.js';
import { ContentItemService } from './content-items.js';
import { BlogGeneratorService } from './blog-generator.js';
import { AIJudgeService } from './ai-judge.js';
import { errorTracker } from '../utils/error-tracking.js';

/**
 * Background Job Processor Service
 * Handles the actual content generation work in the background
 */
export class JobProcessorService {
  private env: Environment;
  private jobManager: JobManagerService;
  private contentItemService: ContentItemService;
  private blogGenerator: BlogGeneratorService;
  private aiJudge: AIJudgeService;

  constructor(env: Environment) {
    this.env = env;
    this.jobManager = new JobManagerService(env);
    this.contentItemService = new ContentItemService(env);
    this.blogGenerator = new BlogGeneratorService(env);
    this.aiJudge = new AIJudgeService(env);
  }

  /**
   * Process a job from the queue
   */
  async processJob(message: JobQueueMessage): Promise<void> {
    const { job_id, request_data } = message;

    try {
      console.log(`🚀 Starting job processing: ${job_id}`);

      // Update status to processing
      await this.jobManager.updateJobStatus(job_id, 'processing', {
        step: 'starting',
        current: 0,
        total: 5
      });

      // Step 1: Fetch content items
      await this.jobManager.updateJobStatus(job_id, 'processing', {
        step: 'fetching_content_items',
        current: 1,
        total: 5
      });

      const contentItems = await this.contentItemService.queryContentItems({
        dateRange: request_data.date_range,
        filters: request_data.filters,
        limit: 1000
      });

      console.log(`📊 Found ${contentItems.length} content items for job ${job_id}`);

      // Step 2: Generate blog content
      await this.jobManager.updateJobStatus(job_id, 'processing', {
        step: 'generating_blog_content',
        current: 2,
        total: 5
      });

      const blogContent = await this.blogGenerator.generateBlogPost(
        contentItems,
        request_data.content_type,
        request_data.repository
      );

      // Step 3: AI content judgment
      await this.jobManager.updateJobStatus(job_id, 'processing', {
        step: 'ai_content_judgment',
        current: 3,
        total: 5
      });

      const judgeResult = await this.aiJudge.evaluateContent(blogContent);

      // Step 4: Prepare response
      await this.jobManager.updateJobStatus(job_id, 'processing', {
        step: 'preparing_response',
        current: 4,
        total: 5
      });

      const response: ContentGenerationResponse = {
        job_id,
        job_status: 'completed',
        status_url: `${this.getWorkerOrigin()}/api/jobs/${job_id}/status`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        content_items: contentItems,
        date_range: request_data.date_range,
        pagination: {
          total_items: contentItems.length,
          total_pages: 1,
          current_page: 1,
          per_page: contentItems.length,
          has_next: false,
          has_prev: false
        },
        summary: {
          total_clips: contentItems.length,
          total_prs: contentItems.reduce((sum, item) => sum + (item.github_context?.linked_prs?.length || 0), 0),
          total_commits: contentItems.reduce((sum, item) => sum + (item.github_context?.linked_commits?.length || 0), 0),
          total_issues: contentItems.reduce((sum, item) => sum + (item.github_context?.linked_issues?.length || 0), 0)
        },
        suggested_title: blogContent.title,
        suggested_tags: blogContent.tags as any[],
        content_score: judgeResult.overall || 0
      };

      // Step 5: Complete job
      await this.jobManager.updateJobStatus(job_id, 'processing', {
        step: 'completing',
        current: 5,
        total: 5
      });

      await this.jobManager.updateJobStatus(job_id, 'completed', undefined, response);

      console.log(`✅ Job completed successfully: ${job_id}`);

    } catch (error) {
      console.error(`❌ Job processing failed: ${job_id}`, error);

      // Track error
      await errorTracker.trackError('job_processing_error', {
        job_id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Update job status to failed
      await this.jobManager.updateJobStatus(
        job_id, 
        'failed', 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Process multiple jobs (for batch processing)
   */
  async processJobs(messages: JobQueueMessage[]): Promise<void> {
    console.log(`🔄 Processing ${messages.length} jobs in batch`);

    // Process jobs concurrently with a reasonable limit
    const batchSize = 5;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(message => this.processJob(message))
      );
    }

    console.log(`✅ Batch processing completed for ${messages.length} jobs`);
  }

  /**
   * Get worker origin for status URLs
   */
  private getWorkerOrigin(): string {
    return this.env.WORKER_ORIGIN || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';
  }
}
