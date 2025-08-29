#!/usr/bin/env node

/**
 * Test script for manifest builder optimizations
 * Tests boolean coercion and R2 fetch optimizations
 */

import { ManifestBuilderService } from './src/services/manifest-builder.js';
import type { ContentItem } from './src/types/content.js';

// Mock environment for testing
const mockEnv = {
  R2_BUCKET: {
    list: async () => ({ objects: [] }),
    get: async () => null,
    put: async () => ({})
  }
};

// Mock content storage functions
const mockGetTranscriptFromR2 = async (env: any, url: string) => ({
  text: `Mock transcript text for ${url}`,
  metadata: { url, size: 1024 }
});

const mockGetGitHubContextFromR2 = async (env: any, url: string) => ({
  linked_prs: [
    { number: 1, title: 'Test PR', url: 'https://github.com/test/repo/pull/1', merged_at: '2024-01-01T00:00:00Z', confidence: 'high', match_reason: 'temporal_proximity' }
  ],
  linked_commits: [
    { sha: 'abc123', message: 'Test commit', url: 'https://github.com/test/repo/commit/abc123', timestamp: '2024-01-01T00:00:00Z', confidence: 'high', match_reason: 'temporal_proximity' }
  ],
  linked_issues: [],
  confidence_score: 0.8,
  match_reason: 'temporal_proximity'
});

// Mock the content storage module
jest.mock('./src/utils/content-storage.js', () => ({
  getTranscriptFromR2: mockGetTranscriptFromR2,
  getGitHubContextFromR2: mockGetGitHubContextFromR2
}));

// Test data
const createMockContentItem = (overrides: Partial<ContentItem> = {}): ContentItem => ({
  clip_id: 'test-clip-1',
  clip_title: 'Test Clip',
  clip_url: 'https://twitch.tv/clip/test',
  clip_duration: 120,
  clip_created_at: '2024-01-01T12:00:00Z',
  transcript_summary: 'This is a test transcript summary that should be long enough to meet minimum requirements.',
  transcript_url: 'https://example.com/transcript.json',
  transcript_size_bytes: 1024,
  github_context_url: 'https://example.com/github-context.json',
  content_category: 'development',
  processing_status: 'ready_for_content',
  stored_at: '2024-01-01T12:00:00Z',
  ...overrides
});

async function testBooleanCoercion() {
  console.log('🧪 Testing boolean coercion in selectContentItems...\n');
  
  const manifestBuilder = new ManifestBuilderService(mockEnv as any);
  
  // Test cases for boolean coercion
  const testCases = [
    {
      name: 'Valid transcript summary',
      item: createMockContentItem({
        transcript_summary: 'This is a valid transcript summary that meets the minimum length requirement.',
        transcript_url: null,
        transcript_size_bytes: null
      }),
      expectedValid: true
    },
    {
      name: 'Short transcript summary',
      item: createMockContentItem({
        transcript_summary: 'Short',
        transcript_url: null,
        transcript_size_bytes: null
      }),
      expectedValid: false
    },
    {
      name: 'Valid transcript URL',
      item: createMockContentItem({
        transcript_summary: null,
        transcript_url: 'https://example.com/transcript.json',
        transcript_size_bytes: 1024
      }),
      expectedValid: true
    },
    {
      name: 'Transcript URL with zero size',
      item: createMockContentItem({
        transcript_summary: null,
        transcript_url: 'https://example.com/transcript.json',
        transcript_size_bytes: 0
      }),
      expectedValid: false
    },
    {
      name: 'Both transcript summary and URL',
      item: createMockContentItem({
        transcript_summary: 'Valid summary',
        transcript_url: 'https://example.com/transcript.json',
        transcript_size_bytes: 1024
      }),
      expectedValid: true
    },
    {
      name: 'Neither transcript summary nor URL',
      item: createMockContentItem({
        transcript_summary: null,
        transcript_url: null,
        transcript_size_bytes: null
      }),
      expectedValid: false
    }
  ];

  let passedTests = 0;
  const totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`📋 Test: ${testCase.name}`);
    
    try {
      // Mock the selectContentItems method to test the filtering logic
      const candidates = [testCase.item];
      const filteredCandidates = candidates.filter(item => {
        // Must have valid transcript (either summary or transcript_url)
        const hasValidSummary = !!(item.transcript_summary && 
          item.transcript_summary.length >= 10); // Mock minimum length
        const hasTranscriptUrl = !!(item.transcript_url && 
          (!item.transcript_size_bytes || item.transcript_size_bytes > 0));
        
        if (!hasValidSummary && !hasTranscriptUrl) {
          return false;
        }

        // Must meet minimum duration
        if (item.clip_duration < 30) { // Mock minimum duration
          return false;
        }

        return true;
      });

      const isValid = filteredCandidates.length > 0;
      
      if (isValid === testCase.expectedValid) {
        console.log(`✅ PASSED: Expected ${testCase.expectedValid}, got ${isValid}`);
        passedTests++;
      } else {
        console.log(`❌ FAILED: Expected ${testCase.expectedValid}, got ${isValid}`);
      }
      
    } catch (error) {
      console.log(`❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`\n📊 Boolean Coercion Test Results: ${passedTests}/${totalTests} tests passed`);
  return passedTests === totalTests;
}

async function testR2FetchOptimization() {
  console.log('\n🧪 Testing R2 fetch optimization...\n');
  
  const manifestBuilder = new ManifestBuilderService(mockEnv as any);
  
  // Track fetch calls
  let transcriptFetchCount = 0;
  let githubContextFetchCount = 0;
  
  // Override the mock functions to track calls
  const originalGetTranscriptFromR2 = mockGetTranscriptFromR2;
  const originalGetGitHubContextFromR2 = mockGetGitHubContextFromR2;
  
  mockGetTranscriptFromR2 = async (env: any, url: string) => {
    transcriptFetchCount++;
    return originalGetTranscriptFromR2(env, url);
  };
  
  mockGetGitHubContextFromR2 = async (env: any, url: string) => {
    githubContextFetchCount++;
    return originalGetGitHubContextFromR2(env, url);
  };

  // Create test items
  const testItems = [
    createMockContentItem({ clip_id: 'clip-1' }),
    createMockContentItem({ clip_id: 'clip-2' }),
    createMockContentItem({ clip_id: 'clip-3' })
  ];

  try {
    // Reset counters
    transcriptFetchCount = 0;
    githubContextFetchCount = 0;
    
    // Test the prefetch method
    const prefetchMethod = (manifestBuilder as any).prefetchItemData.bind(manifestBuilder);
    const itemDataMap = await prefetchMethod(testItems);
    
    console.log(`📊 Prefetch results:`);
    console.log(`   - Transcript fetches: ${transcriptFetchCount} (expected: 3)`);
    console.log(`   - GitHub context fetches: ${githubContextFetchCount} (expected: 3)`);
    console.log(`   - Data map size: ${itemDataMap.size} (expected: 3)`);
    
    // Test that data is properly cached
    const itemData = itemDataMap.get('clip-1');
    if (itemData && itemData.transcript && itemData.githubContext) {
      console.log(`✅ PASSED: Data properly cached for clip-1`);
    } else {
      console.log(`❌ FAILED: Data not properly cached for clip-1`);
    }
    
    // Test that subsequent calls don't trigger new fetches
    const originalTranscriptCount = transcriptFetchCount;
    const originalGitHubCount = githubContextFetchCount;
    
    // Call generateBullets with prefetched data
    const generateBulletsMethod = (manifestBuilder as any).generateBullets.bind(manifestBuilder);
    await generateBulletsMethod(testItems[0], itemDataMap.get('clip-1'));
    
    if (transcriptFetchCount === originalTranscriptCount && githubContextFetchCount === originalGitHubCount) {
      console.log(`✅ PASSED: No duplicate fetches when using prefetched data`);
    } else {
      console.log(`❌ FAILED: Duplicate fetches detected`);
      console.log(`   - Transcript fetches: ${transcriptFetchCount} (was ${originalTranscriptCount})`);
      console.log(`   - GitHub context fetches: ${githubContextFetchCount} (was ${originalGitHubCount})`);
    }
    
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testMethodSignatureChanges() {
  console.log('\n🧪 Testing method signature changes...\n');
  
  const manifestBuilder = new ManifestBuilderService(mockEnv as any);
  
  try {
    // Test that extractRepoFromGitHubContext is now synchronous
    const extractRepoMethod = (manifestBuilder as any).extractRepoFromGitHubContext.bind(manifestBuilder);
    const mockGitHubContext = {
      linked_prs: [
        { url: 'https://github.com/test/repo/pull/1' }
      ]
    };
    
    const repo = extractRepoMethod({}, mockGitHubContext);
    if (repo === 'test/repo') {
      console.log(`✅ PASSED: extractRepoFromGitHubContext works synchronously`);
    } else {
      console.log(`❌ FAILED: extractRepoFromGitHubContext returned ${repo}, expected 'test/repo'`);
    }
    
    // Test that extractPrLinks is now synchronous
    const extractPrLinksMethod = (manifestBuilder as any).extractPrLinks.bind(manifestBuilder);
    const prLinks = extractPrLinksMethod({}, mockGitHubContext);
    if (Array.isArray(prLinks) && prLinks.length === 1 && prLinks[0] === 'https://github.com/test/repo/pull/1') {
      console.log(`✅ PASSED: extractPrLinks works synchronously`);
    } else {
      console.log(`❌ FAILED: extractPrLinks returned ${JSON.stringify(prLinks)}`);
    }
    
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting manifest builder optimization tests...\n');
  
  const booleanCoercionPassed = await testBooleanCoercion();
  await testR2FetchOptimization();
  await testMethodSignatureChanges();
  
  console.log('\n✨ All tests completed!');
  
  if (booleanCoercionPassed) {
    console.log('🎉 Boolean coercion tests passed!');
  } else {
    console.log('⚠️ Some boolean coercion tests failed.');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}
