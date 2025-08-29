#!/usr/bin/env tsx

/**
 * Test Production Blog Debug
 * Debug the full response from production blog generation
 */

// Load environment variables from .dev.vars if it exists
import { readFileSync } from 'fs';
import { join } from 'path';
import { webcrypto as nodeWebcrypto, randomBytes } from 'node:crypto';

// Set up crypto.subtle with fallback to Node's webcrypto
const subtle = globalThis.crypto?.subtle ?? nodeWebcrypto.subtle;

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
const HMAC_SHARED_SECRET = process.env.HMAC_SHARED_SECRET;

// Generate HMAC signature
async function generateHmacSignature(body: string, timestamp: string, nonce: string, secret: string): Promise<string> {
  const payload = `${body}${timestamp}${nonce}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function testProductionBlogDebug() {
  try {
    console.log('🚀 Testing Production Blog Debug...');
    
    // Validate HMAC_SHARED_SECRET before proceeding
    if (!HMAC_SHARED_SECRET || HMAC_SHARED_SECRET.trim() === '') {
      throw new Error('HMAC_SHARED_SECRET is not set or is empty. Please set the HMAC_SHARED_SECRET environment variable.');
    }
    
    const requestData = {
      daysBack: 30,
      store: false
    };
    
    const body = JSON.stringify(requestData);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Generate cryptographically secure nonce using Node's crypto.randomBytes
    const nonceBytes = randomBytes(16);
    const nonce = nonceBytes.toString('hex');
    
    const signature = await generateHmacSignature(body, timestamp, nonce, HMAC_SHARED_SECRET);
    
    console.log('📝 Generating production blog post...');
    
    const response = await fetch(`${WORKER_URL}/api/content/blog/production`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-timestamp': timestamp,
        'x-request-nonce': nonce,
        'x-request-signature': signature
      },
      body: body
    });
    
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`📊 Response text length: ${responseText.length}`);
    console.log(`📊 Response text:`, responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('\n✅ Parsed JSON response:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.markdown) {
          console.log('\n📄 Full blog content:');
          console.log(data.markdown);
        }
      } catch (parseError) {
        console.log('❌ Failed to parse JSON response:', parseError);
      }
    } else {
      console.log(`❌ Request failed with status ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testProductionBlogDebug();
