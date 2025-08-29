import type { Environment, GitHubContext } from '../types/index.js';
import type { Transcript } from '../types/content.js';

/**
 * Build R2 object URL with configurable base URL
 */
function buildR2Url(env: Environment, key: string): string {
  const baseUrl = env.R2_PUBLIC_BASE_URL?.trim();
  if (!baseUrl) {
    // If no public URL is configured, return a relative path that can be accessed via the worker
    return `/github-context/${key}`;
  }
  
  // Remove trailing slashes from base URL
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/${key}`;
}

/**
 * Validate that a URL is from the expected R2 host
 */
function validateR2Url(url: URL, env: Environment): void {
  const expectedHost = env.R2_PUBLIC_BASE_URL ? new URL(env.R2_PUBLIC_BASE_URL).hostname : null;
  
  if (!expectedHost) {
    // If no public URL is configured, skip validation
    return;
  }
  
  if (url.hostname !== expectedHost) {
    throw new Error(`URL hostname '${url.hostname}' does not match expected R2 hostname '${expectedHost}'`);
  }
}

/**
 * Upload transcript to R2 and return metadata
 */
export async function uploadTranscriptToR2(
  env: Environment,
  clipId: string,
  transcript: Transcript
): Promise<{
  url: string;
  summary: string;
  sizeBytes: number;
}> {
  const transcriptJson = JSON.stringify(transcript, null, 2);
  const sizeBytes = new TextEncoder().encode(transcriptJson).length;
  
  // Generate R2 URL
  const key = `transcripts/${clipId}.json`;
  const url = buildR2Url(env, key);
  
  // Upload to R2
  await env.R2_BUCKET.put(key, transcriptJson, {
    httpMetadata: {
      contentType: 'application/json',
    },
    customMetadata: {
      'clip-id': clipId,
      'content-type': 'transcript',
      'size-bytes': sizeBytes.toString(),
      'uploaded-at': new Date().toISOString(),
    },
  });
  
  // Generate summary (first 200 characters of transcript text)
  const summary = transcript.text 
    ? transcript.text.substring(0, 200) + (transcript.text.length > 200 ? '...' : '')
    : `Transcript with ${transcript.segments.length} segments in ${transcript.language}`;
  
  return { url, summary, sizeBytes };
}

/**
 * Upload GitHub context to R2 and return metadata
 */
export async function uploadGitHubContextToR2(
  env: Environment,
  clipId: string,
  githubContext: GitHubContext
): Promise<{
  url: string;
  summary: string;
  sizeBytes: number;
}> {
  const contextJson = JSON.stringify(githubContext, null, 2);
  const sizeBytes = new TextEncoder().encode(contextJson).length;
  
  // Generate R2 URL
  const key = `github-context/${clipId}.json`;
  const url = buildR2Url(env, key);
  
  // Upload to R2
  await env.R2_BUCKET.put(key, contextJson, {
    httpMetadata: {
      contentType: 'application/json',
    },
    customMetadata: {
      'clip-id': clipId,
      'content-type': 'github-context',
      'size-bytes': sizeBytes.toString(),
      'uploaded-at': new Date().toISOString(),
    },
  });
  
  // Generate summary
  const prCount = githubContext.linked_prs?.length || 0;
  const commitCount = githubContext.linked_commits?.length || 0;
  const issueCount = githubContext.linked_issues?.length || 0;
  const confidence = githubContext.confidence_score || 0;
  
  const summary = `GitHub context: ${prCount} PRs, ${commitCount} commits, ${issueCount} issues (confidence: ${(confidence * 100).toFixed(1)}%)`;
  
  return { url, summary, sizeBytes };
}

/**
 * Retrieve transcript from R2
 */
export async function getTranscriptFromR2(
  env: Environment,
  transcriptUrl: string
): Promise<Transcript | null> {
  try {
    // Parse and validate URL
    const url = new URL(transcriptUrl);
    validateR2Url(url, env);
    
    // Extract key relative to base URL path
    const baseUrl = new URL(env.R2_PUBLIC_BASE_URL!);
    const basePath = baseUrl.pathname;
    const urlPath = url.pathname;
    
    // Derive key by removing base path prefix
    let key: string;
    if (basePath === '/' || basePath === '') {
      // No path prefix, just remove leading slash
      key = urlPath.substring(1);
    } else {
      // Remove base path prefix
      if (!urlPath.startsWith(basePath)) {
        throw new Error(`URL path '${urlPath}' does not start with base path '${basePath}'`);
      }
      key = urlPath.substring(basePath.length);
      // Remove leading slash if present
      if (key.startsWith('/')) {
        key = key.substring(1);
      }
    }
    
    const result = await env.R2_BUCKET.get(key);
    if (!result) {
      return null;
    }
    
    const transcriptJson = await result.text();
    return JSON.parse(transcriptJson) as Transcript;
  } catch (error) {
    console.error('Failed to retrieve transcript from R2:', error);
    return null;
  }
}

/**
 * Retrieve GitHub context from R2
 */
export async function getGitHubContextFromR2(
  env: Environment,
  githubContextUrl: string
): Promise<GitHubContext | null> {
  try {
    // Parse and validate URL
    const url = new URL(githubContextUrl);
    validateR2Url(url, env);
    
    // Extract key relative to base URL path
    const baseUrl = new URL(env.R2_PUBLIC_BASE_URL!);
    const basePath = baseUrl.pathname;
    const urlPath = url.pathname;
    
    // Derive key by removing base path prefix
    let key: string;
    if (basePath === '/' || basePath === '') {
      // No path prefix, just remove leading slash
      key = urlPath.substring(1);
    } else {
      // Remove base path prefix
      if (!urlPath.startsWith(basePath)) {
        throw new Error(`URL path '${urlPath}' does not start with base path '${basePath}'`);
      }
      key = urlPath.substring(basePath.length);
      // Remove leading slash if present
      if (key.startsWith('/')) {
        key = key.substring(1);
      }
    }
    
    const result = await env.R2_BUCKET.get(key);
    if (!result) {
      return null;
    }
    
    const contextJson = await result.text();
    return JSON.parse(contextJson) as GitHubContext;
  } catch (error) {
    console.error('Failed to retrieve GitHub context from R2:', error);
    return null;
  }
}
