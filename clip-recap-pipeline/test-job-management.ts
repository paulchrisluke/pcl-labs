#!/usr/bin/env node

/**
 * Test script for job management system
 * This script tests the new job management endpoints and functionality
 */

import { JobManagerService } from './src/services/job-manager.js';
import { JobProcessorService } from './src/services/job-processor.js';
import type { ContentGenerationRequest } from './src/types/content.js';

// Mock environment for testing
const mockEnv = {
  JOB_STORE: {
    prepare: (query: string) => ({
      bind: (...args: any[]) => ({
        run: async () => ({ meta: { changes: 1 } }),
        first: async () => {
          // Return a realistic JobState for getJobStatus tests
          if (query.includes('WHERE job_id = ?')) {
            return {
              job_id: '01HXYZ1234567890ABCDEF',
              status: 'processing',
              created_at: '2024-01-01T10:00:00.000Z',
              updated_at: '2024-01-01T10:15:00.000Z',
              expires_at: '2024-01-02T10:00:00.000Z',
              progress_step: 'fetching_content_items',
              progress_current: 2,
              progress_total: 5,
              request_data: JSON.stringify({
                date_range: {
                  start: '2024-01-01T00:00:00Z',
                  end: '2024-01-02T00:00:00Z'
                },
                content_type: 'daily_recap'
              }),
              results: null,
              error_message: null,
              worker_id: 'worker-01HXYZ1234567890ABCDEF',
              started_at: '2024-01-01T10:05:00.000Z',
              completed_at: null
            };
          }
          // Return count for statistics queries
          if (query.includes('COUNT(*)')) {
            return { count: 5 };
          }
          return null;
        },
        all: async () => {
          // Return realistic JobState array for listJobs tests
          if (query.includes('SELECT * FROM jobs')) {
            return {
              results: [
                {
                  job_id: '01HXYZ1234567890ABCDEF',
                  status: 'processing',
                  created_at: '2024-01-01T10:00:00.000Z',
                  updated_at: '2024-01-01T10:15:00.000Z',
                  expires_at: '2024-01-02T10:00:00.000Z',
                  progress_step: 'fetching_content_items',
                  progress_current: 2,
                  progress_total: 5,
                  request_data: JSON.stringify({
                    date_range: {
                      start: '2024-01-01T00:00:00Z',
                      end: '2024-01-02T00:00:00Z'
                    },
                    content_type: 'daily_recap'
                  }),
                  results: null,
                  error_message: null,
                  worker_id: 'worker-01HXYZ1234567890ABCDEF',
                  started_at: '2024-01-01T10:05:00.000Z',
                  completed_at: null
                },
                {
                  job_id: '01HXYZ1234567890ABCDEG',
                  status: 'completed',
                  created_at: '2024-01-01T09:00:00.000Z',
                  updated_at: '2024-01-01T09:30:00.000Z',
                  expires_at: '2024-01-02T09:00:00.000Z',
                  progress_step: 'completed',
                  progress_current: 5,
                  progress_total: 5,
                  request_data: JSON.stringify({
                    date_range: {
                      start: '2024-01-01T00:00:00Z',
                      end: '2024-01-02T00:00:00Z'
                    },
                    content_type: 'daily_recap'
                  }),
                  results: JSON.stringify({
                    content_items: [],
                    summary: {
                      total_clips: 10,
                      total_prs: 5,
                      total_commits: 20,
                      total_issues: 3
                    }
                  }),
                  error_message: null,
                  worker_id: 'worker-01HXYZ1234567890ABCDEG',
                  started_at: '2024-01-01T09:05:00.000Z',
                  completed_at: '2024-01-01T09:30:00.000Z'
                },
                {
                  job_id: '01HXYZ1234567890ABCDEH',
                  status: 'queued',
                  created_at: '2024-01-01T11:00:00.000Z',
                  updated_at: '2024-01-01T11:00:00.000Z',
                  expires_at: '2024-01-02T11:00:00.000Z',
                  progress_step: 'initialized',
                  progress_current: 0,
                  progress_total: 0,
                  request_data: JSON.stringify({
                    date_range: {
                      start: '2024-01-01T00:00:00Z',
                      end: '2024-01-02T00:00:00Z'
                    },
                    content_type: 'weekly_summary'
                  }),
                  results: null,
                  error_message: null,
                  worker_id: null,
                  started_at: null,
                  completed_at: null
                }
              ]
            };
          }
          return { results: [] };
        }
      })
    })
  },
  JOB_QUEUE: {
    send: async (message: any) => console.log('Queue message sent:', message)
  },
  WORKER_ORIGIN: 'https://test-worker.example.com'
} as any;

async function testJobManagement() {
  console.log('🧪 Testing Job Management System\n');

  try {
    // Test 1: Job Manager Service
    console.log('1. Testing Job Manager Service...');
    const jobManager = new JobManagerService(mockEnv);
    
    const testRequest: ContentGenerationRequest = {
      date_range: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T00:00:00Z'
      },
      content_type: 'daily_recap'
    };

    const jobResult = await jobManager.createJob(testRequest, 24);
    console.log('✅ Job created:', jobResult);

    // Test 2: Job Status Update
    console.log('\n2. Testing Job Status Updates...');
    await jobManager.updateJobStatus(jobResult.jobId, 'processing', {
      step: 'fetching_content',
      current: 1,
      total: 5
    });
    console.log('✅ Job status updated to processing');

    // Test 3: Job Enqueue
    console.log('\n3. Testing Job Enqueue...');
    await jobManager.enqueueJob(jobResult.jobId, testRequest);
    console.log('✅ Job enqueued for processing');

    // Test 4: Job Listing with Cursor Pagination
    console.log('\n4. Testing Job Listing with Cursor Pagination...');
    const listResult = await jobManager.listJobs({
      limit: 10,
      order: 'desc'
    });
    console.log('✅ Job listing result:', {
      jobCount: listResult.jobs.length,
      pagination: listResult.pagination
    });

    // Test 5: Job Statistics
    console.log('\n5. Testing Job Statistics...');
    const stats = await jobManager.getJobStats();
    console.log('✅ Job statistics:', stats);

    // Test 6: Job Cleanup
    console.log('\n6. Testing Job Cleanup...');
    const cleanupResult = await jobManager.cleanupExpiredJobs();
    console.log('✅ Job cleanup result:', cleanupResult);

    // Test 7: Job Processor Service
    console.log('\n7. Testing Job Processor Service...');
    const processor = new JobProcessorService(mockEnv);
    console.log('✅ Job processor service created');

    console.log('\n🎉 All job management tests completed successfully!');

  } catch (error) {
    console.error('❌ Job management test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testJobManagement();
}

export { testJobManagement };
