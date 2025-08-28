#!/usr/bin/env tsx

/**
 * Test script to list existing audio files in R2
 * 
 * This helps us identify what clips we can test transcription with.
 */

import { Environment } from './src/types/index.js';
import { createMockEnvironment, MockR2Bucket } from './src/utils/mock-r2.js';

// Create mock environment with improved R2 implementation
const mockEnv = createMockEnvironment();
const r2Bucket = mockEnv.R2_BUCKET as MockR2Bucket;

// Pre-populate with sample data
async function setupMockData() {
  // Audio files
  await r2Bucket.put('audio/clip-123.wav', new Uint8Array(1024000), {
    httpMetadata: { contentType: 'audio/wav' }
  });
  await r2Bucket.put('audio/clip-456.wav', new Uint8Array(2048000), {
    httpMetadata: { contentType: 'audio/wav' }
  });
  await r2Bucket.put('audio/clip-789.wav', new Uint8Array(1536000), {
    httpMetadata: { contentType: 'audio/wav' }
  });
  
  // Video files
  await r2Bucket.put('clips/clip-123.mp4', new Uint8Array(5120000), {
    httpMetadata: { contentType: 'video/mp4' }
  });
  await r2Bucket.put('clips/clip-456.mp4', new Uint8Array(10240000), {
    httpMetadata: { contentType: 'video/mp4' }
  });
  await r2Bucket.put('clips/clip-789.mp4', new Uint8Array(7680000), {
    httpMetadata: { contentType: 'video/mp4' }
  });
  
  // Transcript files
  await r2Bucket.put('transcripts/clip-123.json', JSON.stringify({ text: 'Sample transcript' }), {
    httpMetadata: { contentType: 'application/json' }
  });
  await r2Bucket.put('transcripts/clip-456.json', JSON.stringify({ text: 'Another transcript' }), {
    httpMetadata: { contentType: 'application/json' }
  });
}

async function listAudioFiles() {
  console.log('🔍 Listing audio files in R2...\n');
  
  // Setup mock data
  await setupMockData();
  
  try {
    const result = await mockEnv.R2_BUCKET.list();
    
    console.log('📁 All files in R2:');
    console.log('=' .repeat(80));
    
    const audioFiles = result.objects.filter(obj => obj.key.startsWith('audio/'));
    const videoFiles = result.objects.filter(obj => obj.key.startsWith('clips/'));
    const transcriptFiles = result.objects.filter(obj => obj.key.startsWith('transcripts/'));
    
    console.log(`🎵 Audio files (${audioFiles.length}):`);
    audioFiles.forEach(file => {
      const clipId = file.key.replace('audio/', '').replace('.wav', '');
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      console.log(`  📁 ${file.key} (${sizeMB} MB) - ${file.uploaded}`);
    });
    
    console.log(`\n🎬 Video files (${videoFiles.length}):`);
    videoFiles.forEach(file => {
      const clipId = file.key.replace('clips/', '').replace('.mp4', '');
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      console.log(`  📁 ${file.key} (${sizeMB} MB) - ${file.uploaded}`);
    });
    
    console.log(`\n📝 Transcript files (${transcriptFiles.length}):`);
    transcriptFiles.forEach(file => {
      const clipId = file.key.replace('transcripts/', '').replace('.json', '');
      const sizeKB = (file.size / 1024).toFixed(2);
      console.log(`  📁 ${file.key} (${sizeKB} KB) - ${file.uploaded}`);
    });
    
    console.log('\n📊 Summary:');
    console.log(`  Audio files: ${audioFiles.length}`);
    console.log(`  Video files: ${videoFiles.length}`);
    console.log(`  Transcript files: ${transcriptFiles.length}`);
    
    // Find clips that have audio but no transcript
    const clipsWithAudio = audioFiles.map(f => f.key.replace('audio/', '').replace('.wav', ''));
    const clipsWithTranscript = transcriptFiles.map(f => f.key.replace('transcripts/', '').replace('.json', ''));
    const clipsNeedingTranscription = clipsWithAudio.filter(clipId => !clipsWithTranscript.includes(clipId));
    
    console.log(`\n🎤 Clips needing transcription: ${clipsNeedingTranscription.length}`);
    clipsNeedingTranscription.forEach(clipId => {
      console.log(`  📝 ${clipId}`);
    });
    
    if (clipsNeedingTranscription.length > 0) {
      console.log(`\n💡 You can test transcription with these clip IDs:`);
      clipsNeedingTranscription.forEach(clipId => {
        console.log(`  curl -X POST "https://clip-recap-pipeline.paulchrisluke.workers.dev/api/transcribe/${clipId}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error listing files:', error);
  }
}

// Run the test
listAudioFiles().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
