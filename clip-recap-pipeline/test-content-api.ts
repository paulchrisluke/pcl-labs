#!/usr/bin/env tsx

/**
 * Test Content Generation API
 * Tests the new content generation endpoints
 */

const WORKER_URL = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

// Test HMAC signature generation
function generateHmacSignature(body: string, timestamp: string, nonce: string, secret: string): string {
  const payload = `${body}${timestamp}${nonce}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(cryptoKey => 
    crypto.subtle.sign('HMAC', cryptoKey, messageData)
  ).then(signature => 
    Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

async function testContentAPI() {
  console.log('🧪 Testing Content Generation API...');
  console.log(`📡 Testing against: ${WORKER_URL}`);
  console.log('');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 18);
  const secret = process.env.HMAC_SHARED_SECRET || 'test-secret';

  // Test 1: Content Status
  console.log('1️⃣ Testing content status endpoint...');
  try {
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
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const generationRequest = {
      date_range: {
        start: yesterday.toISOString(),
        end: today.toISOString(),
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

  console.log('🎉 Content API testing complete!');
}

// Run the test
testContentAPI().catch(console.error);
