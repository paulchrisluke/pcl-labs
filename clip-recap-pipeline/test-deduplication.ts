#!/usr/bin/env node
/**
 * Test script for deduplication functionality
 */

const WORKER_URL = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  data?: any;
}

async function testDeduplicationCheck(): Promise<TestResult> {
  try {
    console.log('🔍 Testing deduplication check endpoint...');
    
    // Get some clip IDs from stored clips
    const storedClipsResponse = await fetch(`${WORKER_URL}/api/twitch/clips/stored`);
    if (!storedClipsResponse.ok) {
      throw new Error(`Failed to get stored clips: ${storedClipsResponse.status}`);
    }
    
    const storedClipsResult = await storedClipsResponse.json();
    const clipIds = storedClipsResult.clips.slice(0, 3).map((clip: any) => clip.id);
    
    if (clipIds.length === 0) {
      return {
        name: 'Deduplication Check',
        success: false,
        error: 'No stored clips available for testing'
      };
    }
    
    console.log(`📋 Testing with clip IDs: ${clipIds.join(', ')}`);
    
    // Test deduplication check
    const dedupResponse = await fetch(`${WORKER_URL}/api/deduplication/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clip_ids: clipIds
      })
    });
    
    if (!dedupResponse.ok) {
      throw new Error(`Deduplication check failed: ${dedupResponse.status}`);
    }
    
    const dedupResult = await dedupResponse.json();
    
    console.log(`📊 Deduplication result:`);
    console.log(`   - Total clips: ${dedupResult.summary.total}`);
    console.log(`   - To download: ${dedupResult.summary.toDownload}`);
    console.log(`   - To skip: ${dedupResult.summary.toSkip}`);
    
    if (dedupResult.clipsToSkip.length > 0) {
      console.log(`⏭️ Clips to skip:`);
      dedupResult.clipsToSkip.forEach((result: any) => {
        console.log(`   - ${result.clipId}: ${result.reason}`);
      });
    }
    
    return {
      name: 'Deduplication Check',
      success: true,
      data: dedupResult
    };
    
  } catch (error) {
    return {
      name: 'Deduplication Check',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testFileInfo(): Promise<TestResult> {
  try {
    console.log('📁 Testing file info endpoint...');
    
    // Get a clip ID from stored clips
    const storedClipsResponse = await fetch(`${WORKER_URL}/api/twitch/clips/stored`);
    if (!storedClipsResponse.ok) {
      throw new Error(`Failed to get stored clips: ${storedClipsResponse.status}`);
    }
    
    const storedClipsResult = await storedClipsResponse.json();
    const clipId = storedClipsResult.clips[0]?.id;
    
    if (!clipId) {
      return {
        name: 'File Info',
        success: false,
        error: 'No stored clips available for testing'
      };
    }
    
    console.log(`📋 Testing file info for clip: ${clipId}`);
    
    // Test file info endpoint
    const fileInfoResponse = await fetch(`${WORKER_URL}/api/deduplication/file-info/${clipId}`);
    
    if (!fileInfoResponse.ok) {
      throw new Error(`File info failed: ${fileInfoResponse.status}`);
    }
    
    const fileInfoResult = await fileInfoResponse.json();
    
    console.log(`📁 File info for ${clipId}:`);
    console.log(`   - Video files: ${fileInfoResult.videoFiles.length}`);
    console.log(`   - Audio files: ${fileInfoResult.audioFiles.length}`);
    console.log(`   - Transcript files: ${fileInfoResult.transcriptFiles.length}`);
    
    if (fileInfoResult.videoFiles.length > 0) {
      console.log(`   - Video files: ${fileInfoResult.videoFiles.map((f: any) => f.key).join(', ')}`);
    }
    
    return {
      name: 'File Info',
      success: true,
      data: fileInfoResult
    };
    
  } catch (error) {
    return {
      name: 'File Info',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testCleanup(): Promise<TestResult> {
  try {
    console.log('🧹 Testing cleanup endpoint...');
    
    // Test cleanup endpoint
    const cleanupResponse = await fetch(`${WORKER_URL}/api/deduplication/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!cleanupResponse.ok) {
      throw new Error(`Cleanup failed: ${cleanupResponse.status}`);
    }
    
    const cleanupResult = await cleanupResponse.json();
    
    console.log(`🧹 Cleanup result:`);
    console.log(`   - Files cleaned: ${cleanupResult.cleanedFiles.length}`);
    console.log(`   - Errors: ${cleanupResult.errors.length}`);
    
    if (cleanupResult.cleanedFiles.length > 0) {
      console.log(`   - Cleaned files: ${cleanupResult.cleanedFiles.join(', ')}`);
    }
    
    if (cleanupResult.errors.length > 0) {
      console.log(`   - Errors: ${cleanupResult.errors.join(', ')}`);
    }
    
    return {
      name: 'Cleanup',
      success: true,
      data: cleanupResult
    };
    
  } catch (error) {
    return {
      name: 'Cleanup',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function runTests(): Promise<void> {
  console.log('🧪 Testing deduplication functionality...');
  console.log(`📡 Testing against: ${WORKER_URL}`);
  
  const tests = [
    testDeduplicationCheck,
    testFileInfo,
    testCleanup
  ];
  
  const results: TestResult[] = [];
  
  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);
      
      if (result.success) {
        console.log(`✅ ${result.name}: PASSED`);
      } else {
        console.log(`❌ ${result.name}: FAILED - ${result.error}`);
      }
      
      console.log(''); // Add spacing between tests
      
    } catch (error) {
      const errorResult: TestResult = {
        name: test.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      results.push(errorResult);
      console.log(`❌ ${errorResult.name}: FAILED - ${errorResult.error}`);
      console.log('');
    }
  }
  
  // Summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('📊 Test Summary:');
  console.log(`   - Passed: ${passed}`);
  console.log(`   - Failed: ${failed}`);
  console.log(`   - Total: ${results.length}`);
  
  if (failed === 0) {
    console.log('🎉 All deduplication tests passed!');
  } else {
    console.log('⚠️ Some tests failed. Check the output above for details.');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
