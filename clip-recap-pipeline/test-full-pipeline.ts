#!/usr/bin/env -S npx tsx

/**
 * Comprehensive test script for the entire pipeline
 * 
 * This tests the complete flow from clips to transcription
 */

const WORKER_URL = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

/**
 * Create HMAC signature for request authentication
 */
async function createSignature(body: string, timestamp: string, nonce: string): Promise<string> {
  const hmacSecret = process.env.HMAC_SHARED_SECRET;
  if (!hmacSecret) {
    throw new Error('HMAC_SHARED_SECRET not configured');
  }

  // Create signature payload: body + timestamp + nonce
  const payload = `${body}${timestamp}${nonce}`;
  
  // Create HMAC signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(hmacSecret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create security headers for API requests
 */
async function createSecurityHeaders(body: string = ''): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 15);
  const signature = await createSignature(body, timestamp, nonce);
  
  return {
    'X-Request-Signature': signature,
    'X-Request-Timestamp': timestamp,
    'X-Request-Nonce': nonce,
    'Content-Type': 'application/json',
  };
}

async function testFullPipeline() {
  console.log('🧪 Testing Full Pipeline...\n');
  
  try {
    // Step 1: Check stored clips
    console.log('📋 Step 1: Checking stored clips...');
    const clipsResponse = await fetch(`${WORKER_URL}/api/twitch/clips/stored`);
    
    if (!clipsResponse.ok) {
      throw new Error(`Failed to fetch clips: ${clipsResponse.status}`);
    }
    
    const clipsData = await clipsResponse.json();
    
    // Defensive check for clips data - validate before logging
    if (!clipsData || !Array.isArray(clipsData.clips) || clipsData.clips.length === 0) {
      throw new Error('No clips available for test');
    }
    
    console.log(`✅ Found ${clipsData.clips.length} stored clips`);
    
    // Step 2: Check a specific clip's status
    const testClip = clipsData.clips[0];
    console.log(`\n🔍 Step 2: Checking status for clip: ${testClip.id}`);
    console.log(`📝 Title: ${testClip.title}`);
    
    const statusResponse = await fetch(`${WORKER_URL}/api/audio/status/${testClip.id}`);
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log(`  🎬 Video: ${status.has_video ? '✅' : '❌'}`);
      console.log(`  🎵 Audio: ${status.has_audio ? '✅' : '❌'}`);
      console.log(`  📝 Transcript: ${status.has_transcript ? '✅' : '❌'}`);
      console.log(`  📊 Status: ${status.processing_status}`);
    } else {
      console.log(`  ❌ Status check failed: ${statusResponse.status}`);
    }
    
    // Step 3: Test Python server endpoint with HMAC authentication
    console.log('\n🔧 Step 3: Testing Python server endpoint...');
    const pythonUrls = [
      'https://pcl-labs.vercel.app/api/process-clips',
      'https://pcl-labs.vercel.app/api/process_clips'
    ];
    
    const requestBody = JSON.stringify({ clip_ids: [testClip.id], background: false });
    const securityHeaders = await createSecurityHeaders(requestBody);
    
    let pythonSuccess = false;
    
    for (const pythonUrl of pythonUrls) {
      console.log(`Testing: ${pythonUrl}`);
      
      try {
        const pythonResponse = await fetch(pythonUrl, {
          method: 'POST',
          headers: securityHeaders,
          body: requestBody
        });
        
        if (pythonResponse.ok) {
          const pythonResult = await pythonResponse.json();
          console.log('✅ Python server working!');
          console.log(`📊 Result: ${JSON.stringify(pythonResult, null, 2)}`);
          pythonSuccess = true;
          break;
        } else {
          const errorText = await pythonResponse.text();
          console.log(`❌ Python server error: ${pythonResponse.status} - ${errorText}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`❌ Python server connection failed: ${errorMessage}`);
      }
    }
    
    if (!pythonSuccess) {
      console.log('❌ All Python server endpoints failed');
    }
    
    // Step 4: Test transcription directly
    console.log('\n🎤 Step 4: Testing transcription...');
    const transcribeResponse = await fetch(`${WORKER_URL}/api/transcribe/clip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipId: testClip.id })
    });
    
    if (transcribeResponse.ok) {
      const transcribeResult = await transcribeResponse.json();
      console.log('✅ Transcription endpoint working!');
      console.log(`📊 Result: ${transcribeResult.message}`);
      
      if (transcribeResult.transcript) {
        console.log(`📝 Transcript: ${JSON.stringify(transcribeResult.transcript, null, 2)}`);
      }
    } else {
      const errorText = await transcribeResponse.text();
      console.log(`❌ Transcription failed: ${transcribeResponse.status} - ${errorText}`);
    }
    
    // Step 5: Check R2 files directly
    console.log('\n📁 Step 5: Checking R2 files directly...');
    
    const filesToCheck = [
      `clips/${testClip.id}.mp4`,
      `audio/${testClip.id}.wav`,
      `transcripts/${testClip.id}.json`
    ];
    
    for (const filePath of filesToCheck) {
      try {
        const fileUrl = `https://clip-recap-assets.paulchrisluke.workers.dev/${filePath}`;
        const fileResponse = await fetch(fileUrl, { method: 'HEAD' });
        
        if (fileResponse.ok) {
          const size = fileResponse.headers.get('content-length');
          console.log(`  ✅ ${filePath}: ${size} bytes`);
        } else {
          console.log(`  ❌ ${filePath}: ${fileResponse.status}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`  ❌ ${filePath}: ${errorMessage}`);
      }
    }
    
    // Step 6: Summary
    console.log('\n📊 Step 6: Pipeline Summary');
    console.log('=' .repeat(50));
    // Generate summary based on actual test results
    // This would require collecting status throughout the test execution
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error; // Re-throw to ensure process exits with failure
  }
}

// Run the test
testFullPipeline().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
