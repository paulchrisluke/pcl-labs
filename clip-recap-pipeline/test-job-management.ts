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
        first: async () => null
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
