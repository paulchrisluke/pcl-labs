import type { Environment, Transcript, GitHubContext } from '../types/index.js';

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
  const url = `https://${env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/${key}`;
  
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
  const url = `https://${env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/${key}`;
  
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
    // Extract key from URL
    const url = new URL(transcriptUrl);
    const key = url.pathname.substring(1); // Remove leading slash
    
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
    // Extract key from URL
    const url = new URL(githubContextUrl);
    const key = url.pathname.substring(1); // Remove leading slash
    
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
