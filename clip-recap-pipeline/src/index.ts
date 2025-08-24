import { Environment, TwitchTokenResponse } from './types/index.js';
import { handleScheduled } from './services/scheduler.js';
import { handleWebhook } from './services/webhooks.js';
import { handleGitHubRequest } from './routes/github.js';

export default {
  async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    // Validate Twitch credentials endpoint
    if (url.pathname === '/validate') {
      try {
        console.log('🔍 Validating Twitch credentials...');
        console.log('Validating credentials for Client ID length:', env.TWITCH_CLIENT_ID?.length || 0);
        
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
            client_id_length: env.TWITCH_CLIENT_ID?.length || 0,
            client_secret_length: env.TWITCH_CLIENT_SECRET?.length || 0,
            client_id: env.TWITCH_CLIENT_ID,
            client_secret_preview: env.TWITCH_CLIENT_SECRET?.substring(0, 4) + '...'
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
        const userResponse = await fetch(
          'https://api.twitch.tv/helix/users?login=paulchrisluke',
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

    // Clips management endpoint
    if (url.pathname === '/clips') {
      try {
        const { TwitchService } = await import('./services/twitch');
        const twitchService = new TwitchService(env);
        
        switch (request.method) {
          case 'GET':
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

          case 'POST':
            // Store clips data to R2
            console.log('💾 Storing clips data...');
            const body = await request.json() as { clips?: any[] };
            const clipsToStore = body.clips || [];
            
            if (clipsToStore.length === 0) {
              return new Response(JSON.stringify({
                success: false,
                error: 'No clips provided to store'
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            // Validate clip data structure
            for (const clip of clipsToStore) {
              if (!clip.id || typeof clip.id !== 'string') {
                return new Response(JSON.stringify({
                  success: false,
                  error: 'Each clip must have a valid id'
                }), {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            }
            
            // Store each clip as a separate file in R2
            const storedClips = [];
            for (const clip of clipsToStore) {
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
              stored_clips: storedClips
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });

          case 'PUT':
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
            
            const updateKey = `clips/${clipId}.json`;
            await env.R2_BUCKET.put(updateKey, JSON.stringify(data), {
              httpMetadata: {
                contentType: 'application/json',
              },
            });
            
            return new Response(JSON.stringify({
              success: true,
              message: `Updated clip ${clipId}`,
              clip_id: clipId
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });

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

    // Read stored clips from R2
    if (url.pathname.startsWith('/clips/stored')) {
      try {
        const clipId = url.searchParams.get('id');
        
        if (clipId) {
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
    
    // Default response
    return new Response('Twitch Clip Recap Pipeline', { status: 200 });
  },

  async scheduled(event: ScheduledEvent, env: Environment, ctx: ExecutionContext): Promise<void> {
    await handleScheduled(event, env, ctx);
  }
};
