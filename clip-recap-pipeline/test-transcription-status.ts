#!/usr/bin/env npx tsx

/**
 * Test script to check transcription status of existing clips
 * 
 * This helps us understand which clips need transcription and test the real pipeline.
 */

const WORKER_URL = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

async function checkTranscriptionStatus() {
  console.log('🔍 Checking transcription status of existing clips...\n');
  
  try {
    // Step 1: Get stored clips
    console.log('📋 Step 1: Fetching stored clips...');
    const clipsResponse = await fetch(`${WORKER_URL}/api/twitch/clips/stored`);
    
    if (!clipsResponse.ok) {
      throw new Error(`Failed to fetch clips: ${clipsResponse.status} ${clipsResponse.statusText}`);
    }
    
    const clipsData = await clipsResponse.json();
    console.log(`✅ Found ${clipsData.clips.length} stored clips`);
    
    // Step 2: Check audio and transcription status for each clip
    console.log('\n📊 Step 2: Checking audio and transcription status...');
    console.log('=' .repeat(80));
    
    const statusResults = [];
    
    for (const clip of clipsData.clips.slice(0, 5)) { // Check first 5 clips
      console.log(`\n🔍 Checking clip: ${clip.id}`);
      console.log(`📝 Title: ${clip.title}`);
      
      try {
        const statusResponse = await fetch(`${WORKER_URL}/api/audio/status/${clip.id}`);
        
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          statusResults.push({ clipId: clip.id, status });
          
          console.log(`  🎬 Video: ${status.has_video ? '✅' : '❌'}`);
          console.log(`  🎵 Audio: ${status.has_audio ? '✅' : '❌'}`);
          console.log(`  📝 Transcript: ${status.has_transcript ? '✅' : '❌'}`);
          console.log(`  📊 Status: ${status.processing_status}`);
          
          if (status.has_audio && !status.has_transcript) {
            console.log(`  🎤 Ready for transcription!`);
          }
        } else {
          console.log(`  ❌ Failed to get status: ${statusResponse.status}`);
          statusResults.push({ clipId: clip.id, error: `Status check failed: ${statusResponse.status}` });
        }
      } catch (error) {
        console.log(`  ❌ Error checking status: ${error}`);
        statusResults.push({ clipId: clip.id, error: error.message });
      }
    }
    
    // Step 3: Summary
    console.log('\n📊 Step 3: Summary');
    console.log('=' .repeat(80));
    
    const clipsWithAudio = statusResults.filter(r => r.status?.has_audio);
    const clipsWithTranscript = statusResults.filter(r => r.status?.has_transcript);
    const clipsNeedingTranscription = statusResults.filter(r => r.status?.has_audio && !r.status?.has_transcript);
    
    console.log(`📋 Total clips checked: ${statusResults.length}`);
    console.log(`🎵 Clips with audio: ${clipsWithAudio.length}`);
    console.log(`📝 Clips with transcripts: ${clipsWithTranscript.length}`);
    console.log(`🎤 Clips needing transcription: ${clipsNeedingTranscription.length}`);
    
    if (clipsNeedingTranscription.length > 0) {
      console.log('\n🎤 Clips ready for transcription:');
      clipsNeedingTranscription.forEach(({ clipId, status }) => {
        console.log(`  📝 ${clipId} - ${status.processing_status}`);
      });
      
      console.log('\n💡 Test transcription with:');
      clipsNeedingTranscription.forEach(({ clipId }) => {
        console.log(`  curl -X POST "${WORKER_URL}/api/transcribe/${clipId}"`);
      });
    } else {
      console.log('\n✅ All clips with audio already have transcripts!');
    }
    
    // Step 4: Test transcription if we have clips that need it
    if (clipsNeedingTranscription.length > 0) {
      console.log('\n🧪 Step 4: Testing transcription...');
      console.log('=' .repeat(80));
      
      const testClip = clipsNeedingTranscription[0];
      console.log(`🎤 Testing transcription for clip: ${testClip.clipId}`);
      
      try {
        const transcribeResponse = await fetch(`${WORKER_URL}/api/transcribe/${testClip.clipId}`, {
          method: 'POST'
        });
        
        if (transcribeResponse.ok) {
          const transcribeResult = await transcribeResponse.json();
          console.log('✅ Transcription test successful!');
          console.log(`📊 Result: ${transcribeResult.message}`);
          
          if (transcribeResult.transcript) {
            console.log(`📝 Transcript preview: ${transcribeResult.transcript.text.substring(0, 100)}...`);
            console.log(`🔢 Segments: ${transcribeResult.transcript.segments.length}`);
            console.log(`🌍 Language: ${transcribeResult.transcript.language}`);
          }
        } else {
          const errorText = await transcribeResponse.text();
          console.log(`❌ Transcription test failed: ${transcribeResponse.status} - ${errorText}`);
        }
      } catch (error) {
        console.log(`❌ Transcription test error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking transcription status:', error);
  }
}

// Run the test
checkTranscriptionStatus().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
