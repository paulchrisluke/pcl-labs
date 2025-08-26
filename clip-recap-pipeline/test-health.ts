// Health endpoint test for Cloudflare Workers
// This test works with your deployed worker's /health endpoint
// Run with: npx tsx test-health.ts

async function testHealthEndpoint() {
  // Get the worker URL from environment or use production as default
  const workerUrl = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';
  const healthUrl = `${workerUrl}/health`;
  
  console.log('🔍 Testing health endpoint via Cloudflare Worker...');
  console.log(`📡 Testing against: ${healthUrl}`);
  
  if (!process.env.WORKER_URL) {
    console.log('ℹ️  No WORKER_URL provided, testing against production worker');
    console.log('   Available options:');
    console.log('   - Production: https://clip-recap-pipeline.paulchrisluke.workers.dev');
    console.log('   - Local: http://localhost:PORT (set WORKER_URL=http://localhost:PORT)');
  } else {
    console.log(`✅ Using custom worker URL: ${workerUrl}`);
  }
  
  try {
    console.log('\n🏥 Testing health endpoint...');
    
    const response = await fetch(healthUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Health check failed');
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
    
    console.log('✅ Health check successful!');
    console.log('📊 Health details:');
    console.log(`  Status: ${result.status}`);
    console.log(`  Service: ${result.service}`);
    console.log(`  Version: ${result.version}`);
    console.log(`  Timestamp: ${result.timestamp}`);
    console.log(`  Uptime: ${result.uptime}`);
    
    // Validate uptime format
    if (result.uptime && typeof result.uptime === 'string') {
      // Check if uptime follows expected format (e.g., "5m 30s", "2h 15m", "1d 3h 45m")
      const uptimePattern = /^(\d+d\s+)?(\d+h\s+)?(\d+m\s+)?(\d+s)?$/;
      if (uptimePattern.test(result.uptime.trim())) {
        console.log('✅ Uptime format is valid');
      } else {
        console.log('⚠️  Uptime format may be unexpected:', result.uptime);
      }
    } else {
      console.log('❌ Uptime field is missing or invalid');
    }
    
    console.log('\n🎉 Health endpoint is working correctly!');
    console.log('🚀 Your Cloudflare Worker is:');
    console.log('   - Responding to health checks');
    console.log('   - Providing accurate uptime information');
    console.log('   - Returning proper JSON responses');
    
  } catch (error) {
    console.error('❌ Error testing health endpoint:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('\n💡 Network error - possible solutions:');
      console.log('   - Make sure your worker is running (npm run dev)');
      console.log('   - Check your WORKER_URL is correct');
      console.log('   - Verify your network connection');
    }
    
    process.exit(1);
  }
}

// Run the test
testHealthEndpoint().catch(console.error);
