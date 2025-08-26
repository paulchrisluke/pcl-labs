import { Environment, TwitchTokenResponse, HealthResponse } from './types/index.js';
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
