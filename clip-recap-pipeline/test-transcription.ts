#!/usr/bin/env -S npx tsx

/**
 * Test script for Cloudflare Whisper transcription functionality
 * 
 * This script tests the transcription service using Workers AI
 * and verifies the complete transcription pipeline.
 */

import { TranscriptionService } from './src/services/transcribe.js';
import { createMockEnvironment } from './src/utils/mock-r2.js';
import type { MockR2Bucket } from './src/utils/mock-r2.js';

// Helper function to create a minimal valid 16-bit PCM WAV file
function createMinimalWAV(): Uint8Array {
  // WAV file structure:
  // RIFF header (12 bytes) + fmt chunk (24 bytes) + data chunk (8 + data bytes)
  const sampleRate = 16000;
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  
  // Create a short silence frame (0.1 seconds of silence)
  const durationSeconds = 0.1;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * channels * (bitsPerSample / 8);
  
  // Total file size: 12 (RIFF) + 24 (fmt) + 8 (data header) + dataSize
  const fileSize = 12 + 24 + 8 + dataSize;
  
  // Create the WAV file buffer
  const buffer = new ArrayBuffer(44 + dataSize); // 44 bytes header + data
  const view = new DataView(buffer);
  
  // RIFF header (12 bytes)
  view.setUint32(0, 0x52494646, false); // "RIFF" (big-endian)
  view.setUint32(4, fileSize - 8, true); // File size - 8 (little-endian)
  view.setUint32(8, 0x57415645, false); // "WAVE" (big-endian)
  
  // fmt chunk (24 bytes)
  view.setUint32(12, 0x666D7420, false); // "fmt " (big-endian)
  view.setUint32(16, 16, true); // fmt chunk size (16 for PCM)
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, channels, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, byteRate, true); // Byte rate
  view.setUint16(32, blockAlign, true); // Block align
  view.setUint16(34, bitsPerSample, true); // Bits per sample
  
  // data chunk (8 + data bytes)
  view.setUint32(36, 0x64617461, false); // "data" (big-endian)
  view.setUint32(40, dataSize, true); // Data size
  
  // Fill data section with silence (16-bit samples = 0)
  // Data starts at byte 44
  for (let i = 44; i < 44 + dataSize; i += 2) {
    view.setInt16(i, 0, true); // 16-bit signed integer, little-endian
  }
  
  return new Uint8Array(buffer);
}

// Create mock environment with improved R2 implementation
const mockEnv = createMockEnvironment();

// Initialize with test audio files using valid WAV data
const mockAudioData = createMinimalWAV();
const r2Bucket = mockEnv.R2_BUCKET as MockR2Bucket;

// Pre-populate the mock R2 bucket with test audio files
await r2Bucket.put('audio/test-clip-123.wav', mockAudioData, {
  httpMetadata: { contentType: 'audio/wav' }
});
await r2Bucket.put('audio/test-clip-1.wav', mockAudioData, {
  httpMetadata: { contentType: 'audio/wav' }
});
await r2Bucket.put('audio/test-clip-2.wav', mockAudioData, {
  httpMetadata: { contentType: 'audio/wav' }
});
await r2Bucket.put('audio/test-clip-3.wav', mockAudioData, {
  httpMetadata: { contentType: 'audio/wav' }
});

// Add mock AI service
mockEnv.ai = {
  run: async (model: string, options: any) => {
    console.log(`🤖 Mock AI run called with model: ${model}`);
    console.log(`📊 Audio data size: ${options.audio?.length || 0} bytes`);
    
    // Simulate Whisper response
    return {
      text: "This is a test transcription of the audio content. It includes multiple sentences to test the transcription pipeline.",
      language: "en",
      segments: [
        {
          start: 0,
          end: 2.5,
          text: "This is a test transcription"
        },
        {
          start: 2.5,
          end: 5.0,
          text: "of the audio content."
        },
        {
          start: 5.0,
          end: 8.0,
          text: "It includes multiple sentences to test the transcription pipeline."
        }
      ]
    };
  }
};

async function testTranscriptionService() {
  console.log('🧪 Testing Transcription Service...\n');
  
  const transcriptionService = new TranscriptionService(mockEnv);
  
  // Test 1: Single clip transcription
  console.log('📝 Test 1: Single clip transcription');
  console.log('=' .repeat(50));
  
  const testClipId = 'test-clip-123';
  const transcript = await transcriptionService.transcribeClip(testClipId);
  
  if (transcript) {
    console.log('✅ Transcription successful!');
    console.log(`📊 Clip ID: ${transcript.clip_id}`);
    console.log(`🎤 Model: ${transcript.model}`);
    console.log(`🌍 Language: ${transcript.language}`);
    console.log(`📝 Text: ${transcript.text}`);
    console.log(`🔢 Segments: ${transcript.segments.length}`);
    console.log(`🔒 Redacted: ${transcript.redacted}`);
    
    // Show segments
    transcript.segments.forEach((segment, index) => {
      console.log(`  ${index + 1}. [${segment.start}s - ${segment.end}s]: ${segment.text}`);
    });
  } else {
    console.log('❌ Transcription failed');
  }
  
  console.log('\n');
  
  // Test 2: Batch transcription
  console.log('📝 Test 2: Batch transcription');
  console.log('=' .repeat(50));
  
  const testClipIds = ['test-clip-1', 'test-clip-2', 'test-clip-3'];
  const batchResults = await transcriptionService.transcribeClips(testClipIds);
  
  console.log(`📊 Batch Results:`);
  console.log(`  Total: ${batchResults.total}`);
  console.log(`  Successful: ${batchResults.successful}`);
  console.log(`  Failed: ${batchResults.failed}`);
  
  batchResults.results.forEach(result => {
    console.log(`  ${result.clipId}: ${result.success ? '✅' : '❌'} ${result.error || ''}`);
  });
  
  console.log('\n');
  
  // Test 3: Transcript retrieval
  console.log('📝 Test 3: Transcript retrieval');
  console.log('=' .repeat(50));
  
  const retrievedTranscript = await transcriptionService.getTranscript(testClipId);
  if (retrievedTranscript) {
    console.log('✅ Transcript retrieved successfully');
    console.log(`📝 Text: ${retrievedTranscript.text.substring(0, 100)}...`);
  } else {
    console.log('❌ Transcript retrieval failed');
  }
  
  console.log('\n');
  
  // Test 4: Transcript existence check
  console.log('📝 Test 4: Transcript existence check');
  console.log('=' .repeat(50));
  
  const hasTranscript = await transcriptionService.hasTranscript(testClipId);
  console.log(`Has transcript for ${testClipId}: ${hasTranscript ? '✅ Yes' : '❌ No'}`);
  
  console.log('\n');
  
  // Test 5: Text redaction
  console.log('📝 Test 5: Text redaction');
  console.log('=' .repeat(50));
  
  const testText = `
    My email is test@example.com and my IP is 192.168.1.1.
    My API key is abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567.
    Check out https://example.com/password/reset for password reset.
    Database connection: postgresql://user:pass@localhost:5432/db
    Environment variable: SECRET_KEY="super-secret-key-123"
  `;
  
  const redactedText = (transcriptionService as any).redactText(testText);
  console.log('Original text:');
  console.log(testText);
  console.log('\nRedacted text:');
  console.log(redactedText);
  
  console.log('\n');
  
  // Test 6: VTT conversion
  console.log('📝 Test 6: VTT conversion');
  console.log('=' .repeat(50));
  
  const testSegments = [
    { start: 0, end: 2.5, text: "Hello world" },
    { start: 2.5, end: 5.0, text: "This is a test" },
    { start: 5.0, end: 8.0, text: "Of VTT conversion" }
  ];
  
  const vttContent = (transcriptionService as any).toVTT(testSegments);
  console.log('VTT Content:');
  console.log(vttContent);
  
  console.log('\n');
  console.log('🎉 All transcription tests completed!');
}

// Run tests
testTranscriptionService().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
