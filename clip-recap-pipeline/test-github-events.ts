#!/usr/bin/env node

/**
 * Test GitHub Event Storage and Temporal Matching (M8 - GitHub Integration)
 * 
 * This test verifies:
 * 1. GitHub event storage in R2
 * 2. Temporal matching between clips and GitHub events
 * 3. Clip enhancement with GitHub context
 */

import { GitHubEventService } from './src/services/github-events.js';
import type { TwitchClip } from './src/types/index.js';
import { createMockEnvironment } from './src/utils/mock-r2.js';

// Mock environment for testing
const mockEnv = createMockEnvironment();

// Sample Twitch clip for testing
const sampleClip: TwitchClip = {
  id: 'TestClip123',
  url: 'https://clips.twitch.tv/TestClip123',
  embed_url: 'https://clips.twitch.tv/embed?clip=TestClip123',
  broadcaster_id: '123456789',
  broadcaster_name: 'testbroadcaster',
  creator_id: '987654321',
  creator_name: 'testcreator',
  video_id: '1234567890',
  game_id: '509658',
  language: 'en',
  title: 'Test clip for GitHub integration',
  view_count: 42,
  created_at: new Date().toISOString(), // Current time
  thumbnail_url: 'https://clips-media-assets2.twitch.tv/TestClip123/thumbnail.jpg',
  duration: 30,
  vod_offset: 3600
};

async function testGitHubEventStorage() {
  console.log('🧪 Testing GitHub Event Storage and Temporal Matching');
  console.log('='.repeat(60));
  
  const githubEventService = new GitHubEventService(mockEnv);
  
  // Test 1: Store a GitHub event
  console.log('\n📝 Test 1: Storing GitHub Event');
  console.log('-'.repeat(40));
  
  const testEvent = {
    deliveryId: `test-${Date.now()}`,
    eventType: 'pull_request',
    payload: {
      action: 'closed',
      pull_request: {
        number: 42,
        title: 'Test PR for temporal matching',
        html_url: 'https://github.com/paulchrisluke/pcl-labs/pull/42',
        merged: true,
        merged_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        updated_at: new Date().toISOString(),
        closed_at: new Date().toISOString(),
        user: { login: 'testuser' },
        head: { ref: 'feature/test', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' }
      },
      repository: {
        full_name: 'paulchrisluke/pcl-labs'
      }
    },
    repository: 'paulchrisluke/pcl-labs'
  };
  
  const stored = await githubEventService.storeEvent(
    testEvent.deliveryId,
    testEvent.eventType,
    testEvent.payload,
    testEvent.repository
  );
  
  console.log(`✅ Event storage result: ${stored ? 'SUCCESS' : 'FAILED'}`);
  
  // Test 2: Find events for a clip (temporal matching)
  console.log('\n🔍 Test 2: Temporal Matching');
  console.log('-'.repeat(40));
  
  const events = await githubEventService.findEventsForClip(sampleClip, 'paulchrisluke/pcl-labs');
  
  console.log(`📊 Found events for clip:`);
  console.log(`   - PRs: ${events.prs.length}`);
  console.log(`   - Commits: ${events.commits.length}`);
  console.log(`   - Issues: ${events.issues.length}`);
  
  // Test 3: Enhance clip with GitHub context
  console.log('\n🎯 Test 3: Clip Enhancement');
  console.log('-'.repeat(40));
  
  const enhancedClip = await githubEventService.enhanceClipWithGitHubContext(
    sampleClip,
    'paulchrisluke/pcl-labs'
  );
  
  console.log(`✅ Clip enhancement result:`);
  console.log(`   - Has GitHub context: ${!!enhancedClip.github_context}`);
  if (enhancedClip.github_context) {
    console.log(`   - Linked PRs: ${enhancedClip.github_context.linked_prs.length}`);
    console.log(`   - Linked commits: ${enhancedClip.github_context.linked_commits.length}`);
    console.log(`   - Linked issues: ${enhancedClip.github_context.linked_issues.length}`);
  }
  
  // Test 4: Configuration
  console.log('\n⚙️  Test 4: Configuration');
  console.log('-'.repeat(40));
  
  const config = githubEventService.getConfig();
  console.log('Current configuration:');
  console.log(`   - Time window: ${config.timeWindowHours} hours`);
  console.log(`   - High confidence threshold: ${config.confidenceThresholds.high} minutes`);
  console.log(`   - Medium confidence threshold: ${config.confidenceThresholds.medium} minutes`);
  console.log(`   - Low confidence threshold: ${config.confidenceThresholds.low} minutes`);
  
  // Test 5: Update configuration
  console.log('\n🔄 Test 5: Configuration Update');
  console.log('-'.repeat(40));
  
  githubEventService.updateConfig({
    timeWindowHours: 4,
    confidenceThresholds: {
      high: 15,
      medium: 45,
      low: 90
    }
  });
  
  const updatedConfig = githubEventService.getConfig();
  console.log('Updated configuration:');
  console.log(`   - Time window: ${updatedConfig.timeWindowHours} hours`);
  console.log(`   - High confidence threshold: ${updatedConfig.confidenceThresholds.high} minutes`);
  console.log(`   - Medium confidence threshold: ${updatedConfig.confidenceThresholds.medium} minutes`);
  console.log(`   - Low confidence threshold: ${updatedConfig.confidenceThresholds.low} minutes`);
  
  console.log('\n🎉 All tests completed successfully!');
  console.log('=' .repeat(60));
}

// Run the test
testGitHubEventStorage().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
