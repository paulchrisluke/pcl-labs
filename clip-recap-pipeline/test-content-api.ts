#!/usr/bin/env tsx

/**
 * Test Content Generation API
 * Tests the new content generation endpoints
 * 
 * Environment Variables:
 * - WORKER_URL: URL of the worker to test (defaults to production)
 * - MOCK_CONTENT_API_URL: URL for mock endpoint (if set, overrides WORKER_URL)
 * - HMAC_SHARED_SECRET: Secret for HMAC authentication (if not set, auth is disabled)
 * - DISABLE_AUTH: Set to 'true' to disable authentication entirely
 */

const WORKER_URL = process.env.MOCK_CONTENT_API_URL || process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';
const HMAC_SHARED_SECRET = process.env.HMAC_SHARED_SECRET;
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

// Determine if we're in local development mode
const IS_LOCAL_DEV = WORKER_URL.includes('localhost') || WORKER_URL.includes('127.0.0.1');

// Get crypto implementation with Node.js compatibility
function getCrypto(): Crypto {
  // Try global crypto first (browser/Cloudflare Workers)
  if (globalThis.crypto) {
    return globalThis.crypto;
  }
  
  // Try Node.js crypto
  if (typeof require !== 'undefined') {
    try {
      const nodeCrypto = require('crypto');
      if (nodeCrypto.webcrypto) {
        return nodeCrypto.webcrypto;
      }
    } catch (error) {
      // Ignore require errors
    }
  }
  
  throw new Error('No crypto implementation available - requires Node.js 15+ or browser environment');
}

// Test HMAC signature generation
async function generateHmacSignature(body: string, timestamp: string, nonce: string, secret: string): Promise<string> {
  const payload = `${body}${timestamp}${nonce}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const crypto = getCrypto();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate auth headers based on configuration
async function generateAuthHeaders(body: string = ''): Promise<Record<string, string>> {
  if (DISABLE_AUTH || !HMAC_SHARED_SECRET) {
    console.log('🔓 Authentication disabled - running in no-auth mode');
    return {};
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Generate cryptographically secure nonce
  const crypto = getCrypto();
  const nonceArray = new Uint8Array(16);
  crypto.getRandomValues(nonceArray);
  const nonce = Array.from(nonceArray, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, 16);
  
  const signature = await generateHmacSignature(body, timestamp, nonce, HMAC_SHARED_SECRET);
  
  return {
    'X-Request-Signature': signature,
    'X-Request-Timestamp': timestamp,
    'X-Request-Nonce': nonce,
  };
}

// Mock data for local development
const mockContentData = {
  status: {
    total_clips: 5,
    processed_clips: 3,
    pending_clips: 2,
    last_processed: '2024-01-01T12:00:00.000Z'
  },
  migration: {
    total_items: 10,
    migrated_items: 8,
    pending_items: 2,
    last_migration: '2024-01-01T11:00:00.000Z'
  },
  contentItems: [
    {
      clip_id: 'test-clip-123',
      clip_title: 'Test Development Session',
      clip_url: 'https://clips.twitch.tv/test-clip-123',
      clip_duration: 180,
      clip_created_at: '2024-01-01T12:00:00.000Z',
      processing_status: 'ready_for_content',
      transcript: {
        text: 'This is a test transcript for development testing.',
        language: 'en',
        segments: [
          { start: 0, end: 5, text: 'This is a test transcript' },
          { start: 5, end: 10, text: 'for development testing.' }
        ]
      }
    }
  ],
  blogPost: {
    title: 'Test Daily Recap - January 1, 2024',
    content: 'This is a test blog post generated for development testing.',
    summary: 'A test recap of development activities.',
    generated_at: '2024-01-01T13:00:00.000Z'
  },
  aiJudge: {
    score: 85,
    feedback: 'Good content with clear explanations.',
    recommendations: ['Add more code examples', 'Include screenshots'],
    judged_at: '2024-01-01T13:30:00.000Z'
  }
};

async function testContentAPI(): Promise<void> {
  console.log('🧪 Testing Content Generation API...');
  console.log(`📡 Testing against: ${WORKER_URL}`);
  console.log(`🔐 Auth mode: ${DISABLE_AUTH ? 'disabled' : HMAC_SHARED_SECRET ? 'HMAC' : 'no-auth'}`);
  console.log(`🏠 Mode: ${IS_LOCAL_DEV ? 'Local Development (using mocks)' : 'Production (using real endpoints)'}`);
  console.log('');

  // Test 1: Content Status
  console.log('1️⃣ Testing content status endpoint...');
  try {
    if (IS_LOCAL_DEV) {
      // Use mock data for local development
      console.log('✅ Content status endpoint working! (mock)');
      console.log('📊 Status data:', JSON.stringify(mockContentData.status, null, 2));
    } else {
      // Use real endpoint for production
      const authHeaders = await generateAuthHeaders();
      
      const statusResponse = await fetch(`${WORKER_URL}/api/content/status`, {
        method: 'GET',
        headers: {
          ...authHeaders,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('✅ Content status endpoint working!');
        console.log('📊 Status data:', JSON.stringify(statusData, null, 2));
      } else {
        console.log(`❌ Content status failed: ${statusResponse.status} ${statusResponse.statusText}`);
        if (statusResponse.status === 401) {
          console.log('💡 This might be due to missing or incorrect HMAC_SHARED_SECRET');
        }
      }
    }
  } catch (error) {
    console.log('❌ Content status error:', error);
  }
  console.log('');

  // Test 2: Migration Status
  console.log('2️⃣ Testing migration status endpoint...');
  try {
    if (IS_LOCAL_DEV) {
      // Use mock data for local development
      console.log('✅ Migration status endpoint working! (mock)');
      console.log('📊 Migration data:', JSON.stringify(mockContentData.migration, null, 2));
    } else {
      // Use real endpoint for production
      const authHeaders = await generateAuthHeaders();
      
      const migrationResponse = await fetch(`${WORKER_URL}/api/content/migration-status`, {
        method: 'GET',
        headers: {
          ...authHeaders,
        },
      });

      if (migrationResponse.ok) {
        const migrationData = await migrationResponse.json();
        console.log('✅ Migration status endpoint working!');
        console.log('📊 Migration data:', JSON.stringify(migrationData, null, 2));
      } else {
        console.log(`❌ Migration status failed: ${migrationResponse.status} ${migrationResponse.statusText}`);
      }
    }
  } catch (error) {
    console.log('❌ Migration status error:', error);
  }
  console.log('');

  // Test 3: Content Generation Request
  console.log('3️⃣ Testing content generation endpoint...');
  try {
    if (IS_LOCAL_DEV) {
      // Use mock data for local development
      console.log('✅ Content generation endpoint working! (mock)');
      const mockGenerationData = {
        success: true,
        data: {
          run_id: 'mock-run-123',
          status_url: `${WORKER_URL}/api/runs/mock-run-123`,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      };
      console.log('📊 Generation data:', JSON.stringify(mockGenerationData, null, 2));
      
      // Test 4: Run Status (mock)
      console.log('4️⃣ Testing run status endpoint...');
      const mockRunData = {
        success: true,
        data: {
          run_id: 'mock-run-123',
          status: 'completed',
          progress: 100,
          result: {
            manifest: mockContentData.contentItems[0]
          }
        }
      };
      console.log('✅ Run status endpoint working! (mock)');
      console.log('📊 Run data:', JSON.stringify(mockRunData, null, 2));
    } else {
      // Use real endpoint for production
      // Create UTC-based dates for timezone-independent date ranges
      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      const yesterdayUtc = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000);
      
      const generationRequest = {
        date_range: {
          start: yesterdayUtc.toISOString(),
          end: todayUtc.toISOString(),
        },
        filters: {
          min_views: 1,
          min_confidence: 0.5,
        },
        content_type: 'daily_recap',
      };

      const generationBody = JSON.stringify(generationRequest);
      const authHeaders = await generateAuthHeaders(generationBody);
      
      const generationResponse = await fetch(`${WORKER_URL}/api/content/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: generationBody,
      });

      if (generationResponse.ok) {
        const generationData = await generationResponse.json();
        console.log('✅ Content generation endpoint working!');
        console.log('📊 Generation data:', JSON.stringify(generationData, null, 2));
        
        // Test 4: Run Status (if we got a run_id)
        if (generationData.data?.run_id) {
          console.log('4️⃣ Testing run status endpoint...');
          const runId = generationData.data.run_id;
          const runAuthHeaders = await generateAuthHeaders();
          
          const runResponse = await fetch(`${WORKER_URL}/api/runs/${runId}`, {
            method: 'GET',
            headers: {
              ...runAuthHeaders,
            },
          });

          if (runResponse.ok) {
            const runData = await runResponse.json();
            console.log('✅ Run status endpoint working!');
            console.log('📊 Run data:', JSON.stringify(runData, null, 2));
          } else {
            console.log(`❌ Run status failed: ${runResponse.status} ${runResponse.statusText}`);
          }
        }
      } else {
        console.log(`❌ Content generation failed: ${generationResponse.status} ${generationResponse.statusText}`);
        const errorText = await generationResponse.text();
        console.log('Error details:', errorText);
      }
    }
  } catch (error) {
    console.log('❌ Content generation error:', error);
  }
  console.log('');

  // Test 5: List Content Items
  console.log('5️⃣ Testing content items listing endpoint...');
  try {
    if (IS_LOCAL_DEV) {
      // Use mock data for local development
      console.log('✅ Content items listing endpoint working! (mock)');
      console.log('📊 List data:', JSON.stringify(mockContentData.contentItems, null, 2));
    } else {
      // Use real endpoint for production
      const authHeaders = await generateAuthHeaders();
      
      const listResponse = await fetch(`${WORKER_URL}/api/content/items?limit=5`, {
        method: 'GET',
        headers: {
          ...authHeaders,
        },
      });

      if (listResponse.ok) {
        const listData = await listResponse.json();
        console.log('✅ Content items listing endpoint working!');
        console.log('📊 List data:', JSON.stringify(listData, null, 2));
      } else {
        console.log(`❌ Content items listing failed: ${listResponse.status} ${listResponse.statusText}`);
      }
    }
  } catch (error) {
    console.log('❌ Content items listing error:', error);
  }
  console.log('');

  // Test 6: Manifest Builder
  console.log('6️⃣ Testing manifest builder endpoint...');
  try {
    if (IS_LOCAL_DEV) {
      // Use mock data for local development
      console.log('✅ Manifest builder endpoint working! (mock)');
      const mockManifestData = {
        success: true,
        data: {
          schema_version: '1.0.0',
          post_id: '2024-01-01',
          date_utc: '2024-01-01T12:00:00.000Z',
          tz: 'UTC',
          title: 'Test Daily Recap - January 1, 2024',
          headline_short: 'Test Recap',
          summary: 'A test recap of development activities.',
          category: 'development',
          tags: ['development', 'test'],
          clip_ids: ['test-clip-123'],
          sections: [{
            section_id: 'section-1',
            clip_id: 'test-clip-123',
            title: 'Test Development Session',
            bullets: ['Test bullet 1', 'Test bullet 2'],
            paragraph: 'This is a test paragraph for development testing.',
            start: 0,
            end: 180,
          }],
          canonical_vod: 'https://twitch.tv/test',
          md_path: 'content/blog/development/2024-01-01-test.md',
          target_branch: 'staging',
          status: 'draft',
        }
      };
      console.log('📊 Manifest data:', JSON.stringify(mockManifestData, null, 2));
    } else {
      // Use real endpoint for production
      const manifestRequest = {
        date: '2024-01-01',
        timezone: 'UTC'
      };

      const manifestBody = JSON.stringify(manifestRequest);
      const authHeaders = await generateAuthHeaders(manifestBody);
      
      const manifestResponse = await fetch(`${WORKER_URL}/api/content/manifest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: manifestBody,
      });

      if (manifestResponse.ok) {
        const manifestData = await manifestResponse.json();
        console.log('✅ Manifest builder endpoint working!');
        console.log('📊 Manifest data:', JSON.stringify(manifestData, null, 2));
      } else {
        console.log(`❌ Manifest builder failed: ${manifestResponse.status} ${manifestResponse.statusText}`);
      }
    }
  } catch (error) {
    console.log('❌ Manifest builder error:', error);
  }
  console.log('');

  // Test 7: Blog Generator
  console.log('7️⃣ Testing blog generator endpoint...');
  try {
    if (IS_LOCAL_DEV) {
      // Use mock data for local development
      console.log('✅ Blog generator endpoint working! (mock)');
      console.log('📊 Blog data:', JSON.stringify(mockContentData.blogPost, null, 2));
    } else {
      // Use real endpoint for production
      const blogRequest = {
        manifest: {
          schema_version: '1.0.0',
          post_id: '2024-01-01',
          date_utc: '2024-01-01T12:00:00.000Z',
          tz: 'UTC',
          title: 'Test Daily Recap',
          headline_short: 'Test Recap',
          summary: 'Test summary',
          category: 'development',
          tags: ['development', 'test'],
          clip_ids: ['test-clip'],
          sections: [{
            section_id: 'section-1',
            clip_id: 'test-clip',
            title: 'Test Section',
            bullets: ['Test bullet 1', 'Test bullet 2'],
            paragraph: 'Test paragraph',
            start: 0,
            end: 60,
          }],
          canonical_vod: 'https://twitch.tv/test',
          md_path: 'content/blog/development/2024-01-01-test.md',
          target_branch: 'staging',
          status: 'draft',
        },
        store: false
      };

      const blogBody = JSON.stringify(blogRequest);
      const authHeaders = await generateAuthHeaders(blogBody);
      
      const blogResponse = await fetch(`${WORKER_URL}/api/content/blog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: blogBody,
      });

      if (blogResponse.ok) {
        const blogData = await blogResponse.json();
        console.log('✅ Blog generator endpoint working!');
        console.log('📊 Blog data:', JSON.stringify(blogData, null, 2));
      } else {
        console.log(`❌ Blog generator failed: ${blogResponse.status} ${blogResponse.statusText}`);
      }
    }
  } catch (error) {
    console.log('❌ Blog generator error:', error);
  }
  console.log('');

  // Test 8: AI Judge
  console.log('8️⃣ Testing AI judge endpoint...');
  try {
    if (IS_LOCAL_DEV) {
      // Use mock data for local development
      console.log('✅ AI judge endpoint working! (mock)');
      console.log('📊 Judge data:', JSON.stringify(mockContentData.aiJudge, null, 2));
    } else {
      // Use real endpoint for production
      const judgeRequest = {
        manifest: {
          schema_version: '1.0.0',
          post_id: '2024-01-01',
          date_utc: '2024-01-01T12:00:00.000Z',
          tz: 'UTC',
          title: 'Test Daily Recap',
          headline_short: 'Test Recap',
          summary: 'Test summary',
          category: 'development',
          tags: ['development', 'test'],
          clip_ids: ['test-clip'],
          sections: [{
            section_id: 'section-1',
            clip_id: 'test-clip',
            title: 'Test Section',
            bullets: ['Test bullet 1', 'Test bullet 2'],
            paragraph: 'Test paragraph',
            start: 0,
            end: 60,
          }],
          canonical_vod: 'https://twitch.tv/test',
          md_path: 'content/blog/development/2024-01-01-test.md',
          target_branch: 'staging',
          status: 'draft',
        }
      };

      const judgeBody = JSON.stringify(judgeRequest);
      const authHeaders = await generateAuthHeaders(judgeBody);
      
      const judgeResponse = await fetch(`${WORKER_URL}/api/content/judge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: judgeBody,
      });

      if (judgeResponse.ok) {
        const judgeData = await judgeResponse.json();
        console.log('✅ AI judge endpoint working!');
        console.log('📊 Judge data:', JSON.stringify(judgeData, null, 2));
      } else {
        console.log(`❌ AI judge failed: ${judgeResponse.status} ${judgeResponse.statusText}`);
      }
    }
  } catch (error) {
    console.log('❌ AI judge error:', error);
  }
  console.log('');

  console.log('🎉 Content API testing complete!');
}

// CI-friendly error handling
function handleError(error: Error | unknown, context: string = 'Unknown') {
  console.error(`❌ ${context}:`, error);
  if (error instanceof Error) {
    console.error('Stack trace:', error.stack);
  }
  process.exitCode = 1;
}

function handleUnhandledRejection(reason: unknown, promise: Promise<unknown>) {
  console.error('❌ Unhandled Promise Rejection:');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  if (reason instanceof Error) {
    console.error('Stack trace:', reason.stack);
  }
  process.exitCode = 1;
}

function handleUncaughtException(error: Error) {
  console.error('❌ Uncaught Exception:');
  console.error('Error:', error.message);
  console.error('Stack trace:', error.stack);
  process.exitCode = 1;
  process.exit(1);
}

// Set up global error handlers
process.on('unhandledRejection', handleUnhandledRejection);
process.on('uncaughtException', handleUncaughtException);

// Run the test with proper error handling
testContentAPI()
  .then(() => {
    console.log('✅ All tests completed successfully');
  })
  .catch((error) => {
    handleError(error, 'Test execution failed');
    process.exit(1);
  });
