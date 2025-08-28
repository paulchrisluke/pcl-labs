// GitHub credentials test for Cloudflare Workers
// This test works with your deployed worker's /validate-github endpoint
// Run with: npx tsx test-github.ts

import crypto from 'crypto';

async function generateHmacSignature(body: string, timestamp: string, nonce: string, secret: string): Promise<string> {
  const payload = `${body}${timestamp}${nonce}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

async function testGitHubCredentials() {
  // Get the worker URL from environment or use production as default
  const workerUrl = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';
  const validateUrl = `${workerUrl}/validate-github`;
  
  console.log('🔍 Testing GitHub credentials via Cloudflare Worker...');
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
    console.log('\n🔑 Testing GitHub credentials validation...');
    
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
      console.log('✅ GitHub credentials validation successful!');
      console.log('📊 Validation details:');
      console.log(`  Tokens present: ${result.tokens_present}`);
      console.log(`  Available tokens: ${result.available_tokens.join(', ')}`);
      console.log(`  API accessible: ${result.api_accessible}`);
      console.log(`  Repository accessible: ${result.repository_accessible}`);
      
      if (result.user_info) {
        console.log('👤 User info:');
        console.log(`  Login: ${result.user_info.login}`);
        console.log(`  ID: ${result.user_info.id}`);
        console.log(`  Type: ${result.user_info.type}`);
      }
      
      if (result.repo_info) {
        console.log('📁 Repository info:');
        console.log(`  Name: ${result.repo_info.name}`);
        console.log(`  Full name: ${result.repo_info.full_name}`);
        console.log(`  Private: ${result.repo_info.private}`);
        console.log(`  Permissions: ${JSON.stringify(result.repo_info.permissions)}`);
      }
      
      console.log('\n🎉 Your GitHub credentials are working correctly!');
      console.log('🚀 Your Cloudflare Worker can successfully:');
      console.log('   - Access GitHub API with personal access tokens');
      console.log('   - Fetch user information');
      console.log('   - Access repositories (if configured)');
      console.log('   - Create PRs and manage content');
      
    } else {
      console.error('❌ GitHub credentials validation failed');
      console.error(`  Error: ${result.error}`);
      
      if (result.tokens_present !== undefined) {
        console.log(`  Tokens present: ${result.tokens_present}`);
      }
      if (result.available_tokens) {
        console.log(`  Available tokens: ${result.available_tokens.join(', ')}`);
      }
      
      console.log('\n🔧 Troubleshooting:');
      console.log('   1. Check that your GitHub tokens are set as secrets:');
      console.log('      wrangler secret put GITHUB_TOKEN');
      console.log('      wrangler secret put GITHUB_TOKEN_PAULCHRISLUKE');
      console.log('      wrangler secret put GITHUB_TOKEN_BLAWBY');
      console.log('   2. Verify your GitHub tokens have the correct scopes');
      console.log('   3. Check that your tokens are not expired');
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error testing GitHub credentials:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('\n💡 Network error - possible solutions:');
      console.log('   - Make sure your worker is running (npm run dev)');
      console.log('   - Check your WORKER_URL is correct');
      console.log('   - Verify your network connection');
    }
    
    process.exit(1);
  }
}

testGitHubCredentials();
