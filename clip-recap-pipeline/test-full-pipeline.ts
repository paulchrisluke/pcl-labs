#!/usr/bin/env npx tsx

/**
 * Comprehensive test script for the entire pipeline
 * 
 * This tests the complete flow from clips to transcription
 */

const WORKER_URL = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

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
    console.log(`✅ Found ${clipsData.clips.length} stored clips`);
    
    // Defensive check for clips data
    if (!clipsData || !Array.isArray(clipsData.clips) || clipsData.clips.length === 0) {
      throw new Error('No clips available for test');
    }
    
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
    
    // Step 3: Test Python server endpoint
    console.log('\n🔧 Step 3: Testing Python server endpoint...');
    const pythonUrl = 'https://pcl-labs.vercel.app/api/process-clips';
    console.log(`Testing: ${pythonUrl}`);
    
    try {
      const pythonResponse = await fetch(pythonUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_ids: [testClip.id], background: false })
      });
      
      if (pythonResponse.ok) {
        const pythonResult = await pythonResponse.json();
        console.log('✅ Python server working!');
        console.log(`📊 Result: ${JSON.stringify(pythonResult, null, 2)}`);
      } else {
        const errorText = await pythonResponse.text();
        console.log(`❌ Python server error: ${pythonResponse.status} - ${errorText}`);
      }
    } catch (error) {
      console.log(`❌ Python server connection failed: ${error.message}`);
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
        console.log(`  ❌ ${filePath}: ${error.message}`);
      }
    }
    
    // Step 6: Summary
    console.log('\n📊 Step 6: Pipeline Summary');
    console.log('=' .repeat(50));
    // Generate summary based on actual test results
    // This would require collecting status throughout the test execution
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFullPipeline().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
