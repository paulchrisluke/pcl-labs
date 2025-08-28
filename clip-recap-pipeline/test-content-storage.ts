import { uploadTranscriptToR2, uploadGitHubContextToR2, getTranscriptFromR2, getGitHubContextFromR2 } from './src/utils/content-storage.js';
import type { Transcript, GitHubContext } from './src/types/index.js';

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
            { start_s: 0, end_s: 5, text: 'This is a test transcript' },
            { start_s: 5, end_s: 10, text: 'with multiple words to test' }
          ]
        };
        return {
          text: () => Promise.resolve(JSON.stringify(mockTranscript))
        };
      } else if (key.includes('github-context')) {
        const mockContext: GitHubContext = {
          linked_prs: ['https://github.com/test/repo/pull/1'],
          linked_commits: ['abc123', 'def456'],
          linked_issues: ['https://github.com/test/repo/issues/1'],
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
  R2_BUCKET_NAME: 'test-bucket'
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
      { start_s: 0, end_s: 5, text: 'This is a test transcript' },
      { start_s: 5, end_s: 10, text: 'with multiple words to test' }
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
    linked_prs: ['https://github.com/test/repo/pull/1'],
    linked_commits: ['abc123', 'def456'],
    linked_issues: ['https://github.com/test/repo/issues/1'],
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
  
  console.log('\n✅ All content storage tests passed!');
}

// Run the test
testContentStorage().catch(error => {
  console.error('❌ Content storage test failed:', error);
  process.exit(1);
});
