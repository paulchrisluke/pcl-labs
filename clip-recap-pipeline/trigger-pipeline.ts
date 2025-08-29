import crypto from 'crypto';

// Configuration
const WORKER_URL = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';
const HMAC_SHARED_SECRET = process.env.HMAC_SHARED_SECRET;

if (!HMAC_SHARED_SECRET) {
  console.error('❌ HMAC_SHARED_SECRET environment variable is required');
  console.log('💡 Set it with: export HMAC_SHARED_SECRET="your-secret-key"');
  console.log('💡 Or get it from: npx wrangler secret list');
  process.exit(1);
}

// Generate HMAC authentication headers
async function generateAuthHeaders(body: string): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 18);
  
  // Create signature using the same method as the worker
  const payload = `${body}${timestamp}${nonce}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(HMAC_SHARED_SECRET);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return {
    'X-Request-Signature': signatureHex,
    'X-Request-Timestamp': timestamp,
    'X-Request-Nonce': nonce,
  };
}

async function triggerPipeline() {
  console.log('🚀 Triggering manual pipeline...\n');
  console.log(`📡 Using worker: ${WORKER_URL}\n`);

  try {
    // Trigger the manual pipeline endpoint
    console.log('1️⃣ Triggering daily pipeline...');
    
    const body = JSON.stringify({ trigger: 'manual' });
    const authHeaders = await generateAuthHeaders(body);
    
    const response = await fetch(`${WORKER_URL}/api/trigger-pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body,
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Pipeline triggered successfully!');
      console.log(`📊 Response: ${data.message}`);
      console.log(`⏰ Timestamp: ${data.timestamp}`);
      console.log(`💡 Note: ${data.note}`);
      
      console.log('\n' + '=' .repeat(80));
      console.log('💡 What the pipeline does:');
      console.log('1. 📥 Fetches recent Twitch clips (last 24h)');
      console.log('2. 💾 Stores clips to R2 bucket');
      console.log('3. 🎵 Processes audio (download, extract, transcribe)');
      console.log('4. 🎯 Scores and selects best clips');
      console.log('5. 📝 Generates blog post from selected clips');
      console.log('6. 🔗 Creates GitHub PR with the blog post');
      console.log('7. ⚖️ Judges content quality');
      console.log('8. 📢 Sends Discord notification');
      console.log('');
      console.log('📚 Check your R2 bucket for:');
      console.log('   - clips/ (stored clip data)');
      console.log('   - audio/ (extracted audio files)');
      console.log('   - transcripts/ (transcription data)');
      console.log('   - blog-posts/ (generated blog posts)');
      console.log('');
      console.log('🔗 Check your GitHub repository for the PR');
      console.log('📢 Check Discord for notifications');
      
    } else {
      console.log(`❌ Pipeline trigger failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Error triggering pipeline:', error);
  }
}

// Run the trigger
triggerPipeline().catch(console.error);
