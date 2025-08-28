// Twitch credentials test for Cloudflare Workers
// This test works with your deployed worker's /validate-twitch endpoint
// Run with: npx tsx test-twitch.ts

import crypto from 'crypto';

async function generateHmacSignature(body: string, timestamp: string, nonce: string, secret: string): Promise<string> {
  const payload = `${body}${timestamp}${nonce}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

async function testTwitchCredentials() {
  // Get the worker URL from environment or use production as default
  const workerUrl = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';
  const validateUrl = `${workerUrl}/validate-twitch`;
  
  console.log('🔍 Testing Twitch credentials via Cloudflare Worker...');
  console.log(`📡 Testing against: ${validateUrl}`);
  
  if (!process.env.WORKER_URL) {
    console.log('ℹ️  No WORKER_URL provided, testing against production worker');
    console.log('   Available options:');
    console.log('   - Production: https://clip-recap-pipeline.paulchrisluke.workers.dev');
    console.log('   - Local: http://localhost:PORT (set WORKER_URL=http://localhost:PORT)');
    console.log('   ⚠️  Note: Local tests will fail - secrets not available in local dev');
  } else {
    console.log(`✅ Using custom worker URL: ${workerUrl}`);
    if (workerUrl.includes('localhost')) {
      console.log('⚠️  Local dev detected - secrets may not be available');
    }
  }
  
  try {
    console.log('\n🔑 Testing Twitch credentials validation...');
    
    // Generate authentication headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = await generateHmacSignature('', timestamp, nonce, process.env.HMAC_SHARED_SECRET || '');
    
    const response = await fetch(validateUrl, {
      headers: {
        'X-Request-Signature': signature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Validation request failed');
      console.error(`  Status: ${response.status} ${response.statusText}`);
      console.error(`  Error: ${errorText}`);
      
      if (response.status === 401) {
        console.log('\n💡 Authentication required - make sure HMAC_SHARED_SECRET is set:');
        console.log('   export HMAC_SHARED_SECRET="your-secret"');
      }
      
      if (response.status === 404) {
        console.log('\n💡 Make sure your worker is running:');
        console.log('   - For local testing: npm run dev');
        console.log('   - For deployed testing: Set WORKER_URL to your worker URL');
      }
      
      process.exit(1);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Twitch credentials validation successful!');
      console.log('📊 Validation details:');
      console.log(`  Token obtained: ${result.token_obtained}`);
      console.log(`  Token validated: ${result.token_validated}`);
      console.log(`  User found: ${result.user_found}`);
      
      if (result.token_info) {
        console.log(`  Token expires in: ${result.token_info.expires_in} seconds`);
      }
      
      console.log('\n🎉 Your Twitch credentials are working correctly!');
      console.log('🚀 Your Cloudflare Worker can successfully:');
      console.log('   - Generate Twitch access tokens');
      console.log('   - Validate tokens with Twitch API');
      console.log('   - Access Twitch Helix API');
      console.log('   - Fetch user information');
      
    } else {
      console.error('❌ Twitch credentials validation failed');
      console.error(`  Error: ${result.error}`);
      
      if (result.twitch_client_id_present !== undefined) {
        console.log(`  Twitch Client ID present: ${result.twitch_client_id_present}`);
      }
      if (result.twitch_client_secret_present !== undefined) {
        console.log(`  Twitch Client Secret present: ${result.twitch_client_secret_present}`);
      }
      
      console.log('\n🔧 Troubleshooting:');
      console.log('   1. Check that your Twitch credentials are set as secrets:');
      console.log('      wrangler secret put TWITCH_CLIENT_ID');
      console.log('      wrangler secret put TWITCH_CLIENT_SECRET');
      console.log('      wrangler secret put TWITCH_BROADCASTER_LOGIN');
      console.log('   2. Verify your Twitch app has the correct scopes');
      console.log('   3. Check that your Twitch app is active');
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error testing Twitch credentials:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('\n💡 Network error - possible solutions:');
      console.log('   - Make sure your worker is running (npm run dev)');
      console.log('   - Check your WORKER_URL is correct');
      console.log('   - Verify your network connection');
    }
    
    process.exit(1);
  }
}

testTwitchCredentials();
