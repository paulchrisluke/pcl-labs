#!/usr/bin/env tsx

/**
 * Test Content Generation API
 * Tests the new content generation endpoints
 */

const WORKER_URL = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

// Test HMAC signature generation
async function generateHmacSignature(body: string, timestamp: string, nonce: string, secret: string): Promise<string> {
  const payload = `${body}${timestamp}${nonce}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
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

async function testContentAPI() {
  console.log('🧪 Testing Content Generation API...');
  console.log(`📡 Testing against: ${WORKER_URL}`);
  console.log('');

  const secret = process.env.HMAC_SHARED_SECRET || 'test-secret';

  // Test 1: Content Status
  console.log('1️⃣ Testing content status endpoint...');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 18);
    const statusBody = '';
    const statusSignature = await generateHmacSignature(statusBody, timestamp, nonce, secret);
    
    const statusResponse = await fetch(`${WORKER_URL}/api/content/status`, {
      method: 'GET',
      headers: {
        'X-Request-Signature': statusSignature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
      },
    });

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ Content status endpoint working!');
      console.log('📊 Status data:', JSON.stringify(statusData, null, 2));
    } else {
      console.log(`❌ Content status failed: ${statusResponse.status} ${statusResponse.statusText}`);
    }
  } catch (error) {
    console.log('❌ Content status error:', error);
  }
  console.log('');

  // Test 2: Migration Status
  console.log('2️⃣ Testing migration status endpoint...');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 18);
    const migrationBody = '';
    const migrationSignature = await generateHmacSignature(migrationBody, timestamp, nonce, secret);
    
    const migrationResponse = await fetch(`${WORKER_URL}/api/content/migration-status`, {
      method: 'GET',
      headers: {
        'X-Request-Signature': migrationSignature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
      },
    });

    if (migrationResponse.ok) {
      const migrationData = await migrationResponse.json();
      console.log('✅ Migration status endpoint working!');
      console.log('📊 Migration data:', JSON.stringify(migrationData, null, 2));
    } else {
      console.log(`❌ Migration status failed: ${migrationResponse.status} ${migrationResponse.statusText}`);
    }
  } catch (error) {
    console.log('❌ Migration status error:', error);
  }
  console.log('');

  // Test 3: Content Generation Request
  console.log('3️⃣ Testing content generation endpoint...');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 18);
    
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
    const generationSignature = await generateHmacSignature(generationBody, timestamp, nonce, secret);
    
    const generationResponse = await fetch(`${WORKER_URL}/api/content/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Signature': generationSignature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
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
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.random().toString(36).substring(2, 18);
        const runId = generationData.data.run_id;
        const runBody = '';
        const runSignature = await generateHmacSignature(runBody, timestamp, nonce, secret);
        
        const runResponse = await fetch(`${WORKER_URL}/api/runs/${runId}`, {
          method: 'GET',
          headers: {
            'X-Request-Signature': runSignature,
            'X-Request-Timestamp': timestamp,
            'X-Request-Nonce': nonce,
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
  } catch (error) {
    console.log('❌ Content generation error:', error);
  }
  console.log('');

  // Test 5: List Content Items
  console.log('5️⃣ Testing content items listing endpoint...');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 18);
    const listBody = '';
    const listSignature = await generateHmacSignature(listBody, timestamp, nonce, secret);
    
    const listResponse = await fetch(`${WORKER_URL}/api/content/items?limit=5`, {
      method: 'GET',
      headers: {
        'X-Request-Signature': listSignature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
      },
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      console.log('✅ Content items listing endpoint working!');
      console.log('📊 List data:', JSON.stringify(listData, null, 2));
    } else {
      console.log(`❌ Content items listing failed: ${listResponse.status} ${listResponse.statusText}`);
    }
  } catch (error) {
    console.log('❌ Content items listing error:', error);
  }
  console.log('');

  // Test 6: Manifest Builder
  console.log('6️⃣ Testing manifest builder endpoint...');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 18);
    const manifestRequest = {
      date: '2024-01-01',
      timezone: 'UTC'
    };

    const manifestBody = JSON.stringify(manifestRequest);
    const manifestSignature = await generateHmacSignature(manifestBody, timestamp, nonce, secret);
    
    const manifestResponse = await fetch(`${WORKER_URL}/api/content/manifest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Signature': manifestSignature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
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
  } catch (error) {
    console.log('❌ Manifest builder error:', error);
  }
  console.log('');

  // Test 7: Blog Generator
  console.log('7️⃣ Testing blog generator endpoint...');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 18);
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
          start_s: 0,
          end_s: 60,
        }],
        canonical_vod: 'https://twitch.tv/test',
        md_path: 'content/blog/development/2024-01-01-test.md',
        target_branch: 'staging',
        status: 'draft',
      },
      store: false
    };

    const blogBody = JSON.stringify(blogRequest);
    const blogSignature = await generateHmacSignature(blogBody, timestamp, nonce, secret);
    
    const blogResponse = await fetch(`${WORKER_URL}/api/content/blog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Signature': blogSignature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
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
  } catch (error) {
    console.log('❌ Blog generator error:', error);
  }
  console.log('');

  // Test 8: AI Judge
  console.log('8️⃣ Testing AI judge endpoint...');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 18);
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
          start_s: 0,
          end_s: 60,
        }],
        canonical_vod: 'https://twitch.tv/test',
        md_path: 'content/blog/development/2024-01-01-test.md',
        target_branch: 'staging',
        status: 'draft',
      }
    };

    const judgeBody = JSON.stringify(judgeRequest);
    const judgeSignature = await generateHmacSignature(judgeBody, timestamp, nonce, secret);
    
    const judgeResponse = await fetch(`${WORKER_URL}/api/content/judge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Signature': judgeSignature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
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
