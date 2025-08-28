// Authentication test for Cloudflare Workers
// This test verifies that endpoints requiring authentication are properly protected
// Run with: npx tsx test-auth.ts

import crypto from 'crypto';

async function generateHmacSignature(body: string, timestamp: string, nonce: string, secret: string): Promise<string> {
  const payload = `${body}${timestamp}${nonce}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

async function testAuthentication() {
  const workerUrl = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';
  const hmacSecret = process.env.HMAC_SHARED_SECRET;
  
  if (!hmacSecret) {
    console.error('❌ HMAC_SHARED_SECRET environment variable is required');
    console.log('💡 Set it with: export HMAC_SHARED_SECRET="your-secret"');
    process.exit(1);
  }
  
  console.log('🔐 Testing authentication on protected endpoints...');
  console.log(`📡 Testing against: ${workerUrl}`);
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Test 1: Test without authentication (should fail)
  console.log('\n🧪 Test 1: Request without authentication (should fail)');
  try {
    const response = await fetch(`${workerUrl}/validate-twitch`);
    if (response.status === 401) {
      console.log('✅ Authentication required - endpoint properly protected');
    } else {
      console.log(`❌ Expected 401, got ${response.status} - endpoint not protected`);
    }
  } catch (error) {
    console.log('❌ Request failed:', error);
  }
  
  // Test 2: Test with authentication (should succeed)
  console.log('\n🧪 Test 2: Request with authentication (should succeed)');
  try {
    const signature = await generateHmacSignature('', timestamp, nonce, hmacSecret);
    
    const response = await fetch(`${workerUrl}/validate-twitch`, {
      headers: {
        'X-Request-Signature': signature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
      }
    });
    
    if (response.ok) {
      console.log('✅ Authentication successful - endpoint accessible');
      const result = await response.json();
      console.log(`📊 Response: ${result.success ? 'Success' : 'Failed'}`);
    } else {
      console.log(`❌ Authentication failed - got ${response.status}`);
      const errorText = await response.text();
      console.log(`📄 Error: ${errorText}`);
    }
  } catch (error) {
    console.log('❌ Request failed:', error);
  }
  
  // Test 3: Test with invalid signature (should fail)
  console.log('\n🧪 Test 3: Request with invalid signature (should fail)');
  try {
    const invalidSignature = 'invalid-signature';
    
    const response = await fetch(`${workerUrl}/validate-twitch`, {
      headers: {
        'X-Request-Signature': invalidSignature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
      }
    });
    
    if (response.status === 401) {
      console.log('✅ Invalid signature rejected - authentication working');
    } else {
      console.log(`❌ Expected 401, got ${response.status} - invalid signature not rejected`);
    }
  } catch (error) {
    console.log('❌ Request failed:', error);
  }
  
  // Test 4: Test POST endpoint with body
  console.log('\n🧪 Test 4: POST request with body authentication');
  try {
    const body = JSON.stringify({ test: 'data' });
    const newTimestamp = Math.floor(Date.now() / 1000).toString();
    const newNonce = crypto.randomBytes(16).toString('hex');
    const signature = await generateHmacSignature(body, newTimestamp, newNonce, hmacSecret);
    
    const response = await fetch(`${workerUrl}/api/twitch/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Signature': signature,
        'X-Request-Timestamp': newTimestamp,
        'X-Request-Nonce': newNonce,
      },
      body: body
    });
    
    if (response.status === 400) {
      console.log('✅ POST authentication successful - got expected validation error');
    } else if (response.status === 401) {
      console.log('❌ POST authentication failed');
    } else {
      console.log(`📊 POST response: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ POST request failed:', error);
  }
  
  console.log('\n🎉 Authentication tests completed!');
}

testAuthentication().catch(console.error);
