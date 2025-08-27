import type { Environment, TwitchTokenResponse, HealthResponse } from './types/index.js';
import { validateClipId, validateClipData, validateClipObject } from './utils/validation.js';
import { handleScheduled } from './services/scheduler.js';
import { handleWebhook } from './services/webhooks.js';
import { handleGitHubRequest } from './routes/github.js';
import { generateStatusPage } from './status-page.js';
import { calculateUptime } from './utils/uptime.js';

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
          
          // Filter for only JSON files to avoid parsing binary data
          const jsonFiles = list.objects.filter(obj => obj.key.endsWith('.json'));
          
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
                return clipObject ? await clipObject.json() : null;
              } catch (error) {
                console.error(`Failed to parse JSON for ${object.key}:`, error);
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
        console.log('🧪 Testing audio processing...');
        
        // Get stored clips
        const clipsList = await env.R2_BUCKET.list({ prefix: 'clips/' });
        const jsonFiles = clipsList.objects.filter(obj => obj.key.endsWith('.json'));
        const clipIds = jsonFiles.slice(0, 2).map(obj => obj.key.replace('clips/', '').replace('.json', ''));
        
        console.log(`📥 Processing ${clipIds.length} clips: ${clipIds.join(', ')}`);
        
        // Call audio processor
        const audioProcessorUrl = 'https://pcl-labs.vercel.app/api/audio-processor';
        const audioResponse = await fetch(audioProcessorUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clip_ids: clipIds,
            background: false
          })
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
        console.log('🧪 Testing real transcription pipeline...');

        // Step 1: Get a real clip ID from stored clips
        const clipsList = await env.R2_BUCKET.list({ prefix: 'clips/' });
        const jsonFiles = clipsList.objects.filter(obj => obj.key.endsWith('.json'));
        
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
        const audioProcessorUrl = env.AUDIO_PROCESSOR_URL || 'https://pcl-labs-no52x5jv0-pcl-labs.vercel.app/api/audio_processor';
        
        // Use security service for authenticated requests
        const { SecurityService } = await import('./services/security.js');
        const securityService = new SecurityService(env);
        
        const audioResponse = await securityService.securePost(`${audioProcessorUrl}/process-clips`, {
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
        console.log(`✅ Audio processing result: ${audioResult.message}`);

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
            audio_file_size: audioResult.results?.results?.[0]?.clip_info?.file_size || 'unknown',
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

    // Transcription endpoints
    if (url.pathname.startsWith('/api/transcribe/')) {
      try {
        const { TranscriptionService } = await import('./services/transcribe.js');
        const transcriptionService = new TranscriptionService(env);
        
        if (url.pathname === '/api/transcribe/clip' && request.method === 'POST') {
          // Transcribe a single clip with validation
          const body = await request.json() as { clipId?: string };
          const { clipId } = body;
          
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
          // Transcribe multiple clips with comprehensive validation
          const body = await request.json() as { clipIds?: string[] };
          const { clipIds } = body;
          
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

    // Deduplication endpoints
    if (url.pathname === '/api/deduplication/check') {
      try {
        const { DeduplicationService } = await import('./services/deduplication.js');
        const deduplicationService = new DeduplicationService(env);
        
        switch (request.method) {
          case 'POST': {
            const body = await request.json() as { clip_ids?: string[] };
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
            
            const result = await deduplicationService.checkClipsForDeduplication(clipIds);
            
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
        const deduplicationService = new DeduplicationService(env);
        
        const clipId = url.pathname.split('/').pop();
        if (!clipId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Clip ID not provided'
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
      return handleGitHubRequest(request, env);
    }

    // Webhook endpoints
    if (url.pathname === '/webhook/github') {
      return handleWebhook(request, env, ctx);
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
  }
};
