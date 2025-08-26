import { Environment, TwitchTokenResponse } from './types/index.js';
import { validateClipId, validateClipData, validateClipObject } from './utils/validation.js';
import { handleScheduled } from './services/scheduler.js';
import { handleWebhook } from './services/webhooks.js';
import { handleGitHubRequest } from './routes/github.js';
import { generateStatusPage } from './status-page.js';

export default {
  async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Twitch Clip Recap Pipeline',
        version: '1.0.0',
        uptime: '24/7'
      };
      
      return new Response(JSON.stringify(healthData, null, 2), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Test audio download from stored clips using direct video URL extraction
    if (url.pathname === '/test-audio-download') {
      try {
        console.log('🎵 Testing audio download from stored clips...');
        
        // Get stored clips from R2
        const list = await env.R2_BUCKET.list({ prefix: 'clips/' });
        const clips = [];
        
        // Fetch all stored clips
        for (const object of list.objects) {
          const clipObject = await env.R2_BUCKET.get(object.key);
          if (clipObject) {
            const clipData = await clipObject.json();
            clips.push(clipData);
          }
        }
        
        if (clips.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No clips found in storage'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const results = [];
        
        // Test downloading audio from each clip
        for (const clip of clips) {
          try {
            console.log(`Testing clip: ${clip.id} - ${clip.title}`);
            
            // Extract clip ID from URL
            const clipIdMatch = clip.url.match(/\/clip\/([^/?]+)/);
            if (!clipIdMatch) {
              results.push({
                clip_id: clip.id,
                success: false,
                error: 'Could not extract clip ID from URL',
                title: clip.title
              });
              continue;
            }
            
            const clipId = clipIdMatch[1];
            
            // Try to get video URL using Twitch Helix API
            // First, get a valid access token
            const tokenFormData = new URLSearchParams();
            tokenFormData.append('client_id', env.TWITCH_CLIENT_ID);
            tokenFormData.append('client_secret', env.TWITCH_CLIENT_SECRET);
            tokenFormData.append('grant_type', 'client_credentials');

            const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: tokenFormData.toString(),
            });

            if (!tokenResponse.ok) {
              results.push({
                clip_id: clip.id,
                success: false,
                error: 'Failed to get Twitch access token',
                title: clip.title
              });
              continue;
            }

            const tokenData = await tokenResponse.json() as TwitchTokenResponse;
            const accessToken = tokenData.access_token;

            // Get clip information from Helix API
            const helixResponse = await fetch(`https://api.twitch.tv/helix/clips?id=${clipId}`, {
              headers: {
                'Client-ID': env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${accessToken}`,
              },
            });

            if (helixResponse.ok) {
              const helixData = await helixResponse.json() as { data?: Array<{ id: string; title: string; url: string; embed_url: string; thumbnail_url: string; duration: number; view_count: number; created_at: string; broadcaster_name: string; creator_name: string }> };
              
              if (helixData.data && helixData.data.length > 0) {
                const clipInfo = helixData.data[0];
                
                // The Twitch Helix API doesn't provide direct video URLs
                // Video URL extraction requires additional authentication and may violate ToS
                // This is a pipeline limitation that needs to be addressed properly
                results.push({
                  clip_id: clip.id,
                  success: false,
                  error: 'Video URL extraction not implemented - Twitch Helix API does not provide direct video URLs. This requires additional authentication and may violate ToS.',
                  title: clip.title,
                  clip_info: {
                    id: clipInfo.id,
                    title: clipInfo.title,
                    url: clipInfo.url,
                    embed_url: clipInfo.embed_url,
                    duration: clipInfo.duration,
                    view_count: clipInfo.view_count,
                    created_at: clipInfo.created_at,
                    broadcaster_name: clipInfo.broadcaster_name,
                    creator_name: clipInfo.creator_name
                  }
                });
              } else {
                results.push({
                  clip_id: clip.id,
                  success: false,
                  error: 'Clip not found in Helix API',
                  title: clip.title
                });
              }
            } else {
              results.push({
                clip_id: clip.id,
                success: false,
                error: `Helix API request failed: ${helixResponse.status}`,
                title: clip.title
              });
            }
          } catch (error) {
            results.push({
              clip_id: clip.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              title: clip.title
            });
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: `Tested ${clips.length} clips`,
          results: results
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Audio download test failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Test retrieving stored videos from R2
    if (url.pathname === '/test-stored-videos') {
      try {
        console.log('📹 Testing stored videos from R2...');
        
        // List all stored videos
        const list = await env.R2_BUCKET.list({ prefix: 'videos/' });
        
        if (list.objects.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No videos found in R2 storage'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const results = [];
        
        for (const object of list.objects) {
          try {
            const videoObject = await env.R2_BUCKET.get(object.key);
            
            if (videoObject) {
              const videoBuffer = await videoObject.arrayBuffer();
              results.push({
                video_key: object.key,
                video_size: videoBuffer.byteLength,
                content_type: videoObject.httpMetadata?.contentType || 'unknown',
                uploaded: object.uploaded
              });
            }
          } catch (error) {
            results.push({
              video_key: object.key,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: `Found ${list.objects.length} videos in R2`,
          results: results
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Stored videos test failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Test Whisper with a simple audio sample first
    if (url.pathname === '/test-whisper-simple') {
      try {
        console.log('🎤 Testing Whisper with simple audio...');
        
        // Create a simple test audio as base64 string
        // This is a minimal valid WAV file with actual audio content (very small)
        const base64Audio = "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT";
        
        console.log('Base64 audio length:', base64Audio.length);
        
        // Test Whisper with the base64 audio string
        const transcription = await env.ai.run('@cf/openai/whisper', base64Audio);
        
        return new Response(JSON.stringify({
          success: true,
          transcription: transcription,
          message: 'Whisper test completed'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Whisper test failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Test audio extraction and Whisper transcription
    if (url.pathname === '/test-transcription') {
      try {
        console.log('🎤 Testing audio extraction and Whisper transcription...');
        
        // List all stored videos
        const list = await env.R2_BUCKET.list({ prefix: 'videos/' });
        
        if (list.objects.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No videos found in R2 storage'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const results = [];
        
        for (const object of list.objects) {
          try {
            console.log(`Processing video: ${object.key}`);
            
            // Get video from R2
            const videoObject = await env.R2_BUCKET.get(object.key);
            
            if (!videoObject) {
              results.push({
                video_key: object.key,
                success: false,
                error: 'Video not found in R2'
              });
              continue;
            }
            
            const videoBuffer = await videoObject.arrayBuffer();
            
            // Extract clip ID from video key
            const clipIdMatch = object.key.match(/videos\/([^.]+)\.mp4/);
            if (!clipIdMatch) {
              results.push({
                video_key: object.key,
                success: false,
                error: 'Could not extract clip ID from video key'
              });
              continue;
            }
            
            const clipId = clipIdMatch[1];
            
            // For now, we'll use the video buffer directly with Whisper
            // In a production system, you'd want to extract audio first
            console.log(`Transcribing video for clip: ${clipId}`);
            
            // Extract audio from MP4 and convert to base64 string for Whisper
            // We'll use a simple approach to extract audio data from the MP4 file
            
            const videoArray = new Uint8Array(videoBuffer);
            
            // For now, let's try using just the first 100KB of the video as base64
            // This is a temporary approach to test Whisper functionality
            const maxSize = 100 * 1024; // 100KB
            const videoChunk = videoArray.slice(0, maxSize);
            
            // Convert to base64 using a more efficient method
            let base64Video = '';
            const chunkSize = 1024; // 1KB chunks for base64 conversion
            for (let i = 0; i < videoChunk.length; i += chunkSize) {
              const chunk = videoChunk.slice(i, i + chunkSize);
              base64Video += btoa(String.fromCharCode(...chunk));
            }
            
            console.log(`Converted ${videoChunk.length} bytes to base64 for ${clipId}`);
            console.log(`Base64 result length: ${base64Video.length}`);
            console.log(`Base64 result preview: ${base64Video.substring(0, 100)}...`);
            
            // Use Cloudflare AI Whisper with the base64 video data
            const transcription = await env.ai.run('@cf/openai/whisper', base64Video);
            
            if (transcription && transcription.text) {
              console.log(`Transcription successful for ${clipId}: ${transcription.text.substring(0, 100)}...`);
              
              // Store transcript in R2
              const transcriptKey = `transcripts/${clipId}.json`;
              const transcriptData = {
                clip_id: clipId,
                transcript: transcription.text,
                language: 'en',
                model: 'whisper',
                created_at: new Date().toISOString(),
                video_key: object.key,
                video_size: videoBuffer.byteLength
              };
              
              await env.R2_BUCKET.put(transcriptKey, JSON.stringify(transcriptData), {
                httpMetadata: {
                  contentType: 'application/json',
                },
              });
              
              results.push({
                video_key: object.key,
                clip_id: clipId,
                success: true,
                transcript_length: transcription.text.length,
                transcript_preview: transcription.text.substring(0, 100) + '...',
                transcript_key: transcriptKey
              });
            } else {
              results.push({
                video_key: object.key,
                clip_id: clipId,
                success: false,
                error: 'No transcription text returned from Whisper'
              });
            }
            
          } catch (error) {
            results.push({
              video_key: object.key,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: `Processed ${list.objects.length} videos for transcription`,
          results: results
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Transcription test failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Validate Twitch credentials endpoint
    if (url.pathname === '/validate-twitch') {
      try {
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
        console.log('🔍 Validating GitHub credentials...');
        
        // Check if we have any GitHub tokens
        const tokens = {
          GITHUB_TOKEN: env.GITHUB_TOKEN,
          GITHUB_TOKEN_PAULCHRISLUKE: env.GITHUB_TOKEN_PAULCHRISLUKE,
          GITHUB_TOKEN_BLAWBY: env.GITHUB_TOKEN_BLAWBY,
        };

        const availableTokens = Object.entries(tokens)
          .filter(([key, token]) => !!token)
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
            } catch (error) {
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
        const { TwitchService } = await import('./services/twitch');
        const twitchService = new TwitchService(env);
        
        switch (request.method) {
          case 'GET': {
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
            // Store clips data to R2
            console.log('💾 Storing clips data...');
            
            // Check request body size limit (10MB)
            const contentLength = request.headers.get('content-length');
            const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB
            if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
              return new Response(JSON.stringify({
                success: false,
                error: `Request body too large. Maximum size is ${MAX_REQUEST_SIZE / (1024 * 1024)}MB.`
              }), {
                status: 413,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            const body = await request.json() as { clips?: any[] };
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
            const updateBody = await request.json() as { clipId?: string; data?: any };
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
          
          // Limit the number of clips to prevent performance issues
          const MAX_CLIPS = 100;
          const objectsToFetch = list.objects.slice(0, MAX_CLIPS);

          // Fetch clips in parallel with batching
          const batchSize = 10;
          for (let i = 0; i < objectsToFetch.length; i += batchSize) {
            const batch = objectsToFetch.slice(i, i + batchSize);
            const batchPromises = batch.map(async (object: { key: string }) => {
              const clipObject = await env.R2_BUCKET.get(object.key);
              return clipObject ? clipObject.json() : null;
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

    // GitHub endpoints
    if (url.pathname.startsWith('/api/github/')) {
      return handleGitHubRequest(request, env);
    }

    // Webhook endpoints
    if (url.pathname === '/webhook/github') {
      return handleWebhook(request, env, ctx);
    }
    
    // Default response - API Status Page
    const html = await generateStatusPage(env);
    
    return new Response(html, { 
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  },

  async scheduled(event: ScheduledEvent, env: Environment, ctx: ExecutionContext): Promise<void> {
    await handleScheduled(event, env, ctx);
  }
};
