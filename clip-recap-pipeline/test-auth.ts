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
    if (line.includes('=')) {
      const firstEqualsIndex = line.indexOf('=');
      const key = line.substring(0, firstEqualsIndex);
      const value = line.substring(firstEqualsIndex + 1);
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
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
 * Test blog generation endpoint specifically
 */
async function testBlogGenerationEndpoint() {
  console.log('\n🧪 Testing blog generation endpoint...');
  
  try {
    const body = JSON.stringify({
      date_range: {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-02T00:00:00Z'
      },
      content_type: 'daily_recap'
    });
    
    const hmacHeaders = await createSecurityHeaders(body);
    const request = new Request(`${WORKER_URL}/api/content/generate`, {
      method: 'POST',
      headers: hmacHeaders,
      body: body
    });
    
    const response = await fetch(request);
    console.log(`📊 Blog generation endpoint status: ${response.status}`);
    
    if (response.status === 200 || response.status === 400) {
      console.log('✅ Blog generation HMAC authentication successful');
      if (response.status === 400) {
        const responseText = await response.text();
        console.log(`📄 Response: ${responseText}`);
      }
    } else {
      console.log(`⚠️ Blog generation HMAC authentication failed with status: ${response.status}`);
      const responseText = await response.text();
      console.log(`Response: ${responseText}`);
    }
    
  } catch (error) {
    console.error('❌ Blog generation test failed:', error);
  }
}

/**
 * Test content generation endpoint with different scenarios
 */
async function testContentGenerationScenarios() {
  console.log('\n🧪 Testing content generation scenarios...');
  
  const scenarios = [
    {
      name: 'Daily Recap',
      body: {
        date_range: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-02T00:00:00Z'
        },
        content_type: 'daily_recap'
      }
    },
    {
      name: 'Weekly Summary',
      body: {
        date_range: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-08T00:00:00Z'
        },
        content_type: 'weekly_summary'
      }
    },
    {
      name: 'Topic Focus',
      body: {
        date_range: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-15T00:00:00Z'
        },
        content_type: 'topic_focus',
        repository: 'paulchrisluke/pcl-labs'
      }
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n📝 Testing: ${scenario.name}`);
    try {
      const body = JSON.stringify(scenario.body);
      const hmacHeaders = await createSecurityHeaders(body);
      const request = new Request(`${WORKER_URL}/api/content/generate`, {
        method: 'POST',
        headers: hmacHeaders,
        body: body
      });
      
      const response = await fetch(request);
      console.log(`📊 Status: ${response.status}`);
      
      if (response.status === 200 || response.status === 400) {
        console.log('✅ HMAC authentication successful');
        if (response.status === 400) {
          const responseText = await response.text();
          console.log(`📄 Response: ${responseText.substring(0, 200)}...`);
        }
      } else {
        console.log(`⚠️ HMAC authentication failed`);
        const responseText = await response.text();
        console.log(`Response: ${responseText}`);
      }
    } catch (error) {
      console.error(`❌ ${scenario.name} test failed:`, error);
    }
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
  await testBlogGenerationEndpoint();
  await testContentGenerationScenarios();
  
  console.log('\n✅ HMAC Authentication Tests Complete');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
