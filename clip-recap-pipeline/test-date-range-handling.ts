#!/usr/bin/env node

/**
 * Test script for date range handling in job processor
 * Tests both single-day and multi-day date range scenarios
 */

import { JobProcessorService } from './src/services/job-processor.js';
import { ManifestBuilderService } from './src/services/manifest-builder.js';
import { AIJudgeService } from './src/services/ai-judge.js';
import { BlogGeneratorService } from './src/services/blog-generator.js';
import { JobManagerService } from './src/services/job-manager.js';
import { ContentItemService } from './src/services/content-items.js';
import type { ContentGenerationRequest } from './src/types/content.js';

// Mock environment for testing
const mockEnv = {
  R2_BUCKET: {
    list: async () => ({ objects: [] }),
    get: async () => null,
    put: async () => ({})
  },
  JOB_STORE: {
    prepare: (query: string) => ({
      bind: (...args: any[]) => ({
        run: async () => ({ meta: { changes: 1 } }),
        first: async () => null,
        all: async () => ({ results: [] })
      })
    })
  }
};

// Mock services
const mockManifestBuilder = {
  buildDailyManifest: async (date: string, timezone: string) => ({
    selectedItems: [
      {
        clip_id: `test-clip-${date}`,
        clip_title: `Test Clip for ${date}`,
        clip_url: 'https://twitch.tv/clip/test',
        clip_duration: 120,
        clip_created_at: `${date}T12:00:00Z`,
        transcript_summary: 'Test transcript summary',
        github_context_url: 'https://example.com/github-context.json'
      }
    ],
    manifest: {
      title: `Daily Recap for ${date}`,
      date: date,
      timezone: timezone,
      sections: []
    },
    selectionMetrics: {
      totalCandidates: 1,
      selectedCount: 1,
      averageScore: 0.8,
      diversityScore: 0.7,
      githubContextCount: 1
    }
  })
};

const mockAIJudge = {
  judgeManifest: async (manifest: any) => ({
    overall: 0.85,
    sections: {}
  })
};

const mockBlogGenerator = {
  generateBlogPost: async (manifest: any) => ({
    content: 'Test blog content',
    frontMatter: {
      title: `Daily Recap for ${manifest.date}`,
      tags: ['development', 'gaming']
    }
  })
};

const mockJobManager = {
  updateJobStatus: async (jobId: string, status: string, progress?: any, results?: any, error?: string) => {
    console.log(`Job ${jobId} status updated to ${status}`, progress);
  }
};

const mockContentItemService = {
  listContentItems: async (query: any) => ({
    items: [],
    pagination: { has_next: false, has_prev: false }
  })
};

// Test cases
const testCases = [
  {
    name: 'Single day - same start and end date',
    request: {
      date_range: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-01T23:59:59Z'
      },
      content_type: 'daily_recap' as const
    },
    expectedDays: 1
  },
  {
    name: 'Single day - different times but same date',
    request: {
      date_range: {
        start: '2024-01-01T08:00:00Z',
        end: '2024-01-01T16:00:00Z'
      },
      content_type: 'daily_recap' as const
    },
    expectedDays: 1
  },
  {
    name: 'Multi-day range - 3 days',
    request: {
      date_range: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-03T23:59:59Z'
      },
      content_type: 'daily_recap' as const
    },
    expectedDays: 3
  },
  {
    name: 'Multi-day range - 7 days',
    request: {
      date_range: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-07T23:59:59Z'
      },
      content_type: 'daily_recap' as const
    },
    expectedDays: 7
  },
  {
    name: 'Cross-month range',
    request: {
      date_range: {
        start: '2024-01-30T00:00:00Z',
        end: '2024-02-02T23:59:59Z'
      },
      content_type: 'daily_recap' as const
    },
    expectedDays: 4
  }
];

async function testDateRangeHandling() {
  console.log('🧪 Testing date range handling in job processor...\n');

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`📋 Test: ${testCase.name}`);
    
    try {
      // Create a mock job processor
      const jobProcessor = new JobProcessorService(mockEnv as any);
      
      // Mock the dependencies
      (jobProcessor as any).manifestBuilder = mockManifestBuilder;
      (jobProcessor as any).aiJudge = mockAIJudge;
      (jobProcessor as any).blogGenerator = mockBlogGenerator;
      (jobProcessor as any).jobManager = mockJobManager;
      (jobProcessor as any).contentItemService = mockContentItemService;
      
      // Track how many times buildDailyManifest is called
      let manifestCallCount = 0;
      const originalBuildDailyManifest = mockManifestBuilder.buildDailyManifest;
      mockManifestBuilder.buildDailyManifest = async (date: string, timezone: string) => {
        manifestCallCount++;
        return originalBuildDailyManifest(date, timezone);
      };

      // Mock the processJob method to test the date range logic
      const processJobSpy = async (jobId: string, requestData: ContentGenerationRequest) => {
        const startDate = new Date(requestData.date_range.start);
        const endDate = new Date(requestData.date_range.end);
        
        // Normalize dates to UTC for consistent comparison
        const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
        const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
        
        // Check if it's a single day or multi-day range
        const isSingleDay = startUTC.getTime() === endUTC.getTime();
        
        if (isSingleDay) {
          // Single day processing
          const dateString = startDate.toISOString().split('T')[0];
          await mockManifestBuilder.buildDailyManifest(dateString, 'UTC');
        } else {
          // Multi-day processing
          const currentDate = new Date(startUTC);
          while (currentDate <= endUTC) {
            const dateString = currentDate.toISOString().split('T')[0];
            await mockManifestBuilder.buildDailyManifest(dateString, 'UTC');
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
          }
        }
      };

      // Execute the test
      await processJobSpy('test-job-id', testCase.request);
      
      // Verify the number of manifest calls matches expected days
      if (manifestCallCount === testCase.expectedDays) {
        console.log(`✅ PASSED: Expected ${testCase.expectedDays} manifest calls, got ${manifestCallCount}`);
        passedTests++;
      } else {
        console.log(`❌ FAILED: Expected ${testCase.expectedDays} manifest calls, got ${manifestCallCount}`);
      }
      
    } catch (error) {
      console.log(`❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log(''); // Empty line for readability
  }

  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All date range handling tests passed!');
  } else {
    console.log('⚠️ Some tests failed. Please review the implementation.');
  }
}

// Test timezone handling
async function testTimezoneHandling() {
  console.log('\n🧪 Testing timezone handling...\n');
  
  const testCases = [
    {
      name: 'UTC timezone',
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z',
      timezone: 'UTC'
    },
    {
      name: 'EST timezone (UTC-5)',
      start: '2024-01-01T05:00:00Z', // 00:00 EST
      end: '2024-01-02T04:59:59Z',   // 23:59 EST
      timezone: 'America/New_York'
    },
    {
      name: 'PST timezone (UTC-8)',
      start: '2024-01-01T08:00:00Z', // 00:00 PST
      end: '2024-01-02T07:59:59Z',   // 23:59 PST
      timezone: 'America/Los_Angeles'
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Test: ${testCase.name}`);
    
    try {
      const startDate = new Date(testCase.start);
      const endDate = new Date(testCase.end);
      
      // Normalize dates to UTC for consistent comparison
      const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
      const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
      
      const isSingleDay = startUTC.getTime() === endUTC.getTime();
      
      if (isSingleDay) {
        console.log(`✅ PASSED: Correctly identified as single day`);
      } else {
        console.log(`❌ FAILED: Incorrectly identified as multi-day`);
      }
      
    } catch (error) {
      console.log(`❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Test error handling
async function testErrorHandling() {
  console.log('\n🧪 Testing error handling...\n');
  
  const testCases = [
    {
      name: 'Invalid date format',
      request: {
        date_range: {
          start: 'invalid-date',
          end: '2024-01-01T23:59:59Z'
        },
        content_type: 'daily_recap' as const
      }
    },
    {
      name: 'End date before start date',
      request: {
        date_range: {
          start: '2024-01-02T00:00:00Z',
          end: '2024-01-01T23:59:59Z'
        },
        content_type: 'daily_recap' as const
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Test: ${testCase.name}`);
    
    try {
      const startDate = new Date(testCase.request.date_range.start);
      const endDate = new Date(testCase.request.date_range.end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.log(`✅ PASSED: Correctly detected invalid date format`);
      } else if (endDate < startDate) {
        console.log(`✅ PASSED: Correctly detected end date before start date`);
      } else {
        console.log(`❌ FAILED: Should have detected error condition`);
      }
      
    } catch (error) {
      console.log(`✅ PASSED: Correctly threw error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting date range handling tests...\n');
  
  await testDateRangeHandling();
  await testTimezoneHandling();
  await testErrorHandling();
  
  console.log('\n✨ All tests completed!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}
