#!/usr/bin/env node
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
  // Skip validation when testing against production worker
  if (process.env.WORKER_URL && process.env.WORKER_URL.includes('workers.dev')) {
    console.log('🔧 Testing against production worker - skipping local environment validation');
    return;
  }
  
  const requiredEnvVars = {
    HMAC_SHARED_SECRET: process.env.HMAC_SHARED_SECRET,
  }

  const missingVars: string[] = []

  for (const [name, value] of Object.entries(requiredEnvVars)) {
    if (!value || value.trim() === '') {
      missingVars.push(name)
    }
  }

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:')
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`)
    })
    console.error(
      '\nPlease set these environment variables before running the test.',
    )
    process.exit(1)
  }
}

// Initialize SecurityService once at module level
let securityService: any = null

async function initializeSecurityService(): Promise<any> {
  if (!securityService) {
    // For production testing, we don't need the SecurityService since we're testing worker endpoints directly
    if (process.env.WORKER_URL && process.env.WORKER_URL.includes('workers.dev')) {
      console.log('🔧 Using direct fetch for production worker testing');
      securityService = {
        securePost: async (url: string, data: any) => {
          return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        },
        secureGet: async (url: string) => {
          return fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
        }
      };
    } else {
      const { SecurityService } = await import('./src/services/security.js')
      securityService = new SecurityService({
        HMAC_SHARED_SECRET: process.env.HMAC_SHARED_SECRET!,
        WORKER_ORIGIN:
          process.env.WORKER_ORIGIN ||
          'https://clip-recap-pipeline.paulchrisluke.workers.dev',
      } as any)
    }
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

  // Test audio processor health
  try {
    console.log('🔍 Testing audio processor health...')

    // Use security service for authenticated request
    const securityService = await initializeSecurityService()

    const audioResponse = await securityService.secureGet(
      `${AUDIO_PROCESSOR_URL}/health`,
    )
    
    let audioResult: any = null
    let parseError: string | null = null
    let rawText: string | null = null
    
    try {
      audioResult = await audioResponse.json()
    } catch (jsonError) {
      parseError = jsonError instanceof Error ? jsonError.message : 'Unknown JSON parsing error'
      // Fall back to reading raw text
      try {
        rawText = await audioResponse.text()
      } catch (textError) {
        rawText = null
      }
    }

    results.push({
      name: 'Audio Processor Health',
      success: audioResponse.ok && audioResult?.status === 'healthy' && !parseError,
      data: {
        status: audioResponse.status,
        body: audioResult,
        text: rawText || JSON.stringify(audioResult),
        parseError,
      },
    })
  } catch (error) {
    results.push({
      name: 'Audio Processor Health',
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
    console.log(`🎵 Testing clip processing for ${testClipId}...`)

    // Use security service for authenticated request
    const securityService = await initializeSecurityService()

    // Test audio processing with fallback endpoint
    let audioResponse: Response
    let audioResult: any

    try {
      // Try hyphenated endpoint first
      audioResponse = await securityService.securePost(
        `${AUDIO_PROCESSOR_URL}/process-clips`,
        {
          clip_ids: [testClipId],
          background: false,
        },
      )

      if (!audioResponse.ok) {
        console.log(
          '⚠️ Hyphenated endpoint failed, trying underscore endpoint...',
        )
        // Fallback to underscore endpoint
        audioResponse = await securityService.securePost(
          `${AUDIO_PROCESSOR_URL}/process_clips`,
          {
            clip_ids: [testClipId],
            background: false,
          },
        )
      }

      audioResult = await audioResponse.json()
    } catch (jsonError) {
      results.push({
        name: 'Audio Processing',
        success: false,
        error: `Invalid JSON response: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`,
      })
      return results
    }

    results.push({
      name: 'Audio Processing',
      success: audioResponse.ok && audioResult.success,
      data: audioResult,
    })

    // Wait for processing to complete
    if (audioResponse.ok) {
      console.log('⏳ Waiting for audio processing...')
      await new Promise((resolve) => setTimeout(resolve, 10000))

      // Test transcription
      const transcribeResponse = await fetch(
        `${WORKER_URL}/api/transcribe/clip`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clipId: testClipId,
          }),
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
        success: statusResponse.ok && statusResult.has_transcript,
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

    // Test processed clips list using security service
    const securityService = await initializeSecurityService()

    const processedResponse = await securityService.secureGet(
      `${AUDIO_PROCESSOR_URL}/list-processed-clips?limit=10`,
    )
    const processedResult = await processedResponse.json()

    results.push({
      name: 'Processed Clips',
      success: processedResponse.ok,
      data: processedResult,
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
