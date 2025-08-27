#!/usr/bin/env -S npx tsx

/**
 * Test script for Cloudflare Whisper transcription functionality
 * 
 * This script tests the transcription service using Workers AI
 * and verifies the complete transcription pipeline.
 */

import { TranscriptionService } from './src/services/transcribe.js';

// In-memory R2 store for testing
const r2Store = new Map<string, { data: Uint8Array; size: number; uploaded: string }>();

// Initialize with test audio files
const mockAudioData = new Uint8Array(1024); // 1KB mock audio
r2Store.set('audio/test-clip-123.wav', {
  data: mockAudioData,
  size: mockAudioData.length,
  uploaded: new Date().toISOString()
});
r2Store.set('audio/test-clip-1.wav', {
  data: mockAudioData,
  size: mockAudioData.length,
  uploaded: new Date().toISOString()
});
r2Store.set('audio/test-clip-2.wav', {
  data: mockAudioData,
  size: mockAudioData.length,
  uploaded: new Date().toISOString()
});
r2Store.set('audio/test-clip-3.wav', {
  data: mockAudioData,
  size: mockAudioData.length,
  uploaded: new Date().toISOString()
});

// Mock environment for testing
const mockEnv = {
  ai: {
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
  },
  R2_BUCKET: {
    get: async (key: string) => {
      console.log(`📥 Mock R2 get: ${key}`);
      
      const stored = r2Store.get(key);
      if (!stored) {
        return null;
      }
      
      // Return object with body that exposes arrayBuffer() method and json() method
      return {
        body: {
          arrayBuffer: async () => stored.data.buffer.slice(
            stored.data.byteOffset,
            stored.data.byteOffset + stored.data.byteLength
          )
        },
        size: stored.size,
        json: async () => {
          // Try to parse as JSON if it's a string, otherwise return the data
          const text = new TextDecoder().decode(stored.data);
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        }
      };
    },
    put: async (key: string, data: string | Uint8Array, options?: any) => {
      console.log(`📤 Mock R2 put: ${key}`);
      console.log(`📄 Data type: ${typeof data}`);
      
      let uint8Data: Uint8Array;
      if (typeof data === 'string') {
        uint8Data = new TextEncoder().encode(data);
      } else {
        uint8Data = data;
      }
      
      console.log(`📏 Data size: ${uint8Data.length} bytes`);
      
      // Store the data in our in-memory Map
      r2Store.set(key, {
        data: uint8Data,
        size: uint8Data.length,
        uploaded: new Date().toISOString()
      });
      
      return { ok: true };
    },
    head: async (key: string) => {
      console.log(`🔍 Mock R2 head: ${key}`);
      
      const stored = r2Store.get(key);
      if (!stored) {
        return null;
      }
      
      return {
        size: stored.size,
        uploaded: stored.uploaded,
        ok: true
      };
    }
  }
} as any;

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
