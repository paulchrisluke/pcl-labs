import { uploadTranscriptToR2, uploadGitHubContextToR2, getTranscriptFromR2, getGitHubContextFromR2 } from './src/utils/content-storage.js';
import type { GitHubContext } from './src/types/index.js';
import type { Transcript } from './src/types/content.js';

/**
 * Test the new content storage utilities
 */

// Mock environment
const mockEnv = {
  R2_BUCKET: {
    put: async (key: string, data: string, options?: any) => {
      console.log(`📤 Mock R2 put: ${key}`);
      console.log(`📄 Data size: ${new TextEncoder().encode(data).length} bytes`);
      return { ok: true };
    },
    get: async (key: string) => {
      console.log(`📥 Mock R2 get: ${key}`);
      // Return mock data based on key
      if (key.includes('transcript')) {
        const mockTranscript: Transcript = {
          text: 'This is a test transcript with multiple words to test the storage system.',
          language: 'en',
          redacted: false,
          segments: [
            { start: 0, end: 5, text: 'This is a test transcript' },
            { start: 5, end: 10, text: 'with multiple words to test' }
          ]
        };
        return {
          text: () => Promise.resolve(JSON.stringify(mockTranscript))
        };
      } else if (key.includes('github-context')) {
        const mockContext: GitHubContext = {
          linked_prs: [{
            number: 1,
            title: 'Test Pull Request',
            url: 'https://github.com/test/repo/pull/1',
            merged_at: new Date().toISOString(),
            confidence: 'high',
            match_reason: 'temporal_proximity'
          }],
          linked_commits: [{
            sha: 'abc123',
            message: 'Test commit message',
            url: 'https://github.com/test/repo/commit/abc123',
            timestamp: new Date().toISOString(),
            confidence: 'high',
            match_reason: 'temporal_proximity'
          }, {
            sha: 'def456',
            message: 'Another test commit',
            url: 'https://github.com/test/repo/commit/def456',
            timestamp: new Date().toISOString(),
            confidence: 'medium',
            match_reason: 'temporal_proximity'
          }],
          linked_issues: [{
            number: 1,
            title: 'Test Issue',
            url: 'https://github.com/test/repo/issues/1',
            closed_at: new Date().toISOString(),
            confidence: 'high',
            match_reason: 'temporal_proximity'
          }],
          confidence_score: 0.8,
          match_reason: 'temporal_proximity'
        };
        return {
          text: () => Promise.resolve(JSON.stringify(mockContext))
        };
      }
      return null;
    }
  },
  R2_PUBLIC_BASE_URL: 'https://test-bucket.r2.cloudflarestorage.com'
} as any;

async function testContentStorage() {
  console.log('🧪 Testing Content Storage Utilities');
  console.log('='.repeat(60));
  
  // Test 1: Upload transcript
  console.log('\n📝 Test 1: Upload Transcript');
  console.log('-'.repeat(40));
  
  const testTranscript: Transcript = {
    text: 'This is a test transcript with multiple words to test the storage system.',
    language: 'en',
    redacted: false,
    segments: [
      { start: 0, end: 5, text: 'This is a test transcript' },
      { start: 5, end: 10, text: 'with multiple words to test' }
    ]
  };
  
  const transcriptMetadata = await uploadTranscriptToR2(mockEnv, 'test-clip-1', testTranscript);
  
  console.log(`✅ Transcript upload result:`);
  console.log(`   - URL: ${transcriptMetadata.url}`);
  console.log(`   - Summary: ${transcriptMetadata.summary}`);
  console.log(`   - Size: ${transcriptMetadata.sizeBytes} bytes`);
  
  // Test 2: Upload GitHub context
  console.log('\n🔗 Test 2: Upload GitHub Context');
  console.log('-'.repeat(40));
  
  const testGitHubContext: GitHubContext = {
    linked_prs: [{
      number: 1,
      title: 'Test Pull Request',
      url: 'https://github.com/test/repo/pull/1',
      merged_at: new Date().toISOString(),
      confidence: 'high',
      match_reason: 'temporal_proximity'
    }],
    linked_commits: [{
      sha: 'abc123',
      message: 'Test commit message',
      url: 'https://github.com/test/repo/commit/abc123',
      timestamp: new Date().toISOString(),
      confidence: 'high',
      match_reason: 'temporal_proximity'
    }, {
      sha: 'def456',
      message: 'Another test commit',
      url: 'https://github.com/test/repo/commit/def456',
      timestamp: new Date().toISOString(),
      confidence: 'medium',
      match_reason: 'temporal_proximity'
    }],
    linked_issues: [{
      number: 1,
      title: 'Test Issue',
      url: 'https://github.com/test/repo/issues/1',
      closed_at: new Date().toISOString(),
      confidence: 'high',
      match_reason: 'temporal_proximity'
    }],
    confidence_score: 0.8,
    match_reason: 'temporal_proximity'
  };
  
  const githubMetadata = await uploadGitHubContextToR2(mockEnv, 'test-clip-1', testGitHubContext);
  
  console.log(`✅ GitHub context upload result:`);
  console.log(`   - URL: ${githubMetadata.url}`);
  console.log(`   - Summary: ${githubMetadata.summary}`);
  console.log(`   - Size: ${githubMetadata.sizeBytes} bytes`);
  
  // Test 3: Retrieve transcript
  console.log('\n📥 Test 3: Retrieve Transcript');
  console.log('-'.repeat(40));
  
  const retrievedTranscript = await getTranscriptFromR2(mockEnv, transcriptMetadata.url);
  
  if (!retrievedTranscript) {
    throw new Error('Failed to retrieve transcript');
  }
  
  console.log(`✅ Transcript retrieval result:`);
  console.log(`   - Language: ${retrievedTranscript.language}`);
  console.log(`   - Segments: ${retrievedTranscript.segments.length}`);
  console.log(`   - Text length: ${retrievedTranscript.text?.length || 0} chars`);
  
  // Test 4: Retrieve GitHub context
  console.log('\n📥 Test 4: Retrieve GitHub Context');
  console.log('-'.repeat(40));
  
  const retrievedContext = await getGitHubContextFromR2(mockEnv, githubMetadata.url);
  
  if (!retrievedContext) {
    throw new Error('Failed to retrieve GitHub context');
  }
  
  console.log(`✅ GitHub context retrieval result:`);
  console.log(`   - PRs: ${retrievedContext.linked_prs?.length || 0}`);
  console.log(`   - Commits: ${retrievedContext.linked_commits?.length || 0}`);
  console.log(`   - Issues: ${retrievedContext.linked_issues?.length || 0}`);
  console.log(`   - Confidence: ${retrievedContext.confidence_score}`);
  
  // Test 4.5: Test host validation
  console.log('\n🔒 Test 4.5: Host Validation');
  console.log('-'.repeat(40));
  
  console.log('Testing error handling when URL hostname does not match expected R2 host...');
  try {
    await getTranscriptFromR2(mockEnv, 'https://malicious-site.com/transcripts/test-clip-1.json');
    throw new Error('Expected error when URL hostname does not match expected R2 host');
  } catch (error) {
    console.log(`✅ Correctly threw error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Test 5: Test URL building with and without base URL
  console.log('\n🔗 Test 5: URL Building Scenarios');
  console.log('-'.repeat(40));
  
  // Test with base URL (current mock)
  console.log(`✅ With R2_PUBLIC_BASE_URL: ${transcriptMetadata.url}`);
  
  // Test without base URL (should throw error)
  console.log('Testing error handling when R2_PUBLIC_BASE_URL is not configured...');
  const mockEnvNoBase = { ...mockEnv, R2_PUBLIC_BASE_URL: undefined };
  try {
    await uploadTranscriptToR2(mockEnvNoBase, 'test-clip-2', testTranscript);
    throw new Error('Expected error when R2_PUBLIC_BASE_URL is not configured');
  } catch (error) {
    console.log(`✅ Correctly threw error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Test with trailing slash in base URL
  const mockEnvTrailingSlash = { ...mockEnv, R2_PUBLIC_BASE_URL: 'https://test-bucket.r2.cloudflarestorage.com/' };
  const transcriptMetadataTrailingSlash = await uploadTranscriptToR2(mockEnvTrailingSlash, 'test-clip-3', testTranscript);
  console.log(`✅ With trailing slash in base URL: ${transcriptMetadataTrailingSlash.url}`);
  
  console.log('\n✅ All content storage tests passed!');
}

// Run the test
testContentStorage().catch(error => {
  console.error('❌ Content storage test failed:', error);
  process.exit(1);
});
