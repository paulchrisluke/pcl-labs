// Authentication deployment test for Cloudflare Workers
// This test verifies that endpoints are properly protected with authentication
// Run with: npx tsx test-auth-deployment.ts

async function testAuthenticationDeployment() {
  const workerUrl = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';
  
  console.log('🔐 Testing authentication deployment...');
  console.log(`📡 Testing against: ${workerUrl}`);
  
  const endpointsToTest = [
    '/validate-twitch',
    '/validate-github',
    '/api/twitch/clips',
    '/api/twitch/clips/stored',
    '/api/github/activity',
    '/api/github-events/list',
    '/api/github-events/enhance-clip'
  ];
  
  let passedTests = 0;
  let totalTests = endpointsToTest.length;
  
  for (const endpoint of endpointsToTest) {
    console.log(`\n🧪 Testing ${endpoint}...`);
    
    try {
      const response = await fetch(`${workerUrl}${endpoint}`);
      
      if (response.status === 401) {
        console.log(`✅ ${endpoint} - Properly protected (401 Unauthorized)`);
        passedTests++;
      } else if (response.status === 405) {
        console.log(`✅ ${endpoint} - Method not allowed (405) - endpoint exists`);
        passedTests++;
      } else if (response.status === 200) {
        console.log(`⚠️  ${endpoint} - No authentication required (200 OK)`);
        console.log(`   This endpoint should require authentication but doesn't`);
      } else {
        console.log(`❓ ${endpoint} - Unexpected status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Request failed: ${error}`);
    }
  }
  
  console.log(`\n📊 Test Results:`);
  console.log(`   Passed: ${passedTests}/${totalTests}`);
  console.log(`   Failed: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All authentication tests passed!');
    console.log('✅ Authentication deployment is working correctly.');
  } else {
    console.log('\n⚠️  Some endpoints may not be properly protected.');
    console.log('💡 Check the implementation for endpoints that returned 200 OK.');
  }
  
  // Test health endpoint (should not require auth)
  console.log('\n🧪 Testing health endpoint (should not require auth)...');
  try {
    const healthResponse = await fetch(`${workerUrl}/health`);
    if (healthResponse.status === 200) {
      console.log('✅ Health endpoint - No authentication required (correct)');
    } else {
      console.log(`❌ Health endpoint - Unexpected status: ${healthResponse.status}`);
    }
  } catch (error) {
    console.log(`❌ Health endpoint - Request failed: ${error}`);
  }
  
  console.log('\n🎉 Authentication deployment test completed!');
}

testAuthenticationDeployment().catch(console.error);
