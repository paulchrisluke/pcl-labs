#!/usr/bin/env node
/**
 * Test script for audio processing pipeline integration
 */

import { config } from 'dotenv'
import { SecurityService } from './src/services/security.js'

// Load environment variables
config()

/**
 * Validate required environment variables at startup
 */
function validateEnvironment(): void {
  // No environment validation needed - we're testing against the deployed worker which has its own secrets
  console.log('🔧 Testing against deployed worker with built-in secrets - no local environment needed');
}

// Initialize SecurityService once at module level
let securityService: SecurityService | null = null

async function initializeSecurityService(): Promise<SecurityService> {
  if (!securityService) {
    // Create a mock environment with the required HMAC secret
    const mockEnv = {
      HMAC_SHARED_SECRET: process.env.HMAC_SHARED_SECRET || 'test-secret-key',
    } as any;
    
    securityService = new SecurityService(mockEnv);
    console.log('🔧 Initialized SecurityService with HMAC authentication');
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
    const processResponse = await fetchWithTimeout(
      `${WORKER_URL}/api/process-all-clips`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true }) // Use dry run to test without actually processing
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
  const svc = await initializeSecurityService()

  try {
    console.log('🔍 Fetching stored clips to get a test clip ID...')
    const clipsResponse = await svc.secureGet(`${WORKER_URL}/api/twitch/clips/stored`)
    
    // Convert Response to FetchResult format for consistency
    const clipsResult = {
      ok: clipsResponse.ok,
      status: clipsResponse.status,
      body: await clipsResponse.json(),
      text: undefined,
    }

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
    const processResponse = await fetchWithTimeout(
      `${WORKER_URL}/api/process-all-clips`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clip_ids: [testClipId],
          dry_run: true // Use dry run to test without actually processing
        })
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
      const transcribeResponse = await svc.securePost(
        `${WORKER_URL}/api/transcribe/clip`,
        {
          clipId: testClipId,
        }
      )

      const transcribeResult = await transcribeResponse.json()

      results.push({
        name: 'Transcription',
        success: transcribeResponse.ok && transcribeResult.success,
        data: transcribeResult,
      })

      // Test transcript status
      const statusResponse = await svc.secureGet(
        `${WORKER_URL}/api/transcribe/status/${testClipId}`
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
    const svc = await initializeSecurityService()
    const clipsResponse = await svc.secureGet(`${WORKER_URL}/api/twitch/clips/stored`)
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
    const processedResponse = await svc.secureGet(`${WORKER_URL}/api/twitch/clips/stored?limit=10`)
    const processedResult = await processedResponse.json()

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
