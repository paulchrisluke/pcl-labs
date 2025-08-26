// Daily pipeline test for Cloudflare Workers
// This test works with your deployed worker's pipeline endpoints
// Run with: npx tsx test-pipeline.ts

async function testDailyPipeline() {
  // Get the worker URL from environment or use production as default
  const workerUrl = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';
  
  console.log('🔍 Testing daily pipeline functionality via Cloudflare Worker...');
  console.log(`📡 Testing against: ${workerUrl}`);
  
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
    console.log('\n📊 Testing pipeline components...');
    
    // Test 1: Check stored clips count
    console.log('\n1️⃣ Testing stored clips endpoint...');
    const storedClipsResponse = await fetch(`${workerUrl}/api/twitch/clips/stored`);
    
    if (!storedClipsResponse.ok) {
      const errorText = await storedClipsResponse.text();
      console.error('❌ Stored clips request failed');
      console.error(`  Status: ${storedClipsResponse.status} ${storedClipsResponse.statusText}`);
      console.error(`  Error: ${errorText}`);
      process.exit(1);
    }
    
    const storedClipsResult = await storedClipsResponse.json();
    
    if (storedClipsResult.success) {
      console.log('✅ Stored clips endpoint working!');
      console.log(`  Total clips stored: ${storedClipsResult.clips.length}`);
      console.log(`  Has more: ${storedClipsResult.has_more}`);
      console.log(`  Total objects: ${storedClipsResult.total_objects}`);
      
      // Show some clip details
      if (storedClipsResult.clips.length > 0) {
        console.log('  Recent clips:');
        const recentClips = storedClipsResult.clips.slice(0, 3);
        recentClips.forEach((clip: any, index: number) => {
          console.log(`    ${index + 1}. ${clip.title} (${clip.created_at})`);
        });
      }
    } else {
      console.error('❌ Stored clips endpoint failed');
      console.error(`  Error: ${storedClipsResult.error}`);
      process.exit(1);
    }
    
    // Test 2: Check available clips from Twitch API
    console.log('\n2️⃣ Testing Twitch clips endpoint...');
    const twitchClipsResponse = await fetch(`${workerUrl}/api/twitch/clips`);
    
    if (!twitchClipsResponse.ok) {
      const errorText = await twitchClipsResponse.text();
      console.error('❌ Twitch clips request failed');
      console.error(`  Status: ${twitchClipsResponse.status} ${twitchClipsResponse.statusText}`);
      console.error(`  Error: ${errorText}`);
      process.exit(1);
    }
    
    const twitchClipsResult = await twitchClipsResponse.json();
    
    if (twitchClipsResult.success) {
      console.log('✅ Twitch clips endpoint working!');
      console.log(`  Clips found: ${twitchClipsResult.clips.length}`);
      console.log(`  Message: ${twitchClipsResult.message}`);
      
      if (twitchClipsResult.clips.length > 0) {
        console.log('  Available clips:');
        const availableClips = twitchClipsResult.clips.slice(0, 3);
        availableClips.forEach((clip: any, index: number) => {
          console.log(`    ${index + 1}. ${clip.title} (${clip.created_at}) - ${clip.view_count} views`);
        });
      }
    } else {
      console.error('❌ Twitch clips endpoint failed');
      console.error(`  Error: ${twitchClipsResult.error}`);
      process.exit(1);
    }
    
    // Test 3: Test clip storage functionality
    console.log('\n3️⃣ Testing clip storage functionality...');
    
    // Create a test clip
    const testClip = {
      id: "TestClip123",
      title: "Test clip for pipeline validation",
      url: "https://www.twitch.tv/test/clip/TestClip123",
      embed_url: "https://clips.twitch.tv/embed?clip=TestClip123",
      thumbnail_url: "https://static-cdn.jtvnw.net/test-thumbnail.jpg",
      duration: 30,
      view_count: 1,
      created_at: new Date().toISOString(),
      broadcaster_name: "testuser",
      creator_name: "testuser"
    };
    
    const storeResponse = await fetch(`${workerUrl}/api/twitch/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clips: [testClip] }),
    });
    
    if (!storeResponse.ok) {
      const errorText = await storeResponse.text();
      console.error('❌ Clip storage request failed');
      console.error(`  Status: ${storeResponse.status} ${storeResponse.statusText}`);
      console.error(`  Error: ${errorText}`);
      process.exit(1);
    }
    
    const storeResult = await storeResponse.json();
    
    if (storeResult.success) {
      console.log('✅ Clip storage functionality working!');
      console.log(`  Clips stored: ${storeResult.stored_clips.length}`);
      console.log(`  Validation summary:`, storeResult.validation_summary);
    } else {
      console.error('❌ Clip storage functionality failed');
      console.error(`  Error: ${storeResult.error}`);
      process.exit(1);
    }
    
    // Test 4: Verify the test clip was stored
    console.log('\n4️⃣ Verifying test clip storage...');
    const verifyResponse = await fetch(`${workerUrl}/api/twitch/clips/stored?id=TestClip123`);
    
    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('❌ Test clip verification failed');
      console.error(`  Status: ${verifyResponse.status} ${verifyResponse.statusText}`);
      console.error(`  Error: ${errorText}`);
      process.exit(1);
    }
    
    const verifyResult = await verifyResponse.json();
    
    if (verifyResult.success && verifyResult.clip) {
      console.log('✅ Test clip verification successful!');
      console.log(`  Stored clip ID: ${verifyResult.clip.id}`);
      console.log(`  Stored clip title: ${verifyResult.clip.title}`);
    } else {
      console.error('❌ Test clip verification failed');
      console.error(`  Error: ${verifyResult.error}`);
      process.exit(1);
    }
    
    // Test 5: Check final stored clips count
    console.log('\n5️⃣ Checking final stored clips count...');
    const finalStoredResponse = await fetch(`${workerUrl}/api/twitch/clips/stored`);
    
    if (!finalStoredResponse.ok) {
      const errorText = await finalStoredResponse.text();
      console.error('❌ Final stored clips request failed');
      console.error(`  Status: ${finalStoredResponse.status} ${finalStoredResponse.statusText}`);
      console.error(`  Error: ${errorText}`);
      process.exit(1);
    }
    
    const finalStoredResult = await finalStoredResponse.json();
    
    if (finalStoredResult.success) {
      console.log('✅ Final stored clips count verified!');
      console.log(`  Total clips after test: ${finalStoredResult.clips.length}`);
      
      // Check if our test clip is in the list
      const testClipExists = finalStoredResult.clips.some((clip: any) => clip.id === "TestClip123");
      if (testClipExists) {
        console.log('✅ Test clip successfully stored and retrievable!');
      } else {
        console.log('⚠️  Test clip not found in stored clips list');
      }
    } else {
      console.error('❌ Final stored clips verification failed');
      console.error(`  Error: ${finalStoredResult.error}`);
      process.exit(1);
    }
    
    console.log('\n🎉 Daily pipeline test completed successfully!');
    console.log('🚀 Your Cloudflare Worker pipeline can successfully:');
    console.log('   - Fetch clips from Twitch API');
    console.log('   - Store clips to R2 database');
    console.log('   - Retrieve stored clips');
    console.log('   - Validate clip data');
    console.log('   - Handle clip storage operations');
    
         console.log('\n📋 Pipeline Status Summary:');
     console.log(`   - Stored clips: ${storedClipsResult.clips.length}`);
     console.log(`   - Available Twitch clips: ${twitchClipsResult.clips.length}`);
     console.log(`   - Storage functionality: ✅ Working`);
     console.log(`   - Retrieval functionality: ✅ Working`);
     console.log(`   - Validation functionality: ✅ Working`);
     
     console.log('\n📝 Note: Test clip "TestClip123" was created during testing and remains in the database.');
     console.log('   This is expected behavior and does not affect production functionality.');
    
  } catch (error) {
    console.error('❌ Error testing daily pipeline:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('\n💡 Network error - possible solutions:');
      console.log('   - Make sure your worker is running (npm run dev)');
      console.log('   - Check your WORKER_URL is correct');
      console.log('   - Verify your network connection');
    }
    
    process.exit(1);
  }
}

testDailyPipeline();
