import type { Environment, ContentCategory } from '../types/index.js';
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
import { ManifestBuilderService } from './manifest-builder.js';
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
  private manifestBuilder: ManifestBuilderService;

  constructor(env: Environment) {
    this.env = env;
    this.jobManager = new JobManagerService(env);
    this.contentItemService = new ContentItemService(env);
    this.blogGenerator = new BlogGeneratorService(env);
    this.aiJudge = new AIJudgeService(env);
    this.manifestBuilder = new ManifestBuilderService(env);
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
        total: 4
      });

      // Step 1: Build manifest
      await this.jobManager.updateJobStatus(job_id, 'processing', {
        step: 'building_manifest',
        current: 1,
        total: 4
      });

      // Validate and handle date range
      const startDate = new Date(request_data.date_range.start);
      const endDate = new Date(request_data.date_range.end);
      
      // Normalize dates to UTC for consistent comparison
      const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
      const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
      
      // Check if it's a single day or multi-day range
      const isSingleDay = startUTC.getTime() === endUTC.getTime();
      
      let manifestResult: any;
      let allSelectedItems: any[];
      
      if (isSingleDay) {
        // Single day processing
        const dateString = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        manifestResult = await this.manifestBuilder.buildDailyManifest(
          dateString,
          'UTC' // Default to UTC timezone
        );
        
        allSelectedItems = manifestResult.selectedItems;
        
      } else {
        // Multi-day processing
        const manifestResults: any[] = [];
        allSelectedItems = [];
        
        // Iterate through each day in the range
        const currentDate = new Date(startUTC);
        while (currentDate <= endUTC) {
          const dateString = currentDate.toISOString().split('T')[0];
          
          try {
            const dayManifestResult = await this.manifestBuilder.buildDailyManifest(
              dateString,
              'UTC'
            );
            
            manifestResults.push(dayManifestResult);
            allSelectedItems.push(...dayManifestResult.selectedItems);
            
            console.log(`✅ Built manifest for ${dateString} with ${dayManifestResult.selectedItems.length} items`);
          } catch (error) {
            console.warn(`⚠️ Failed to build manifest for ${dateString}:`, error);
            // Continue with other days even if one fails
          }
          
          // Move to next day
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        
        if (manifestResults.length === 0) {
          throw new Error('No manifests could be built for the specified date range');
        }
        
        // Use the first manifest as the base for the response
        manifestResult = manifestResults[0];
        // Update selectedItems to include all days
        manifestResult.selectedItems = allSelectedItems;
      }

      // Step 2: AI content judgment
      await this.jobManager.updateJobStatus(job_id, 'processing', {
        step: 'ai_content_judgment',
        current: 2,
        total: 4
      });

      const judgeResult = await this.aiJudge.judgeManifest(manifestResult.manifest);

      // Step 3: Generate blog post and prepare response
      await this.jobManager.updateJobStatus(job_id, 'processing', {
        step: 'preparing_response',
        current: 3,
        total: 4
      });

      // Generate blog post from manifest to get front_matter
      const blogResult = await this.blogGenerator.generateBlogPost(manifestResult.manifest);

      // Sanitize tags to ensure they're valid ContentCategory values
      const validCategories: ContentCategory[] = ['development', 'gaming', 'tutorial', 'review', 'other'];
      const sanitizedTags = Array.isArray(blogResult.frontMatter.tags) 
        ? blogResult.frontMatter.tags
            .filter(tag => typeof tag === 'string' && validCategories.includes(tag as ContentCategory))
            .map(tag => tag as ContentCategory)
        : [];

      const response: ContentGenerationResponse = {
        job_id,
        job_status: 'completed',
        status_url: `${this.getWorkerOrigin()}/api/jobs/${job_id}/status`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        content_items: manifestResult.selectedItems,
        date_range: request_data.date_range,
        pagination: {
          has_next: false,
          has_prev: false
        },
        summary: {
          total_clips: manifestResult.selectedItems.length,
          total_prs: manifestResult.selectedItems.reduce((sum: number, item: any) => sum + (item.github_context_url ? 1 : 0), 0),
          total_commits: manifestResult.selectedItems.reduce((sum: number, item: any) => sum + (item.github_context_url ? 1 : 0), 0),
          total_issues: manifestResult.selectedItems.reduce((sum: number, item: any) => sum + (item.github_context_url ? 1 : 0), 0)
        },
        suggested_title: blogResult.frontMatter.title || manifestResult.manifest.title,
        suggested_tags: sanitizedTags,
        content_score: judgeResult.overall || 0
      };

      // Step 4: Complete job
      await this.jobManager.updateJobStatus(job_id, 'processing', {
        step: 'completing',
        current: 4,
        total: 4
      });

      await this.jobManager.updateJobStatus(job_id, 'completed', undefined, response);

      console.log(`✅ Job completed successfully: ${job_id}`);

    } catch (error) {
      console.error(`❌ Job processing failed: ${job_id}`, error);

      // Track error
      await errorTracker.trackError('job_processing_error', 
        `Job ${job_id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

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
