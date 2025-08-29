import crypto from 'crypto';

// Load environment variables from .dev.vars if it exists
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const devVarsPath = join(process.cwd(), '.dev.vars');
  const devVarsContent = readFileSync(devVarsPath, 'utf8');
  
  // Split on CRLF or LF, handle each line robustly
  const lines = devVarsContent.split(/\r?\n/);
  
  for (const line of lines) {
    // Trim whitespace and skip empty lines
    const trimmedLine = line.trim();
    if (!trimmedLine || 
        trimmedLine.startsWith('#') || 
        trimmedLine.startsWith('//') || 
        trimmedLine.startsWith('export ')) {
      continue;
    }
    
    // Find the first '=' to separate key and value
    const equalsIndex = trimmedLine.indexOf('=');
    if (equalsIndex === -1) {
      continue; // Skip lines without '='
    }
    
    // Extract and trim key and value
    const key = trimmedLine.substring(0, equalsIndex).trim();
    let value = trimmedLine.substring(equalsIndex + 1).trim();
    
    // Skip if key is empty, value is undefined, or already set in process.env
    if (!key || value === undefined || process.env[key] !== undefined) {
      continue;
    }
    
    // Remove surrounding quotes from value (single or double quotes)
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    // Set the environment variable
    process.env[key] = value;
  }
  
  console.log('✅ Loaded environment variables from .dev.vars');
} catch (error) {
  console.log('⚠️ Could not load .dev.vars, using existing environment variables');
}

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
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Create signature using the same method as the worker
  const payload = `${body}${timestamp}${nonce}`;
  const hmac = crypto.createHmac('sha256', HMAC_SHARED_SECRET);
  hmac.update(payload);
  const signatureHex = hmac.digest('hex');
  
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
