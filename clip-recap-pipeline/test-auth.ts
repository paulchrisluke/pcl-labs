#!/usr/bin/env -S npx tsx

/**
 * Test script for HMAC authentication middleware
 * 
 * Tests the requireHmacAuth middleware and Authorization header rejection
 */

// Load environment variables from .dev.vars if it exists
import { readFileSync } from 'fs';
import { join } from 'path';

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
=======
#!/usr/bin/env -S npx tsx

/**
 * Test script for HMAC authentication middleware
 * 
 * Tests the requireHmacAuth middleware and Authorization header rejection
 */

// Load environment variables from .dev.vars if it exists
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const devVarsPath = join(process.cwd(), '.dev.vars');
  const devVarsContent = readFileSync(devVarsPath, 'utf8');
  
  devVarsContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  });
  
  console.log('✅ Loaded environment variables from .dev.vars');
} catch (error) {
  console.log('⚠️ Could not load .dev.vars, using existing environment variables');
}

const WORKER_URL = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

/**
 * Create HMAC signature for request authentication
 */
async function createSignature(body: string, timestamp: string, nonce: string): Promise<string> {
  const hmacSecret = process.env.HMAC_SHARED_SECRET;
  if (!hmacSecret) {
    throw new Error('HMAC_SHARED_SECRET not configured');
  }

  // Create signature payload: body + timestamp + nonce
  const payload = `${body}${timestamp}${nonce}`;
  
  // Create HMAC signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(hmacSecret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create security headers for API requests
 */
async function createSecurityHeaders(body: string = ''): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 18) + 'extra123'; // Ensure at least 16 chars
  const signature = await createSignature(body, timestamp, nonce);
  
  return {
    'x-request-signature': signature,
    'x-request-timestamp': timestamp,
    'x-request-nonce': nonce,
    'content-type': 'application/json'
  };
}

/**
 * Test HMAC authentication with Authorization header rejection
 */
async function testAuthHeaderRejection() {
  console.log('\n🧪 Testing Authorization header rejection...');
  
  try {
    // Test 1: Request with only Authorization header (should be rejected)
    const authOnlyRequest = new Request(`${WORKER_URL}/api/twitch/clips`, {
      method: 'GET',
      headers: {
        'authorization': 'Bearer test-token',
        'content-type': 'application/json'
      }
    });
    
    const authOnlyResponse = await fetch(authOnlyRequest);
    console.log(`📊 Authorization-only request status: ${authOnlyResponse.status}`);
    
    if (authOnlyResponse.status === 401) {
      console.log('✅ Authorization header correctly rejected with 401');
    } else {
      console.log(`❌ Expected 401, got ${authOnlyResponse.status}`);
      const responseText = await authOnlyResponse.text();
      console.log(`Response: ${responseText}`);
    }
    
    // Test 2: Request with both Authorization and HMAC headers (should be rejected)
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 18) + 'extra123'; // Ensure at least 16 chars
    const signature = await createSignature('', timestamp, nonce);
    
    const bothHeadersRequest = new Request(`${WORKER_URL}/api/twitch/clips`, {
      method: 'GET',
      headers: {
        'authorization': 'Bearer test-token',
        'x-request-signature': signature,
        'x-request-timestamp': timestamp,
        'x-request-nonce': nonce,
        'content-type': 'application/json'
      }
    });
    
    const bothHeadersResponse = await fetch(bothHeadersRequest);
    console.log(`📊 Both headers request status: ${bothHeadersResponse.status}`);
    
    if (bothHeadersResponse.status === 401) {
      console.log('✅ Request with both headers correctly rejected with 401');
    } else {
      console.log(`❌ Expected 401, got ${bothHeadersResponse.status}`);
      const responseText = await bothHeadersResponse.text();
      console.log(`Response: ${responseText}`);
    }
    
    // Test 3: Request with only HMAC headers (should succeed if HMAC is valid)
    const hmacHeaders = await createSecurityHeaders();
    const hmacOnlyRequest = new Request(`${WORKER_URL}/api/twitch/clips`, {
      method: 'GET',
      headers: hmacHeaders
    });
    
    const hmacOnlyResponse = await fetch(hmacOnlyRequest);
    console.log(`📊 HMAC-only request status: ${hmacOnlyResponse.status}`);
    
    if (hmacOnlyResponse.status === 200 || hmacOnlyResponse.status === 404) {
      console.log('✅ HMAC-only request processed (status indicates HMAC validation passed)');
    } else if (hmacOnlyResponse.status === 401) {
      console.log('⚠️ HMAC-only request failed with 401 (HMAC validation failed)');
      const responseText = await hmacOnlyResponse.text();
      console.log(`Response: ${responseText}`);
    } else {
      console.log(`📊 HMAC-only request status: ${hmacOnlyResponse.status}`);
      const responseText = await hmacOnlyResponse.text();
      console.log(`Response: ${responseText}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Test specific endpoint that uses HMAC authentication
 */
async function testHmacProtectedEndpoint() {
  console.log('\n🧪 Testing HMAC-protected endpoint...');
  
  try {
    // Test with valid HMAC headers
    const hmacHeaders = await createSecurityHeaders();
    const request = new Request(`${WORKER_URL}/api/twitch/clips`, {
      method: 'GET',
      headers: hmacHeaders
    });
    
    const response = await fetch(request);
    console.log(`📊 HMAC-protected endpoint status: ${response.status}`);
    
    if (response.status === 200 || response.status === 404) {
      console.log('✅ HMAC authentication successful');
    } else {
      console.log(`⚠️ HMAC authentication failed with status: ${response.status}`);
      const responseText = await response.text();
      console.log(`Response: ${responseText}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting HMAC Authentication Tests');
  console.log(`📍 Testing against: ${WORKER_URL}`);
  
  await testAuthHeaderRejection();
  await testHmacProtectedEndpoint();
  
  console.log('\n✅ HMAC Authentication Tests Complete');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
>>>>>>> main
