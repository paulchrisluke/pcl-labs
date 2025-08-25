// Twitch credentials test for Cloudflare Workers
// This test works with your deployed worker's /validate-twitch endpoint
// Run with: npx tsx test-twitch.ts

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
    console.log('   - Staging: https://clip-recap-pipeline-staging.paulchrisluke.workers.dev');
    console.log('   - Local: http://localhost:8787 (set WORKER_URL=http://localhost:8787)');
  } else {
    console.log(`✅ Using custom worker URL: ${workerUrl}`);
  }
  
  try {
    console.log('\n🔑 Testing Twitch credentials validation...');
    
    const response = await fetch(validateUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Validation request failed');
      console.error(`  Status: ${response.status} ${response.statusText}`);
      console.error(`  Error: ${errorText}`);
      
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
