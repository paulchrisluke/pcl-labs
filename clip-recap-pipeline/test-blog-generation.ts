#!/usr/bin/env -S npx tsx

/**
 * Test script for blog generation with AI drafting
 */

// Load environment variables
const HMAC_SHARED_SECRET = process.env.HMAC_SHARED_SECRET;
if (!HMAC_SHARED_SECRET) {
  console.error('❌ HMAC_SHARED_SECRET environment variable is required');
  process.exit(1);
}
const WORKER_URL = process.env.WORKER_URL || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

// Get crypto implementation
function getCrypto(): Crypto {
  if (typeof crypto !== 'undefined') {
    return crypto;
  }
  throw new Error('No crypto implementation available');
}

// Generate HMAC signature
async function generateHmacSignature(body: string, timestamp: string, nonce: string, secret: string): Promise<string> {
  const payload = `${body}${timestamp}${nonce}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const crypto = getCrypto();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate auth headers
async function generateAuthHeaders(body: string = ''): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Generate cryptographically secure nonce
  const crypto = getCrypto();
  const nonceArray = new Uint8Array(16);
  crypto.getRandomValues(nonceArray);
  const nonce = Array.from(nonceArray, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, 16);
  
  const signature = await generateHmacSignature(body, timestamp, nonce, HMAC_SHARED_SECRET);
  
  return {
    'X-Request-Signature': signature,
    'X-Request-Timestamp': timestamp,
    'X-Request-Nonce': nonce,
  };
}

async function testBlogGeneration() {
  console.log('🧪 Testing Blog Generation with AI Drafting...');
  console.log(`📡 Testing against: ${WORKER_URL}`);
  console.log(`🔐 Using HMAC authentication`);
  console.log('');

  // Test blog generation with a mock manifest that includes AI draft
  console.log('1️⃣ Testing blog generation with AI content...');
  try {
    const mockManifest = {
      schema_version: "1.0.0",
      post_id: "2025-08-29",
      date_utc: "2025-08-29T00:00:00.000Z",
      tz: "UTC",
      title: "Daily Dev Recap: AI Drafting Implementation",
      summary: "Today we implemented the AI drafting feature using Workers AI Gemma.",
      category: "development",
      tags: ["development", "ai", "gemma"],
      clip_ids: ["test1", "test2"],
      sections: [
        {
          section_id: "section1",
          clip_id: "test1",
          title: "AI Drafter Service Implementation",
          bullets: [
            "Implemented Workers AI Gemma integration",
            "Added idempotent content generation",
            "Created fallback mechanisms"
          ],
          paragraph: "Built the core AI drafting service.",
          repo: "test/repo",
          pr_links: ["https://github.com/test/repo/pull/123"],
          clip_url: "https://clips.twitch.tv/test-clip-1",
          vod_jump: "https://twitch.tv/videos/123?t=1h2m3s",
          alignment_status: "exact",
          start: 0,
          end: 120,
          entities: ["ai", "drafting", "gemma"]
        },
        {
          section_id: "section2",
          clip_id: "test2",
          title: "Blog Generator Integration",
          bullets: [
            "Updated markdown rendering to use AI content",
            "Added AI metadata to front matter",
            "Implemented graceful fallbacks"
          ],
          paragraph: "Integrated AI content into blog generation.",
          repo: "test/repo",
          pr_links: ["https://github.com/test/repo/pull/124"],
          clip_url: "https://clips.twitch.tv/test-clip-2",
          vod_jump: "https://twitch.tv/videos/123?t=2h3m4s",
          alignment_status: "exact",
          start: 0,
          end: 180,
          entities: ["blog", "generation", "integration"]
        }
      ],
      canonical_vod: "https://twitch.tv/videos/123",
      md_path: "content/blog/development/2025-08-29.md",
      target_branch: "staging",
      status: "draft",
      draft: {
        intro: "Today we focused on implementing the AI drafting feature using Workers AI Gemma. This new capability allows us to automatically generate professional blog post content from manifest data.",
        sections: [
          {
            paragraph: "In this section, we built the core AI drafting service that integrates with Workers AI Gemma. The implementation includes idempotent content generation with content hashing to prevent unnecessary re-generation, and robust fallback mechanisms to ensure the pipeline continues even when AI generation fails."
          },
          {
            paragraph: "Here we integrated the AI-generated content into the blog generation pipeline. The markdown rendering now uses AI content when available and gracefully falls back to existing content when needed. We also added comprehensive AI metadata to the front matter for tracking and auditability."
          }
        ],
        outro: "Overall, this implementation significantly enhances our content generation capabilities by adding AI-powered drafting while maintaining all existing pipeline functionality and quality checks."
      },
      gen: {
        model: "gemma-instruct",
        params: {
          temperature: 0.3,
          top_p: 0.9,
          seed: 42
        },
        prompt_hash: "test-hash",
        generated_at: "2025-08-29T04:13:00.000Z"
      }
    };

    const blogBody = JSON.stringify({
      manifest: mockManifest
    });

    const blogAuthHeaders = await generateAuthHeaders(blogBody);
    
    const blogResponse = await fetch(`${WORKER_URL}/api/content/blog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...blogAuthHeaders,
      },
      body: blogBody,
    });

    if (blogResponse.ok) {
      const blogData = await blogResponse.json();
      console.log('✅ Blog generation successful!');
      console.log('📊 Blog data:', JSON.stringify(blogData, null, 2));
      
      // Show the generated blog post
      console.log('\n📝 Generated Blog Post:');
      console.log('---');
      console.log(blogData.data.markdown);
      console.log('---');
    } else {
      console.log(`❌ Blog generation failed: ${blogResponse.status} ${blogResponse.statusText}`);
      const errorText = await blogResponse.text();
      console.log(`📄 Error: ${errorText}`);
    }
  } catch (error) {
    console.log('❌ Test failed:', error);
  }
}

// Run the test
testBlogGeneration();
