import type { Environment, TwitchTokenResponse, HealthResponse } from './types/index.js';
import { validateClipId, validateClipData, validateClipObject } from './utils/validation.js';
import { handleScheduled } from './services/scheduler.js';
import { handleWebhook } from './services/webhooks.js';
import { handleGitHubRequest } from './routes/github.js';
import { handleContentRoutes } from './routes/content.js';
import { handleJobRoutes } from './routes/jobs.js';
import { generateStatusPage } from './status-page.js';
import { calculateUptime } from './utils/uptime.js';

/**
 * Get comprehensive audio processing status for a clip
 */
async function getClipAudioStatus(clipId: string, env: Environment) {
  try {
    // Check for video file
    const videoFile = await env.R2_BUCKET.head(`clips/${clipId}.mp4`);
    const hasVideo = !!videoFile;
    
    // Check for audio file
    const audioFile = await env.R2_BUCKET.head(`audio/${clipId}.wav`);
    const hasAudio = !!audioFile;
    
    // Check for transcript
    const transcriptFile = await env.R2_BUCKET.head(`transcripts/${clipId}.json`);
    const hasTranscript = !!transcriptFile;
    
    // Determine processing status
    let processingStatus = 'not_started';
    if (hasVideo && hasAudio && hasTranscript) {
      processingStatus = 'complete';
    } else if (hasVideo && hasAudio) {
      processingStatus = 'audio_ready_transcription_needed';
    } else if (hasVideo) {
      processingStatus = 'video_ready_audio_needed';
    } else {
      processingStatus = 'not_started';
    }
    
    // Get file sizes and metadata
    const videoSize = hasVideo ? videoFile?.size : null;
    const audioSize = hasAudio ? audioFile?.size : null;
    const transcriptSize = hasTranscript ? transcriptFile?.size : null;
    
    return {
      clip_id: clipId,
      has_video: hasVideo,
      has_audio: hasAudio,
      has_transcript: hasTranscript,
      processing_status: processingStatus,
      processing_complete: hasVideo && hasAudio && hasTranscript,
      file_sizes: {
        video: videoSize,
        audio: audioSize,
        transcript: transcriptSize
      },
      last_modified: {
        video: hasVideo ? videoFile?.uploaded : null,
        audio: hasAudio ? audioFile?.uploaded : null,
        transcript: hasTranscript ? transcriptFile?.uploaded : null
      }
    };
  } catch (error) {
    console.error(`Error getting audio status for clip ${clipId}:`, error);
    return {
      clip_id: clipId,
      has_video: false,
      has_audio: false,
      has_transcript: false,
      processing_status: 'error',
      processing_complete: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleGitHubRequestInternal(request: Request, env: Environment): Promise<Response> {
  try {
    const { handleGitHubRequest } = await import('./routes/github.js');
    return await handleGitHubRequest(request, env);
  } catch (error) {
    console.error('GitHub route error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGitHubEventsRequest(request: Request, env: Environment): Promise<Response> {
  try {
    const { GitHubEventService } = await import('./services/github-events.js');
    const githubEventService = new GitHubEventService(env);
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    switch (path) {
      case '/api/github-events/test': {
        if (request.method !== 'POST') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Method not allowed'
          }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Step 1: Authentication check - must come before any operations
        const { requireHmacAuth } = await import('./utils/auth.js');
        const rawBody = await request.text();
        const authError = await requireHmacAuth(request, env, rawBody);
        if (authError) return authError;
        
        // Test endpoint to simulate storing a GitHub event
        // Note: rawBody is available from authentication step above
        const testEvent = {
          deliveryId: `test-${Date.now()}`,
          eventType: 'pull_request',
          payload: {
            action: 'closed',
            pull_request: {
              number: 42,
              title: 'Test PR for temporal matching',
              html_url: 'https://github.com/paulchrisluke/pcl-labs/pull/42',
              merged: true,
              merged_at: new Date().toISOString(),
              created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
              updated_at: new Date().toISOString(),
              closed_at: new Date().toISOString(),
              user: { login: 'testuser' },
              head: { ref: 'feature/test', sha: 'abc123' },
              base: { ref: 'main', sha: 'def456' }
            },
            repository: {
              full_name: 'paulchrisluke/pcl-labs'
            }
          },
          repository: 'paulchrisluke/pcl-labs'
        };
        
        const stored = await githubEventService.storeEvent(
          testEvent.deliveryId,
          testEvent.eventType,
          testEvent.payload,
          testEvent.repository
        );
        
        return new Response(JSON.stringify({
          success: stored,
          message: stored ? 'Test event stored successfully' : 'Failed to store test event',
          event: testEvent
        }), {
          status: stored ? 200 : 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      case '/api/github-events/list': {
        if (request.method !== 'GET') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Method not allowed'
          }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Authentication check for GET requests
        const { requireHmacAuth } = await import('./utils/auth.js');
        const authError = await requireHmacAuth(request, env);
        if (authError) return authError;
        
        // List recent GitHub events
        const searchParams = url.searchParams;
        const daysParam = searchParams.get('days');
        const repository = searchParams.get('repository') || undefined;
        
        // Validate and clamp the days parameter
        let days = 1; // default value
        if (daysParam !== null) {
          const parsedDays = parseInt(daysParam);
          if (Number.isFinite(parsedDays) && !Number.isNaN(parsedDays)) {
            days = Math.floor(parsedDays);
            // Clamp to sane range: min 1, max 365
            days = Math.max(1, Math.min(365, days));
          } else {
            // Return 400 for clearly malformed input
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid days parameter - must be a valid number between 1 and 365'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const events = await githubEventService.getEventsForDateRange(startDate, endDate, repository);
        
        return new Response(JSON.stringify({
          success: true,
          events,
          count: events.length,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      case '/api/github-events/enhance-clip': {
        if (request.method !== 'POST') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Method not allowed'
          }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Authentication check for POST requests (need body for HMAC)
        const { requireHmacAuth } = await import('./utils/auth.js');
        const rawBody = await request.text();
        const authError = await requireHmacAuth(request, env, rawBody);
        if (authError) return authError;
        
        // Test temporal matching with a clip
        const body = JSON.parse(rawBody) as { clip: any; repository?: string };
        const { clip, repository } = body;
        
        if (!clip || !clip.created_at) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid clip data - missing created_at'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const enhancedClipMetadata = await githubEventService.enhanceClipWithGitHubContext(clip, repository);
        
        return new Response(JSON.stringify({
          success: true,
          clip: clip,
          hasGitHubContext: !!enhancedClipMetadata,
          githubContextMetadata: enhancedClipMetadata
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      default: {
        return new Response(JSON.stringify({
          success: false,
          error: 'Endpoint not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  } catch (error) {
    console.error('GitHub Events route error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default {
  async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      const healthData: HealthResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Twitch Clip Recap Pipeline',
        version: '1.0.0',
        uptime: calculateUptime()
      };
      
      return new Response(JSON.stringify(healthData, null, 2), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Asset serving endpoints (clips, audio, transcripts) - MUST come before API routes
    if (url.pathname.startsWith('/clips/') || url.pathname.startsWith('/audio/') || url.pathname.startsWith('/transcripts/')) {
      try {
        const filePath = url.pathname.substring(1); // Remove leading slash
        console.log(`📁 Serving asset: ${filePath}`);
        
        // Basic path validation to prevent directory traversal
        if (filePath.includes('..') || filePath.includes('//')) {
          return new Response('Invalid path', { status: 400 });
        }
        
        const fileObj = await env.R2_BUCKET.get(filePath);
        
        if (!fileObj) {
          return new Response('File not found', { status: 404 });
        }
        
        // Determine content type based on file extension
        let contentType = 'application/octet-stream';
        if (filePath.endsWith('.mp4')) contentType = 'video/mp4';
        else if (filePath.endsWith('.wav')) contentType = 'audio/wav';
        else if (filePath.endsWith('.raw')) contentType = 'audio/raw';
        else if (filePath.endsWith('.json')) contentType = 'application/json';
        else if (filePath.endsWith('.txt')) contentType = 'text/plain';
        else if (filePath.endsWith('.vtt')) contentType = 'text/vtt';
        
        return new Response(fileObj.body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': fileObj.size.toString(),
            'Cache-Control': 'public, max-age=3600',
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD',
            'Access-Control-Allow-Headers': 'Range'
          }
        });
        
      } catch (error) {
        console.error('Error serving asset:', error);
        return new Response('Internal server error', { status: 500 });
      }
    }
    

    

    

    

    
    // Environment variable validation for API routes
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/validate-') || url.pathname.startsWith('/webhook/')) {
      // Validate required environment variables for security
      if (!env.HMAC_SHARED_SECRET) {
        console.error('🚨 HMAC_SHARED_SECRET environment variable is required');
        return new Response(JSON.stringify({
          success: false,
          error: 'Server configuration error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // HMAC_SHARED_SECRET is sufficient for authentication - no need for separate admin tokens
    }

    // Apply HMAC authentication to protected API endpoints
    if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/twitch/clips/stored')) {
      try {
        const { requireHmacAuth } = await import('./utils/auth.js');
        
        // For GET requests, body is empty
        const body = request.method === 'GET' ? '' : await request.text();
        
        const authResult = await requireHmacAuth(request, env, body);
        if (authResult) {
          return authResult; // Returns 401 response if authentication fails
        }
        
        // Reconstruct request with body for downstream processing
        if (request.method !== 'GET') {
          request = new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: body
          });
        }
      } catch (error) {
        console.error('HMAC authentication error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Authentication error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Validate Twitch credentials endpoint
    if (url.pathname === '/validate-twitch') {
      try {
        // Authentication check
        const { requireHmacAuth } = await import('./utils/auth.js');
        const authError = await requireHmacAuth(request, env);
        if (authError) return authError;
        
        console.log('🔍 Validating Twitch credentials...');
        // Step 1: Get access token
        const formData = new URLSearchParams();
        formData.append('client_id', env.TWITCH_CLIENT_ID);
        formData.append('client_secret', env.TWITCH_CLIENT_SECRET);
        formData.append('grant_type', 'client_credentials');

        const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        console.log('Token response status:', tokenResponse.status);
        
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('Token response error:', errorText);
          return new Response(JSON.stringify({
            success: false,
            error: `Token request failed: ${tokenResponse.status} - ${errorText}`,
            twitch_client_id_present: !!env.TWITCH_CLIENT_ID,
            twitch_client_secret_present: !!env.TWITCH_CLIENT_SECRET
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const tokenData = await tokenResponse.json() as TwitchTokenResponse;
        
        // Step 2: Validate the token using Twitch's validate endpoint
        const validateResponse = await fetch('https://id.twitch.tv/oauth2/validate', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });

        if (!validateResponse.ok) {
          const errorText = await validateResponse.text();
          return new Response(JSON.stringify({
            success: false,
            error: `Token validation failed: ${validateResponse.status} - ${errorText}`,
            token_obtained: true,
            token_expires_in: tokenData.expires_in
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const validateData = await validateResponse.json();
        
        // Step 3: Test API call to get user info
        const loginToTest = env.TWITCH_BROADCASTER_LOGIN || 'paulchrisluke'; // Fallback for backward compatibility
        const userResponse = await fetch(
          `https://api.twitch.tv/helix/users?login=${loginToTest}`,
          {
            headers: {
              'Client-ID': env.TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
          }
        );

        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          return new Response(JSON.stringify({
            success: false,
            error: `API call failed: ${userResponse.status} - ${errorText}`,
            token_obtained: true,
            token_validated: true,
            token_info: validateData
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const userData = await userResponse.json() as { data: Array<{ id: string; login: string }> };
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Twitch credentials are valid!',
          token_obtained: true,
          token_validated: true,
          token_info: validateData,
          user_found: userData.data?.length > 0,
          broadcaster_id: userData.data?.[0]?.id || null,
          username: userData.data?.[0]?.login || null
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Validate GitHub credentials endpoint
    if (url.pathname === '/validate-github') {
      try {
        // Authentication check
        const { requireHmacAuth } = await import('./utils/auth.js');
        const authError = await requireHmacAuth(request, env);
        if (authError) return authError;
        
        console.log('🔍 Validating GitHub credentials...');
        
        // Check if we have any GitHub tokens
        const tokens = {
          GITHUB_TOKEN: env.GITHUB_TOKEN,
          GITHUB_TOKEN_PAULCHRISLUKE: env.GITHUB_TOKEN_PAULCHRISLUKE,
          GITHUB_TOKEN_BLAWBY: env.GITHUB_TOKEN_BLAWBY,
        };

        const availableTokens = Object.entries(tokens)
          .filter(([, token]) => !!token)
          .map(([key]) => key);

        if (availableTokens.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No GitHub tokens found',
            tokens_present: false
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        console.log(`✅ Found ${availableTokens.length} GitHub tokens: ${availableTokens.join(', ')}`);

        // Step 1: Test API access with the first available token
        const testToken = Object.values(tokens).find(token => !!token);
        if (!testToken) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No valid GitHub token found'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Step 2: Test API call to get user info
        try {
          const userResponse = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `Bearer ${testToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'clip-recap-pipeline/1.0.0',
            },
          });

          if (!userResponse.ok) {
            const errorText = await userResponse.text();
            return new Response(JSON.stringify({
              success: false,
              error: `GitHub API access failed: ${userResponse.status} - ${errorText}`,
              tokens_present: true,
              available_tokens: availableTokens
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const userData = await userResponse.json() as { login: string; id: number; type: string };
          console.log('✅ GitHub API access successful');

          // Step 3: Test repository access (try to access the content repo if configured)
          let repoAccess = null;
          if (env.CONTENT_REPO_OWNER && env.CONTENT_REPO_NAME) {
            try {
              const repoResponse = await fetch(
                `https://api.github.com/repos/${env.CONTENT_REPO_OWNER}/${env.CONTENT_REPO_NAME}`,
                {
                  headers: {
                    'Authorization': `Bearer ${testToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'clip-recap-pipeline/1.0.0',
                  },
                }
              );

              if (repoResponse.ok) {
                const repoData = await repoResponse.json() as { name: string; full_name: string; private: boolean; permissions: any };
                repoAccess = {
                  name: repoData.name,
                  full_name: repoData.full_name,
                  private: repoData.private,
                  permissions: repoData.permissions
                };
                console.log('✅ Repository access successful');
              } else {
                console.log('⚠️ Repository access failed (this might be expected)');
              }
            } catch {
              console.log('⚠️ Repository access test failed (this might be expected)');
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: 'GitHub credentials are valid!',
            tokens_present: true,
            available_tokens: availableTokens,
            api_accessible: true,
            user_info: {
              login: userData.login,
              id: userData.id,
              type: userData.type
            },
            repository_accessible: !!repoAccess,
            repo_info: repoAccess
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });

        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: `GitHub API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            tokens_present: true,
            available_tokens: availableTokens
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Twitch clips management endpoint
    if (url.pathname === '/api/twitch/clips') {
      try {
        const { TwitchService } = await import('./services/twitch.js');
        const twitchService = new TwitchService(env);
        
        switch (request.method) {
          case 'GET': {
            // Authentication check for GET requests
            const { requireHmacAuth } = await import('./utils/auth.js');
            const authError = await requireHmacAuth(request, env);
            if (authError) return authError;
            
            // Fetch recent clips from Twitch
            console.log('🔍 Fetching recent Twitch clips...');
            const clips = await twitchService.getRecentClips();
            
            return new Response(JSON.stringify({
              success: true,
              message: `Found ${clips.length} clips from the last 24 hours`,
              clips: clips.map(clip => ({
                id: clip.id,
                title: clip.title,
                url: clip.url,
                embed_url: clip.embed_url,
                thumbnail_url: clip.thumbnail_url,
                duration: clip.duration,
                view_count: clip.view_count,
                created_at: clip.created_at,
                broadcaster_name: clip.broadcaster_name,
                creator_name: clip.creator_name
              }))
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          case 'POST': {
            // Authentication check for POST requests (need body for HMAC)
            const { requireHmacAuth } = await import('./utils/auth.js');
            const rawBody = await request.text();
            const authError = await requireHmacAuth(request, env, rawBody);
            if (authError) return authError;
            
            // Store clips data to R2
            console.log('💾 Storing clips data...');
            
            const body = JSON.parse(rawBody) as { clips?: any[] };
            const clipsToStore = body.clips || [];
            
            // Validate request size
            const MAX_CLIPS_PER_REQUEST = 100;
            if (clipsToStore.length > MAX_CLIPS_PER_REQUEST) {
              return new Response(JSON.stringify({
                success: false,
                error: `Too many clips. Maximum ${MAX_CLIPS_PER_REQUEST} clips per request.`
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            if (clipsToStore.length === 0) {
              return new Response(JSON.stringify({
                success: false,
                error: 'No clips provided to store'
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            // Validate and sanitize each clip
            const validatedClips: any[] = [];
            for (let i = 0; i < clipsToStore.length; i++) {
              const clip = clipsToStore[i];
              
              // Basic structure validation
              if (!clip || typeof clip !== 'object' || Array.isArray(clip)) {
                return new Response(JSON.stringify({
                  success: false,
                  error: `Clip at index ${i} must be a valid object`
                }), {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
              
              // Comprehensive validation and sanitization of the entire clip object
              const clipValidation = validateClipObject(clip);
              if (!clipValidation.isValid) {
                return new Response(JSON.stringify({
                  success: false,
                  error: `Invalid clip at index ${i}: ${clipValidation.error}`
                }), {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
              
              // Check for duplicate clip IDs
              if (validatedClips.some(validatedClip => validatedClip.id === clip.id)) {
                return new Response(JSON.stringify({
                  success: false,
                  error: `Duplicate clip ID found: ${clip.id}`
                }), {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
              
              // Use sanitized clip data
              validatedClips.push(clipValidation.sanitizedData!);
            }
            
            // Store each validated clip as a separate file in R2
            const storedClips = [];
            for (const clip of validatedClips) {
              const key = `clips/${clip.id}.json`;
              await env.R2_BUCKET.put(key, JSON.stringify(clip), {
                httpMetadata: {
                  contentType: 'application/json',
                },
              });
              storedClips.push(clip.id);
            }
            
            return new Response(JSON.stringify({
              success: true,
              message: `Stored ${storedClips.length} clips to R2`,
              stored_clips: storedClips,
              validation_summary: {
                total_received: clipsToStore.length,
                total_stored: storedClips.length,
                sanitized: validatedClips.some(clip => Object.keys(clip).length > 1)
              }
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          case 'PUT': {
            // Update specific clip data
            console.log('🔄 Updating clip data...');
            
            // Get raw body first to avoid double-consume issues
            const rawBody = await request.text();
            
            // HMAC authentication required for data modification operations
            const { requireHmacAuth } = await import('./utils/auth.js');
            const authError = await requireHmacAuth(request, env, rawBody);
            if (authError) return authError;
            
            // Parse JSON body after authentication
            let updateBody: { clipId?: string; data?: any };
            try {
              updateBody = JSON.parse(rawBody);
            } catch {
              return new Response(JSON.stringify({
                success: false,
                error: 'Invalid JSON in request body'
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            const { clipId, data } = updateBody;
            
            if (!clipId || !data) {
              return new Response(JSON.stringify({
                success: false,
                error: 'clipId and data are required'
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            // Validate clipId format and prevent path traversal
            const clipIdValidation = validateClipId(clipId);
            if (!clipIdValidation.isValid) {
              return new Response(JSON.stringify({
                success: false,
                error: `Invalid clipId: ${clipIdValidation.error}`
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            // Strict validation of data with field whitelisting and sanitization
            const dataValidation = validateClipData(data);
            if (!dataValidation.isValid) {
              return new Response(JSON.stringify({
                success: false,
                error: dataValidation.error
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            // Use sanitized data for storage
            const sanitizedData = dataValidation.sanitizedData;
            
            const updateKey = `clips/${clipId}.json`;
            await env.R2_BUCKET.put(updateKey, JSON.stringify(sanitizedData), {
              httpMetadata: {
                contentType: 'application/json',
              },
            });
            
            return new Response(JSON.stringify({
              success: true,
              message: `Updated clip ${clipId}`,
              clip_id: clipId,
              updated_fields: Object.keys(sanitizedData)
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          default:
            return new Response(JSON.stringify({
              success: false,
              error: 'Method not allowed'
            }), {
              status: 405,
              headers: { 'Content-Type': 'application/json' }
            });
        }

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Read stored Twitch clips from R2
    if (url.pathname.startsWith('/api/twitch/clips/stored')) {
      try {
        // Authentication check
        const { requireHmacAuth } = await import('./utils/auth.js');
        const authError = await requireHmacAuth(request, env);
        if (authError) return authError;
        
        const clipId = url.searchParams.get('id');
        
        if (clipId) {
          // Validate clipId to prevent path traversal
          const validation = validateClipId(clipId);
          if (!validation.isValid) {
            return new Response(JSON.stringify({
              success: false,
              error: validation.error
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Get specific clip
          const clipObject = await env.R2_BUCKET.get(`clips/${clipId}.json`);
          
          if (!clipObject) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Clip not found'
            }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const clipData = await clipObject.json();
          return new Response(JSON.stringify({
            success: true,
            clip: clipData
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          // List all stored clips
          console.log('📖 Listing stored clips...');
          const list = await env.R2_BUCKET.list({ prefix: 'clips/' });
          const clips = [];
          
          // Filter for only JSON files to avoid parsing binary data
          const jsonFiles = list.objects.filter((obj: any) => obj.key.endsWith('.json'));
          
          // Limit the number of clips to prevent performance issues
          const MAX_CLIPS = 100;
          const objectsToFetch = jsonFiles.slice(0, MAX_CLIPS);

          // Fetch clips in parallel with batching
          const batchSize = 10;
          for (let i = 0; i < objectsToFetch.length; i += batchSize) {
            const batch = objectsToFetch.slice(i, i + batchSize);
            const batchPromises = batch.map(async (object: { key: string }) => {
              try {
                const clipObject = await env.R2_BUCKET.get(object.key);
                if (!clipObject) return null;
                
                const clipData = await clipObject.json();
                const clipId = clipData.id;
                
                // Check for video file
                const videoFile = await env.R2_BUCKET.head(`clips/${clipId}.mp4`);
                
                // Check for 8-bit audio file (preferred) or WAV fallback
                let audioFile = await env.R2_BUCKET.head(`audio/${clipId}.raw`);
                let audioFormat = 'raw';
                if (!audioFile) {
                  audioFile = await env.R2_BUCKET.head(`audio/${clipId}.wav`);
                  audioFormat = 'wav';
                }
                
                // Check for transcript files
                const transcriptJson = await env.R2_BUCKET.head(`transcripts/${clipId}.json`);
                const transcriptTxt = await env.R2_BUCKET.head(`transcripts/${clipId}.txt`);
                const transcriptVtt = await env.R2_BUCKET.head(`transcripts/${clipId}.vtt`);
                
                // Add file info to the clip data
                const enhancedClip = {
                  ...clipData,
                  video_file: videoFile ? {
                    exists: true,
                    size: videoFile.size,
                    uploaded: videoFile.uploaded,
                    last_modified: videoFile.lastModified,
                    url: `https://clip-recap-pipeline.paulchrisluke.workers.dev/clips/${clipId}.mp4`
                  } : {
                    exists: false
                  },
                  audio_file: audioFile ? {
                    exists: true,
                    size: audioFile.size,
                    uploaded: audioFile.uploaded,
                    last_modified: audioFile.lastModified,
                    url: `https://clip-recap-pipeline.paulchrisluke.workers.dev/audio/${clipId}.${audioFormat}`
                  } : {
                    exists: false
                  },
                  transcript: {
                    json: transcriptJson ? {
                      exists: true,
                      size: transcriptJson.size,
                      uploaded: transcriptJson.uploaded,
                      last_modified: transcriptJson.lastModified,
                      url: `https://clip-recap-pipeline.paulchrisluke.workers.dev/transcripts/${clipId}.json`
                    } : { exists: false },
                    txt: transcriptTxt ? {
                      exists: true,
                      size: transcriptTxt.size,
                      uploaded: transcriptTxt.uploaded,
                      last_modified: transcriptTxt.lastModified,
                      url: `https://clip-recap-pipeline.paulchrisluke.workers.dev/transcripts/${clipId}.txt`
                    } : { exists: false },
                    vtt: transcriptVtt ? {
                      exists: true,
                      size: transcriptVtt.size,
                      uploaded: transcriptVtt.uploaded,
                      last_modified: transcriptVtt.lastModified,
                      url: `https://clip-recap-pipeline.paulchrisluke.workers.dev/transcripts/${clipId}.vtt`
                    } : { exists: false }
                  }
                };
                
                return enhancedClip;
              } catch (error) {
                console.error(`Failed to process clip ${object.key}:`, error);
                return null;
              }
            });

            const batchResults = await Promise.all(batchPromises);
            clips.push(...batchResults.filter((clip: any) => clip !== null));
          }

          // Add pagination info to response
          const hasMore = list.objects.length > MAX_CLIPS;
          
          return new Response(JSON.stringify({
            success: true,
            message: `Found ${clips.length} stored clips`,
            clips: clips,
            has_more: hasMore,
            total_objects: list.objects.length
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Audio processing test endpoint
    if (url.pathname === '/api/test-audio-processing' && request.method === 'POST') {
      try {
        // Get raw body first to avoid double-consume issues
        const rawBody = await request.text();
        
        // HMAC authentication required for compute-intensive operations
        const { requireHmacAuth } = await import('./utils/auth.js');
        const authError = await requireHmacAuth(request, env, rawBody);
        if (authError) return authError;
        
        console.log('🧪 Testing audio processing...');
        
        // Get stored clips
        const clipsList = await env.R2_BUCKET.list({ prefix: 'clips/' });
        const jsonFiles = clipsList.objects.filter((obj: any) => obj.key.endsWith('.json'));
        const clipIds = jsonFiles.slice(0, 2).map((obj: any) => obj.key.replace('clips/', '').replace('.json', ''));
        
        console.log(`📥 Processing ${clipIds.length} clips: ${clipIds.join(', ')}`);
        
        // Call audio processor
        const audioProcessorUrl = env.AUDIO_PROCESSOR_URL || 'https://pcl-labs.vercel.app/api';
        
        // Use security service for authenticated requests
        const { SecurityService } = await import('./services/security.js');
        const securityService = new SecurityService(env);
        
        // Ensure no duplicate slashes by trimming trailing slash before concatenation
        const baseUrl = audioProcessorUrl.replace(/\/$/, '');
        const audioResponse = await securityService.securePost(`${baseUrl}/process-clips`, {
          clip_ids: clipIds,
          background: false
        });
        
        if (!audioResponse.ok) {
          const errorText = await audioResponse.text();
          throw new Error(`Audio processing failed: ${audioResponse.status} - ${errorText}`);
        }
        
        const audioResult = await audioResponse.json();
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Audio processing test completed',
          audio_result: audioResult,
          processed_clips: clipIds
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Test transcription endpoint - Real pipeline test
    if (url.pathname === '/api/test-transcription' && request.method === 'POST') {
      try {
        // Get raw body first to avoid double-consume issues
        const rawBody = await request.text();
        
        // HMAC authentication required for compute-intensive operations
        const { requireHmacAuth } = await import('./utils/auth.js');
        const authError = await requireHmacAuth(request, env, rawBody);
        if (authError) return authError;
        
        console.log('🧪 Testing real transcription pipeline...');

        // Step 1: Get a real clip ID from stored clips
        const clipsList = await env.R2_BUCKET.list({ prefix: 'clips/' });
        const jsonFiles = clipsList.objects.filter((obj: any) => obj.key.endsWith('.json'));
        
        if (jsonFiles.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No stored clips available for testing'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Use the first available clip
        const testClipId = jsonFiles[0].key.replace('clips/', '').replace('.json', '');
        console.log(`📋 Using stored clip ID: ${testClipId}`);

        // Step 2: Call audio processor to download and extract audio
        console.log('🎵 Processing audio for transcription test...');
        const audioProcessorUrl = env.AUDIO_PROCESSOR_URL || 'https://pcl-labs.vercel.app/api';
        
        // Use security service for authenticated requests
        const { SecurityService } = await import('./services/security.js');
        const securityService = new SecurityService(env);
        
        // Ensure no duplicate slashes by trimming trailing slash before concatenation
        const baseUrl = audioProcessorUrl.replace(/\/$/, '');
        const audioResponse = await securityService.securePost(`${baseUrl}/process-clips`, {
          clip_ids: [testClipId],
          background: false
        });

        if (!audioResponse.ok) {
          const errorText = await audioResponse.text();
          return new Response(JSON.stringify({
            success: false,
            error: `Audio processing failed: ${audioResponse.status} - ${errorText}`
          }), {
            status: audioResponse.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const audioResult = await audioResponse.json();
        console.log(`✅ Audio processing result: ${(audioResult as any).message}`);

        // Step 3: Poll R2 for audio file availability
        console.log('⏳ Waiting for audio file to be available...');
        let audioAvailable = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max wait

        while (!audioAvailable && attempts < maxAttempts) {
          const audioFile = await env.R2_BUCKET.head(`audio/${testClipId}.wav`);
          if (audioFile) {
            audioAvailable = true;
            console.log(`✅ Audio file available: audio/${testClipId}.wav`);
          } else {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          }
        }

        if (!audioAvailable) {
          return new Response(JSON.stringify({
            success: false,
            error: `Audio file not available after ${maxAttempts} seconds`
          }), {
            status: 408, // Request Timeout
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Step 4: Transcribe the real audio
        console.log('🎤 Transcribing real audio...');
        const { TranscriptionService } = await import('./services/transcribe.js');
        const transcriptionService = new TranscriptionService(env);

        const transcript = await transcriptionService.transcribeClip(testClipId);

        if (transcript && transcript.segments && transcript.segments.length > 0) {
          return new Response(JSON.stringify({
            success: true,
            message: 'Real transcription pipeline test completed successfully',
            clip_id: testClipId,
            audio_processed: true,
            audio_file_size: (audioResult as any).results?.results?.[0]?.clip_info?.file_size || 'unknown',
            transcript: transcript
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'Transcription completed but no transcript segments found',
            clip_id: testClipId,
            audio_processed: true,
            transcript: transcript
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

      } catch (error) {
        console.error('❌ Transcription pipeline test failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Force re-transcription endpoint (must come before general transcription routes)
    if (url.pathname.startsWith('/api/transcribe/force/') && request.method === 'POST') {
      try {
        // Step 1: Authentication check - must come before any destructive operations
        const { requireHmacAuth } = await import('./utils/auth.js');
        const rawRequestBody = await request.text();
        const authError = await requireHmacAuth(request, env, rawRequestBody);
        if (authError) return authError;
        
        const clipId = url.pathname.replace('/api/transcribe/force/', '');
        
        // Step 2: Validate clipId to prevent security issues
        const { validateClipId } = await import('./utils/validation.js');
        const validation = validateClipId(clipId);
        
        if (!validation.isValid) {
          console.warn(`🚨 Invalid clipId attempted in force transcribe: ${clipId} - ${validation.error}`);
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid clip ID'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`🔄 Force re-transcribing clip: ${clipId}`);
        
        // Step 3: Delete existing transcript files (only after authentication)
        await env.R2_BUCKET.delete(`transcripts/${clipId}.json`);
        await env.R2_BUCKET.delete(`transcripts/${clipId}.txt`);
        await env.R2_BUCKET.delete(`transcripts/${clipId}.vtt`);
        await env.R2_BUCKET.delete(`transcripts/${clipId}.ok`);
        
        console.log(`🗑️ Deleted existing transcript files for ${clipId}`);
        
        // Step 4: Import and run transcription service
        const { TranscriptionService } = await import('./services/transcribe.js');
        const transcriptionService = new TranscriptionService(env);
        
        const transcript = await transcriptionService.transcribeClip(clipId);
        
        if (transcript) {
          return new Response(JSON.stringify({
            success: true,
            message: `Force re-transcription completed for ${clipId}`,
            transcript: transcript
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: `Force re-transcription failed for ${clipId}`
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
      } catch (error) {
        console.error('Error in force re-transcription:', error);
        
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Transcription endpoints
    if (url.pathname.startsWith('/api/transcribe/')) {
      try {
        const { TranscriptionService } = await import('./services/transcribe.js');
        const transcriptionService = new TranscriptionService(env);
        
        if (url.pathname === '/api/transcribe/clip' && request.method === 'POST') {
          // Get raw body first to avoid double-consume issues
          const rawBody = await request.text();
          
          // HMAC authentication required for compute-intensive operations
          const { requireHmacAuth } = await import('./utils/auth.js');
          const authError = await requireHmacAuth(request, env, rawBody);
          if (authError) return authError;
          
          // Parse JSON body after authentication
          let clipRequestBody: { clipId?: string };
          try {
            clipRequestBody = JSON.parse(rawBody);
          } catch {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid JSON in request body'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const { clipId } = clipRequestBody;
          
          // Step 1: Basic input validation
          if (!clipId) {
            return new Response(JSON.stringify({
              success: false,
              error: 'clipId is required'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Step 2: Validate clip ID format
          const validation = validateClipId(clipId);
          if (!validation.isValid) {
            return new Response(JSON.stringify({
              success: false,
              error: validation.error || 'Invalid clip ID format'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          console.log(`🎤 Transcribing validated clip ${clipId}...`);
          const transcript = await transcriptionService.transcribeClip(clipId);
          
          if (transcript) {
            return new Response(JSON.stringify({
              success: true,
              message: `Transcription completed for ${clipId}`,
              transcript: transcript
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: `Transcription failed for ${clipId}`
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
        
        if (url.pathname === '/api/transcribe/batch' && request.method === 'POST') {
          // Get raw body first to avoid double-consume issues
          const rawBody = await request.text();
          
          // HMAC authentication required for compute-intensive operations
          const { requireHmacAuth } = await import('./utils/auth.js');
          const authError = await requireHmacAuth(request, env, rawBody);
          if (authError) return authError;
          
          // Parse JSON body after authentication
          let batchRequestBody: { clipIds?: string[] };
          try {
            batchRequestBody = JSON.parse(rawBody);
          } catch {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid JSON in request body'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const { clipIds } = batchRequestBody;
          
          // Step 1: Basic input validation
          if (!clipIds || !Array.isArray(clipIds)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'clipIds array is required'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Step 2: Validate and filter clip IDs
          const MAX_BATCH_SIZE = 50;
          const validClipIds: string[] = [];
          const invalidClipIds: string[] = [];
          
          for (const clipId of clipIds) {
            // Check if it's a non-empty string
            if (!clipId || typeof clipId !== 'string' || clipId.trim() === '') {
              invalidClipIds.push(clipId);
              continue;
            }
            
            // Validate using the existing validation function
            const validation = validateClipId(clipId);
            if (!validation.isValid) {
              invalidClipIds.push(clipId);
              continue;
            }
            
            // Add to valid list if we haven't hit the limit
            if (validClipIds.length < MAX_BATCH_SIZE) {
              validClipIds.push(clipId);
            }
          }
          
          // Step 3: Handle validation results
          if (validClipIds.length === 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'No valid clip IDs provided',
              details: {
                total_requested: clipIds.length,
                valid_count: 0,
                invalid_count: invalidClipIds.length,
                max_batch_size: MAX_BATCH_SIZE,
                invalid_ids: invalidClipIds.slice(0, 10) // Show first 10 invalid IDs
              }
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Step 4: Check if batch size was exceeded
          if (clipIds.length > MAX_BATCH_SIZE) {
            return new Response(JSON.stringify({
              success: false,
              error: `Batch size exceeded. Maximum allowed: ${MAX_BATCH_SIZE}`,
              details: {
                total_requested: clipIds.length,
                valid_count: validClipIds.length,
                invalid_count: invalidClipIds.length,
                max_batch_size: MAX_BATCH_SIZE,
                accepted_ids: validClipIds
              }
            }), {
              status: 413, // Payload Too Large
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Step 5: Proceed with transcription using validated IDs
          console.log(`🎤 Batch transcribing ${validClipIds.length} validated clips...`);
          const results = await transcriptionService.transcribeClips(validClipIds);
          
          return new Response(JSON.stringify({
            success: results.failed === 0,
            message: `Batch transcription completed: ${results.successful}/${results.total} successful`,
            details: {
              total_requested: clipIds.length,
              valid_count: validClipIds.length,
              invalid_count: invalidClipIds.length,
              max_batch_size: MAX_BATCH_SIZE,
              accepted_ids: validClipIds,
              invalid_ids: invalidClipIds.slice(0, 10) // Show first 10 invalid IDs
            },
            results: results
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (url.pathname.startsWith('/api/transcribe/status/') && request.method === 'GET') {
          // Check transcription status with validation
          const clipId = url.pathname.split('/').pop();
          if (!clipId) {
            return new Response(JSON.stringify({
              success: false,
              error: 'clipId is required'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Validate clip ID format
          const validation = validateClipId(clipId);
          if (!validation.isValid) {
            return new Response(JSON.stringify({
              success: false,
              error: validation.error || 'Invalid clip ID format'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const hasTranscript = await transcriptionService.hasTranscript(clipId);
          const transcript = hasTranscript ? await transcriptionService.getTranscript(clipId) : null;
          
          return new Response(JSON.stringify({
            success: true,
            clip_id: clipId,
            has_transcript: hasTranscript,
            transcript: transcript
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid transcription endpoint'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Audio processing status endpoints
    if (url.pathname === '/api/audio/status') {
      try {
        switch (request.method) {
          case 'GET': {
            // Get overall audio processing status
            
            // Get all stored clips by listing R2 bucket
            const clipsList = await env.R2_BUCKET.list({ prefix: 'clips/' });
            const jsonFiles = clipsList.objects.filter((obj: any) => obj.key.endsWith('.json'));
            const clipIds = jsonFiles.map((obj: any) => obj.key.replace('clips/', '').replace('.json', ''));
            
            // Check status for each clip
            const statusResults = [];
            for (const clipId of clipIds) {
              const status = await getClipAudioStatus(clipId, env);
              statusResults.push(status);
            }
            
            const summary = {
              total_clips: statusResults.length,
              with_video: statusResults.filter(s => s.has_video).length,
              with_audio: statusResults.filter(s => s.has_audio).length,
              with_transcript: statusResults.filter(s => s.has_transcript).length,
              processing_complete: statusResults.filter(s => s.processing_complete).length
            };
            
            return new Response(JSON.stringify({
              success: true,
              summary,
              clips: statusResults
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          default:
            return new Response(JSON.stringify({
              success: false,
              error: 'Method not allowed'
            }), {
              status: 405,
              headers: { 'Content-Type': 'application/json' }
            });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Individual clip audio status endpoint
    if (url.pathname.startsWith('/api/audio/status/') && request.method === 'GET') {
      try {
        const clipId = url.pathname.split('/').pop();
        
        if (!clipId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'clipId is required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Validate clip ID format
        const validation = validateClipId(clipId);
        if (!validation.isValid) {
          return new Response(JSON.stringify({
            success: false,
            error: validation.error || 'Invalid clip ID format'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const status = await getClipAudioStatus(clipId, env);
        
        return new Response(JSON.stringify({
          success: true,
          ...status
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Deduplication endpoints
    if (url.pathname === '/api/deduplication/check') {
      try {
        const { DeduplicationService } = await import('./services/deduplication.js');
        const { validateClipId } = await import('./utils/validation.js');
        const deduplicationService = new DeduplicationService(env);
        
        switch (request.method) {
          case 'POST': {
            // Get raw body first to avoid double-consume issues
            const rawBody = await request.text();
            
            // HMAC authentication required for compute-intensive operations
            const { requireHmacAuth } = await import('./utils/auth.js');
            const authError = await requireHmacAuth(request, env, rawBody);
            if (authError) return authError;
            
            // Parse JSON body after authentication
            let body: { clip_ids?: string[] };
            try {
              body = JSON.parse(rawBody);
            } catch {
              return new Response(JSON.stringify({
                success: false,
                error: 'Invalid JSON in request body'
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            const clipIds = body.clip_ids || [];
            
            if (clipIds.length === 0) {
              return new Response(JSON.stringify({
                success: false,
                error: 'No clip IDs provided'
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            if (clipIds.length > 50) {
              return new Response(JSON.stringify({
                success: false,
                error: 'Maximum 50 clip IDs per request'
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            // Validate each clip ID
            const validationErrors: string[] = [];
            const validClipIds: string[] = [];
            
            for (const clipId of clipIds) {
              const validation = validateClipId(clipId);
              if (!validation.isValid) {
                validationErrors.push(`Clip ID "${clipId}": ${validation.error}`);
              } else {
                validClipIds.push(clipId);
              }
            }
            
            if (validationErrors.length > 0) {
              return new Response(JSON.stringify({
                success: false,
                error: 'Invalid clip IDs provided',
                details: validationErrors
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            const result = await deduplicationService.checkClipsForDeduplication(validClipIds);
            
            return new Response(JSON.stringify({
              success: true,
              ...result
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          default:
            return new Response(JSON.stringify({
              success: false,
              error: 'Method not allowed'
            }), {
              status: 405,
              headers: { 'Content-Type': 'application/json' }
            });
        }
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname.startsWith('/api/deduplication/file-info/')) {
      try {
        const { DeduplicationService } = await import('./services/deduplication.js');
        const { validateClipId } = await import('./utils/validation.js');
        const deduplicationService = new DeduplicationService(env);
        
        // Extract clip ID from the URL path properly
        const pathParts = url.pathname.split('/');
        const clipId = pathParts[pathParts.length - 1]; // Get the last part after the last slash
        
        if (!clipId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Clip ID not provided'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Validate the clip ID
        const validation = validateClipId(clipId);
        if (!validation.isValid) {
          return new Response(JSON.stringify({
            success: false,
            error: `Invalid clip ID: ${validation.error}`
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const fileInfo = await deduplicationService.getClipFileInfo(clipId);
        
        return new Response(JSON.stringify({
          success: true,
          ...fileInfo
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/deduplication/cleanup') {
      try {
        const { DeduplicationService } = await import('./services/deduplication.js');
        const deduplicationService = new DeduplicationService(env);
        
        if (request.method !== 'POST') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Method not allowed'
          }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const cleanupResult = await deduplicationService.cleanupOrphanedFiles();
        
        return new Response(JSON.stringify({
          success: true,
          ...cleanupResult
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GitHub endpoints
    if (url.pathname.startsWith('/api/github/')) {
      return handleGitHubRequestInternal(request, env);
    }

    // GitHub Event Storage endpoints (M8 - GitHub Integration)
    if (url.pathname.startsWith('/api/github-events/')) {
      return handleGitHubEventsRequest(request, env);
    }

    // Job management endpoints
    if (url.pathname.startsWith('/api/jobs/')) {
      return handleJobRoutes(request, env, url);
    }

    // Content generation endpoints
    if (url.pathname.startsWith('/api/content/') || url.pathname.startsWith('/api/runs/')) {
      return handleContentRoutes(request, env, url);
    }

    // Webhook endpoints
    if (url.pathname === '/webhook/github') {
      return handleWebhook(request, env, ctx);
    }

    // Manual pipeline trigger endpoint
    if (url.pathname === '/api/trigger-pipeline' && request.method === 'POST') {
      try {
        // Get raw body first to avoid double-consume issues
        const rawBody = await request.text();
        
        // HMAC authentication required for compute-intensive operations
        const { requireHmacAuth } = await import('./utils/auth.js');
        const authError = await requireHmacAuth(request, env, rawBody);
        if (authError) return authError;
        
        console.log('🚀 Manual pipeline trigger activated...');
        
        // Import the scheduler function
        const { handleDailyPipeline } = await import('./services/scheduler.js');
        
        // Run the full daily pipeline
        await handleDailyPipeline(env);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Pipeline triggered successfully',
          timestamp: new Date().toISOString(),
          note: 'Check logs for detailed progress'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Manual pipeline trigger failed:', error);
        
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Manual audio processing endpoint (processes all stored clips)
    if (url.pathname === '/api/process-all-clips' && request.method === 'POST') {
      try {
        // Get raw body first to avoid double-consume issues
        const rawBody = await request.text();
        
        // HMAC authentication required for compute-intensive operations
        const { requireHmacAuth } = await import('./utils/auth.js');
        const authError = await requireHmacAuth(request, env, rawBody);
        if (authError) return authError;
        
        console.log('🎵 Manual audio processing for all stored clips...');
        
        // Get all stored clips
        const clipsList = await env.R2_BUCKET.list({ prefix: 'clips/' });
        const jsonFiles = clipsList.objects.filter((obj: any) => obj.key.endsWith('.json'));
        const clipIds = jsonFiles.map((obj: any) => obj.key.replace('clips/', '').replace('.json', ''));
        
        console.log(`📥 Found ${clipIds.length} stored clips to process: ${clipIds.join(', ')}`);
        
        if (clipIds.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No stored clips found to process'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Import the audio processing function
        const { processAudioForClips } = await import('./services/scheduler.js');
        
        // Process all clips with deduplication
        await processAudioForClips(clipIds, env);
        
        return new Response(JSON.stringify({
          success: true,
          message: `Audio processing completed for ${clipIds.length} clips`,
          processed_clips: clipIds,
          timestamp: new Date().toISOString(),
          note: 'Check R2 storage for processed files'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Manual audio processing failed:', error);
        
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Manual transcription pipeline endpoint
    if (url.pathname === '/api/transcription-pipeline' && request.method === 'POST') {
      try {
        // Step 1: Admin authentication check
        const { requireHmacAuth } = await import('./utils/auth.js');
        const pipelineRawBody = await request.text();
        const authError = await requireHmacAuth(request, env, pipelineRawBody);
        if (authError) return authError;
        
        console.log('🎤 Manual transcription pipeline for all stored clips...');
        
        // Step 2: Import and run transcription pipeline
        const { handleTranscriptionPipeline } = await import('./services/scheduler.js');
        
        // Run transcription pipeline
        await handleTranscriptionPipeline(env);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Transcription pipeline completed successfully',
          timestamp: new Date().toISOString(),
          note: 'Check R2 storage for transcript files'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Manual transcription pipeline failed:', error);
        
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Test Whisper API endpoint with real audio
    if (url.pathname === '/api/test-whisper' && request.method === 'POST') {
      try {
        console.log('🧪 Testing Whisper API with real audio...');
        
        // Get raw body first to avoid double-consume issues
        const rawBody = await request.text();
        
        // Step 1: HMAC authentication required for compute-intensive operations
        const { requireHmacAuth } = await import('./utils/auth.js');
        const authError = await requireHmacAuth(request, env, rawBody);
        if (authError) return authError;
        
        // Step 2: Parse and validate request body
        let whisperRequestBody: { clipId?: string };
        try {
          whisperRequestBody = JSON.parse(rawBody);
        } catch {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const { clipId } = whisperRequestBody;
        
        if (!clipId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'clipId is required in request body'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Step 3: Validate clipId format and length
        const { validateClipId } = await import('./utils/validation.js');
        const validation = validateClipId(clipId);
        
        if (!validation.isValid) {
          console.warn(`🚨 Invalid clipId attempted in Whisper test: ${clipId} - ${validation.error}`);
          return new Response(JSON.stringify({
            success: false,
            error: `Invalid clip ID: ${validation.error}`
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Step 4: Rate limiting check (simple logging for now)
        const clientId = 'hmac-authenticated';
        
        // For now, just log the request for monitoring
        // In production, you'd want to use a proper rate limiting service
        console.log(`📊 Whisper API request from client: ${clientId} at ${Date.now()}`);
        
        // Step 5: Get audio file from R2 with defensive checks
        const audioObj = await env.R2_BUCKET.get(`audio/${clipId}.wav`);
        
        if (!audioObj) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Audio file not found'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (!('body' in audioObj)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Audio file has no body content'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Step 6: Check file size limit before processing
        const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit
        if (audioObj.size > MAX_FILE_SIZE) {
          return new Response(JSON.stringify({
            success: false,
            error: `Audio file too large (${audioObj.size} bytes). Maximum allowed: ${MAX_FILE_SIZE} bytes`
          }), {
            status: 413, // Payload Too Large
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Step 7: Safe binary-to-base64 conversion using TranscriptionService utility
        const audioBuffer = await new Response(audioObj.body).arrayBuffer();
        
        // Use TranscriptionService's safe base64Encode utility
        let base64Audio: string;
        try {
          const { TranscriptionService } = await import('./services/transcribe.js');
          const transcriptionService = new TranscriptionService(env);
          
          // Use the safe base64Encode method from TranscriptionService
          base64Audio = transcriptionService.base64Encode(audioBuffer);
        } catch (error) {
          console.error('Base64 conversion failed:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to encode audio file to base64'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`🎵 Base64 encoded audio length: ${base64Audio.length} characters`);
        
        // Step 8: Call Whisper API
        const whisperResponse = await env.ai.run('@cf/openai/whisper-large-v3-turbo', {
          audio: base64Audio
        });
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Whisper API test successful',
          clip_id: clipId,
          file_size: audioObj.size,
          base64_length: base64Audio.length,
          response: whisperResponse
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Error testing Whisper API:', error);
        
        // Handle specific error types
        if (error instanceof SyntaxError) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }



    // Audio file serving endpoint (legacy)
    if (url.pathname.startsWith('/api/audio/file/') && request.method === 'GET') {
      try {
        const clipId = url.pathname.replace('/api/audio/file/', '');
        
        // Validate clipId to prevent security issues
        const { validateClipId } = await import('./utils/validation.js');
        const validation = validateClipId(clipId);
        
        if (!validation.isValid) {
          console.warn(`🚨 Invalid clipId attempted: ${clipId} - ${validation.error}`);
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid clip ID'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`🎵 Serving audio file for clip: ${clipId}`);
        
        const audioObj = await env.R2_BUCKET.get(`audio/${clipId}.wav`);
        
        if (!audioObj) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Audio file not found'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(audioObj.body, {
          status: 200,
          headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': audioObj.size.toString(),
            'Cache-Control': 'public, max-age=3600',
            'Accept-Ranges': 'bytes',
            'Content-Disposition': `inline; filename="${clipId}.wav"`
          }
        });
        
      } catch (error) {
        console.error('Error serving audio file:', error);
        
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Default response - API Status Page
    const html = await generateStatusPage(env, url.origin);
    
    return new Response(html, { 
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  },

  async scheduled(event: ScheduledEvent, env: Environment, ctx: ExecutionContext): Promise<void> {
    await handleScheduled(event, env, ctx);
  },

  async queue(batch: MessageBatch<any>, env: Environment): Promise<void> {
    console.log(`🔄 Processing ${batch.messages.length} queue messages`);
    
    try {
      const { JobProcessorService } = await import('./services/job-processor.js');
      const processor = new JobProcessorService(env);
      
      // Process all messages in the batch
      const messages = batch.messages.map(msg => msg.body);
      await processor.processJobs(messages);
      
      console.log(`✅ Successfully processed ${batch.messages.length} queue messages`);
      
    } catch (error) {
      console.error('❌ Queue processing error:', error);
      
      // Mark all messages as retryable
      batch.retryAll();
    }
  }
};
