#!/usr/bin/env tsx

/**
 * Test script to list existing audio files in R2
 * 
 * This helps us identify what clips we can test transcription with.
 */

import { Environment } from './src/types/index.js';

// Mock environment for testing
const mockEnv = {
  R2_BUCKET: {
    list: async (options?: any) => {
      console.log(`📋 Mock R2 list called with options:`, options);
      
      // Simulate some audio files
      return {
        objects: [
          { key: 'audio/clip-123.wav', size: 1024000, uploaded: '2024-12-19T10:00:00Z' },
          { key: 'audio/clip-456.wav', size: 2048000, uploaded: '2024-12-19T11:00:00Z' },
          { key: 'audio/clip-789.wav', size: 1536000, uploaded: '2024-12-19T12:00:00Z' },
          { key: 'clips/clip-123.mp4', size: 5120000, uploaded: '2024-12-19T10:00:00Z' },
          { key: 'clips/clip-456.mp4', size: 10240000, uploaded: '2024-12-19T11:00:00Z' },
          { key: 'clips/clip-789.mp4', size: 7680000, uploaded: '2024-12-19T12:00:00Z' },
          { key: 'transcripts/clip-123.json', size: 2048, uploaded: '2024-12-19T10:30:00Z' },
          { key: 'transcripts/clip-456.json', size: 3072, uploaded: '2024-12-19T11:30:00Z' }
        ],
        truncated: false
      };
    }
  }
} as any;

async function listAudioFiles() {
  console.log('🔍 Listing audio files in R2...\n');
  
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
