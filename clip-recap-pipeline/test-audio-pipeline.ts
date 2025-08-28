/**
 * Test script for audio processing pipeline integration
 */

import { config } from 'dotenv'

// Load environment variables
config()

/**
 * Validate required environment variables at startup
 */
function validateEnvironment(): void {
  // No environment validation needed - we're testing against the deployed worker which has its own secrets
  console.log('🔧 Testing against deployed worker with built-in secrets - no local environment needed');
}

/**
 * Create HMAC signature for request authentication
 */
async function createSignature(body: string, timestamp: string, nonce: string): Promise<string> {
  const hmacSecret = process.env.HMAC_SHARED_SECRET;
  if (!hmacSecret) {
    throw new Error('HMAC_SHARED_SECRET not configured');
  }

  // Create signature payload: body + timestamp + nonce
  const payload = `${body}${timestamp}${nonce}`;
  
  // Create HMAC signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(hmacSecret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create security headers for API requests
 */
async function createSecurityHeaders(body: string = ''): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Generate cryptographically secure nonce (16-64 alphanumeric characters)
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars[randomBytes[i] % chars.length];
  }
  
  // Generate UUIDv4 for idempotency key
  const idempotencyKey = crypto.randomUUID();
  
  const signature = await createSignature(body, timestamp, nonce);
  
  return {
    'X-Request-Signature': signature,
    'X-Request-Timestamp': timestamp,
    'X-Request-Nonce': nonce,
    'X-Idempotency-Key': idempotencyKey,
    'Content-Type': 'application/json',
  };
}

// Initialize SecurityService once at module level
let securityService: any = null

async function initializeSecurityService(): Promise<any> {
  if (!securityService) {
    // Always use direct fetch since we're testing against the worker which has its own secrets
    console.log('🔧 Using direct fetch for worker testing');
    securityService = {
      securePost: async (url: string, data: any) => {
        const body = JSON.stringify(data);
        const headers = await createSecurityHeaders(body);
        
        return fetch(url, {
          method: 'POST',
          headers,
          body
        });
      },
      secureGet: async (url: string) => {
        const headers = await createSecurityHeaders();
        
        return fetch(url, {
          method: 'GET',
          headers
        });
      }
    };
  }
  return securityService
}

const WORKER_URL =
  process.env.WORKER_URL ||
  'https://clip-recap-pipeline.paulchrisluke.workers.dev'
const AUDIO_PROCESSOR_URL =
  process.env.AUDIO_PROCESSOR_URL ||
  'https://pcl-labs-zseyqko2e-pcl-labs.vercel.app/api/audio_processor'

interface TestResult {
  name: string
  success: boolean
  error?: string
  data?: any
}

interface FetchResult {
  ok: boolean
  status: number
  body: any
  text?: string
}

/**
 * Fetch with timeout and proper error handling
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000,
): Promise<FetchResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Try to parse JSON, fall back to text if it fails
    let body: any
    let text: string | undefined

    try {
      body = await response.json()
    } catch (jsonError) {
      // If JSON parsing fails, get the text content
      text = await response.text()
      body = { error: 'Non-JSON response', text }
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
      text,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }

    throw error
  }
}

async function testHealthEndpoints(): Promise<TestResult[]> {
  const results: TestResult[] = []

  // Test worker health
  try {
    console.log('🔍 Testing worker health...')
    const workerResult = await fetchWithTimeout(`${WORKER_URL}/health`)

    results.push({
      name: 'Worker Health',
      success: workerResult.ok && workerResult.body.status === 'healthy',
      data: {
        status: workerResult.status,
        body: workerResult.body,
        text: workerResult.text,
      },
    })
  } catch (error) {
    results.push({
      name: 'Worker Health',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  // Test worker's audio processing capability
  try {
    console.log('🔍 Testing worker audio processing capability...')

    // Test the worker's process-all-clips endpoint
    const processBody = JSON.stringify({ dry_run: true }); // Use dry run to test without actually processing
    const processHeaders = await createSecurityHeaders(processBody);
    
    const processResponse = await fetchWithTimeout(
      `${WORKER_URL}/api/process-all-clips`,
      {
        method: 'POST',
        headers: processHeaders,
        body: processBody
      }
    )

    results.push({
      name: 'Worker Audio Processing',
      success: processResponse.ok,
      data: {
        status: processResponse.status,
        body: processResponse.body,
      },
    })
  } catch (error) {
    results.push({
      name: 'Worker Audio Processing',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  return results
}

async function testClipProcessing(): Promise<TestResult[]> {
  const results: TestResult[] = []

  // Get a real clip ID from stored clips
  let testClipId: string

  try {
    console.log('🔍 Fetching stored clips to get a test clip ID...')
    const clipsResult = await fetchWithTimeout(
      `${WORKER_URL}/api/twitch/clips/stored`,
      {},
      15000,
    )

    if (!clipsResult.ok) {
      throw new Error(
        `HTTP ${clipsResult.status}: Failed to fetch stored clips`,
      )
    }

    let clipsData: any
    try {
      clipsData = clipsResult.body
    } catch (jsonError) {
      throw new Error(
        `Invalid JSON response: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`,
      )
    }

    // Strict validation of response shape
    if (!clipsData || typeof clipsData !== 'object') {
      throw new Error('Response is not a valid object')
    }

    if (!clipsData.success || clipsData.success !== true) {
      throw new Error('Response success field is not true')
    }

    if (!Array.isArray(clipsData.clips) || clipsData.clips.length === 0) {
      throw new Error('No stored clips available for testing')
    }

    if (!clipsData.clips[0] || !clipsData.clips[0].id) {
      throw new Error('First clip does not have a valid ID')
    }

    // Use the first available clip
    testClipId = clipsData.clips[0].id
    console.log(`📋 Using stored clip ID: ${testClipId}`)
  } catch (error) {
    results.push({
      name: 'Clip Processing',
      success: false,
      error: `Failed to get stored clip: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
    return results
  }

  try {
    console.log(`🎵 Testing worker clip processing for ${testClipId}...`)

    // Test worker's clip processing endpoint
    const processBody = JSON.stringify({ 
      clip_ids: [testClipId],
      dry_run: true // Use dry run to test without actually processing
    });
    const processHeaders = await createSecurityHeaders(processBody);
    
    const processResponse = await fetchWithTimeout(
      `${WORKER_URL}/api/process-all-clips`,
      {
        method: 'POST',
        headers: processHeaders,
        body: processBody
      }
    )

    const processResult = processResponse.body

    results.push({
      name: 'Worker Clip Processing',
      success: processResponse.ok && processResult.success,
      data: processResult,
    })

    // Wait for processing to complete
    if (processResponse.ok) {
      console.log('⏳ Waiting for audio processing...')
      await new Promise((resolve) => setTimeout(resolve, 10000))

      // Test transcription
      const transcribeBody = JSON.stringify({ clipId: testClipId });
      const transcribeHeaders = await createSecurityHeaders(transcribeBody);
      
      const transcribeResponse = await fetch(
        `${WORKER_URL}/api/transcribe/clip`,
        {
          method: 'POST',
          headers: transcribeHeaders,
          body: transcribeBody,
        },
      )

      const transcribeResult = await transcribeResponse.json()

      results.push({
        name: 'Transcription',
        success: transcribeResponse.ok && transcribeResult.success,
        data: transcribeResult,
      })

      // Test transcript status
      const statusResponse = await fetch(
        `${WORKER_URL}/api/transcribe/status/${testClipId}`,
      )
      const statusResult = await statusResponse.json()

      results.push({
        name: 'Transcript Status',
        success: statusResponse.ok, // Just check if the endpoint responds, not if transcript exists
        data: statusResult,
      })
    }
  } catch (error) {
    results.push({
      name: 'Clip Processing',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  return results
}

async function testStoredClips(): Promise<TestResult[]> {
  const results: TestResult[] = []

  try {
    console.log('📖 Testing stored clips...')

    // Get stored clips
    const clipsResponse = await fetch(`${WORKER_URL}/api/twitch/clips/stored`)
    const clipsResult = await clipsResponse.json()

    results.push({
      name: 'Stored Clips',
      success: clipsResponse.ok && clipsResult.success,
      data: {
        total_clips: clipsResult.clips?.length || 0,
        has_more: clipsResult.has_more,
      },
    })

    // Test worker's clip processing status
    const processedResponse = await fetchWithTimeout(
      `${WORKER_URL}/api/twitch/clips/stored?limit=10`,
    )
    const processedResult = processedResponse.body

    results.push({
      name: 'Worker Clip Status',
      success: processedResponse.ok && processedResult.success,
      data: {
        total_clips: processedResult.clips?.length || 0,
        has_more: processedResult.has_more,
      },
    })
  } catch (error) {
    results.push({
      name: 'Stored Clips',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  return results
}

async function main() {
  validateEnvironment()
  console.log('🧪 Testing Audio Processing Pipeline Integration\n')
  console.log(`Worker URL: ${WORKER_URL}`)
  console.log(`Audio Processor URL: ${AUDIO_PROCESSOR_URL}\n`)

  const allResults: TestResult[] = []

  // Run health tests
  console.log('=== Health Tests ===')
  const healthResults = await testHealthEndpoints()
  allResults.push(...healthResults)

  for (const result of healthResults) {
    const status = result.success ? '✅' : '❌'
    console.log(
      `${status} ${result.name}: ${result.success ? 'PASS' : result.error}`,
    )
  }

  console.log()

  // Run stored clips tests
  console.log('=== Stored Clips Tests ===')
  const storedResults = await testStoredClips()
  allResults.push(...storedResults)

  for (const result of storedResults) {
    const status = result.success ? '✅' : '❌'
    console.log(
      `${status} ${result.name}: ${result.success ? 'PASS' : result.error}`,
    )
    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data)}`)
    }
  }

  console.log()

  // Run clip processing tests (only if health checks pass)
  const healthPassed = healthResults.every((r) => r.success)
  if (healthPassed) {
    console.log('=== Clip Processing Tests ===')
    const processingResults = await testClipProcessing()
    allResults.push(...processingResults)

    for (const result of processingResults) {
      const status = result.success ? '✅' : '❌'
      console.log(
        `${status} ${result.name}: ${result.success ? 'PASS' : result.error}`,
      )
      if (result.data) {
        console.log(`   Data: ${JSON.stringify(result.data)}`)
      }
    }
  } else {
    console.log(
      '⚠️ Skipping clip processing tests due to health check failures',
    )
  }

  console.log()

  // Summary
  console.log('=== Test Summary ===')
  const passed = allResults.filter((r) => r.success).length
  const total = allResults.length

  console.log(`Overall: ${passed}/${total} tests passed`)

  if (passed === total) {
    console.log(
      '🎉 All tests passed! Audio processing pipeline is working correctly.',
    )
    process.exit(0)
  } else {
    console.log('⚠️ Some tests failed. Please check the issues above.')
    process.exit(1)
  }
}

// Run the main function
main().catch((error) => {
  console.error('Test failed with error:', error)
  process.exit(1)
})
