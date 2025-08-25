import { Environment, TwitchTokenResponse } from './types/index.js';
import { validateClipId, validateClipData, validateClipObject } from './utils/validation.js';
import { handleScheduled } from './services/scheduler.js';
import { handleWebhook } from './services/webhooks.js';
import { handleGitHubRequest } from './routes/github.js';

// Helper function to get real service status from Cloudflare workers
async function getServiceStatus(env: Environment) {
  const now = new Date();
  const formatDate = (date: Date) => date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Production worker URL
  const productionUrl = 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

  // Test Twitch integration against production worker
  let twitchStatus = { status: 'offline' as const, lastTested: formatDate(now), error: 'Test failed' };
  try {
    const response = await fetch(`${productionUrl}/validate-twitch`);
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        twitchStatus = { status: 'online', lastTested: formatDate(now), error: '' };
      } else {
        twitchStatus = { status: 'offline', lastTested: formatDate(now), error: result.error || 'Validation failed' };
      }
    } else {
      twitchStatus = { status: 'offline', lastTested: formatDate(now), error: `HTTP ${response.status}` };
    }
  } catch (error) {
    twitchStatus = { status: 'offline', lastTested: formatDate(now), error: 'Connection failed' };
  }

  // Test GitHub integration against production worker
  let githubStatus = { status: 'offline' as const, lastTested: formatDate(now), error: 'Test failed' };
  try {
    const response = await fetch(`${productionUrl}/validate-github`);
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        githubStatus = { status: 'online', lastTested: formatDate(now), error: '' };
      } else {
        githubStatus = { status: 'offline', lastTested: formatDate(now), error: result.error || 'Validation failed' };
      }
    } else {
      githubStatus = { status: 'offline', lastTested: formatDate(now), error: `HTTP ${response.status}` };
    }
  } catch (error) {
    githubStatus = { status: 'offline', lastTested: formatDate(now), error: 'Connection failed' };
  }

  // Test AI processing (Workers AI binding)
  let aiStatus = { status: 'offline' as const, lastTested: formatDate(now), error: 'Not available' };
  try {
    // Simple test to check if AI binding is available
    if (env.ai) {
      aiStatus = { status: 'online', lastTested: formatDate(now), error: '' };
    }
  } catch (error) {
    aiStatus = { status: 'offline', lastTested: formatDate(now), error: 'Binding not available' };
  }

  // Test Cloud Storage (R2 binding)
  let storageStatus = { status: 'offline' as const, lastTested: formatDate(now), error: 'Not available' };
  try {
    // Simple test to check if R2 binding is available
    if (env.R2_BUCKET) {
      storageStatus = { status: 'online', lastTested: formatDate(now), error: '' };
    }
  } catch (error) {
    storageStatus = { status: 'offline', lastTested: formatDate(now), error: 'Binding not available' };
  }

  return {
    twitch: twitchStatus,
    github: githubStatus,
    ai: aiStatus,
    storage: storageStatus
  };
}

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
        uptime: '24/7',
        environment: 'production'
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

          const userData = await userResponse.json();
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
                const repoData = await repoResponse.json();
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
            const validatedClips = [];
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
    const statusData = await getServiceStatus(env);
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Twitch Clip Recap Pipeline - API Status</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .header {
            text-align: center;
            margin-bottom: 3rem;
            color: white;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }
        
        .status-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease;
        }
        
        .status-card:hover {
            transform: translateY(-2px);
        }
        
        .status-card h3 {
            color: #667eea;
            margin-bottom: 1rem;
            font-size: 1.3rem;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }
        
        .status-online {
            background: #10b981;
        }
        
        .status-offline {
            background: #ef4444;
        }
        
        .status-details {
            margin-top: 0.5rem;
            font-size: 0.875rem;
            color: #6b7280;
        }
        
        .last-tested {
            display: block;
            margin-bottom: 0.25rem;
        }
        
        .error-message {
            display: block;
            color: #ef4444;
            font-weight: 500;
        }
        
        .endpoints {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .endpoints h2 {
            color: #667eea;
            margin-bottom: 1.5rem;
            font-size: 1.8rem;
        }
        
        .endpoint {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        
        .endpoint-header {
            background: #f9fafb;
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .method {
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.875rem;
        }
        
        .method.get { background: #dbeafe; color: #1d4ed8; }
        .method.post { background: #dcfce7; color: #15803d; }
        .method.put { background: #fef3c7; color: #d97706; }
        
        .endpoint-path {
            font-family: 'Monaco', 'Menlo', monospace;
            font-weight: 600;
        }
        
        .endpoint-description {
            padding: 1rem;
            color: #6b7280;
        }
        
        .footer {
            text-align: center;
            margin-top: 3rem;
            color: white;
            opacity: 0.8;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 1.5rem;
            text-align: center;
            color: white;
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        
        .stat-label {
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Twitch Clip Recap Pipeline</h1>
            <p>Automated daily blog post generation from Twitch clips</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">7</div>
                <div class="stat-label">API Endpoints</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">24/7</div>
                <div class="stat-label">Uptime</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">AI</div>
                <div class="stat-label">Powered</div>
            </div>
        </div>
        
        <div class="status-grid">
            <div class="status-card">
                <h3><span class="status-indicator ${statusData.twitch.status === 'online' ? 'status-online' : 'status-offline'}"></span>Twitch Integration</h3>
                <p>Connected to Twitch API for clip fetching and processing</p>
                <div class="status-details">
                    <span class="last-tested">Last tested: ${statusData.twitch.lastTested}</span>
                    ${statusData.twitch.status === 'offline' ? `<span class="error-message">${statusData.twitch.error}</span>` : ''}
                </div>
            </div>
            <div class="status-card">
                <h3><span class="status-indicator ${statusData.github.status === 'online' ? 'status-online' : 'status-offline'}"></span>GitHub Integration</h3>
                <p>Connected to GitHub for content repository management</p>
                <div class="status-details">
                    <span class="last-tested">Last tested: ${statusData.github.lastTested}</span>
                    ${statusData.github.status === 'offline' ? `<span class="error-message">${statusData.github.error}</span>` : ''}
                </div>
            </div>
            <div class="status-card">
                <h3><span class="status-indicator ${statusData.ai.status === 'online' ? 'status-online' : 'status-offline'}"></span>AI Processing</h3>
                <p>Workers AI for transcription and content generation</p>
                <div class="status-details">
                    <span class="last-tested">Last tested: ${statusData.ai.lastTested}</span>
                    ${statusData.ai.status === 'offline' ? `<span class="error-message">${statusData.ai.error}</span>` : ''}
                </div>
            </div>
            <div class="status-card">
                <h3><span class="status-indicator ${statusData.storage.status === 'online' ? 'status-online' : 'status-offline'}"></span>Cloud Storage</h3>
                <p>R2 storage for clips and transcripts</p>
                <div class="status-details">
                    <span class="last-tested">Last tested: ${statusData.storage.lastTested}</span>
                    ${statusData.storage.status === 'offline' ? `<span class="error-message">${statusData.storage.error}</span>` : ''}
                </div>
            </div>
        </div>
        
        <div class="endpoints">
            <h2>📡 API Endpoints</h2>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/health</span>
                </div>
                <div class="endpoint-description">
                    Health check endpoint to verify service status
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/validate-twitch</span>
                </div>
                <div class="endpoint-description">
                    Validate Twitch API credentials and connection
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/validate-github</span>
                </div>
                <div class="endpoint-description">
                    Validate GitHub API credentials and repository access
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/api/github/activity</span>
                </div>
                <div class="endpoint-description">
                    Get daily GitHub activity and repository statistics
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/api/twitch/clips</span>
                </div>
                <div class="endpoint-description">
                    Fetch recent Twitch clips from the last 24 hours
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method post">POST</span>
                    <span class="endpoint-path">/api/twitch/clips</span>
                </div>
                <div class="endpoint-description">
                    Store clips data to R2 storage
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/api/twitch/clips/stored</span>
                </div>
                <div class="endpoint-description">
                    List all stored clips from R2 storage
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method post">POST</span>
                    <span class="endpoint-path">/webhook/github</span>
                </div>
                <div class="endpoint-description">
                    GitHub webhook handler for repository events
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Built with Cloudflare Workers • AI-Powered Content Generation</p>
        </div>
    </div>
</body>
</html>`;
    
    return new Response(html, { 
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  },

  async scheduled(event: ScheduledEvent, env: Environment, ctx: ExecutionContext): Promise<void> {
    await handleScheduled(event, env, ctx);
  }
};
