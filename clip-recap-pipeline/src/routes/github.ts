import { GitHubService } from '../services/github.js';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Helper function to create JSON error responses with CORS headers
function createErrorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Helper function to create success responses with CORS headers
function createSuccessResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

export async function handleGitHubRequest(request: Request, env: any): Promise<Response> {
  try {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    // Normalize path by stripping trailing slash
    let path = url.pathname;
    if (path.endsWith('/') && path !== '/') {
      path = path.slice(0, -1);
    }

    // Get GitHub tokens from environment
    const tokens = {
      GITHUB_TOKEN_PAULCHRISLUKE: env.GITHUB_TOKEN_PAULCHRISLUKE,
      GITHUB_TOKEN_BLAWBY: env.GITHUB_TOKEN_BLAWBY,
    };

    // Check if all required tokens are available
    const missingTokens = Object.entries(tokens)
      .filter(([key, token]) => !token)
      .map(([key]) => key);

    if (missingTokens.length > 0) {
      return createErrorResponse(500, `Missing GitHub tokens: ${missingTokens.join(', ')}`);
    }

    const githubService = new GitHubService(tokens);

    switch (path) {
      case '/api/github/activity': {
        // Check if method is allowed for this endpoint
        if (request.method !== 'GET') {
          return createErrorResponse(405, 'Method Not Allowed');
        }
        return await handleActivity(githubService);
      }
      
      default: {
        return createErrorResponse(404, 'Not found');
      }
    }
  } catch (error) {
    console.error('GitHub route error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
}

async function handleActivity(githubService: GitHubService): Promise<Response> {
  try {
    const activity = await githubService.gatherDailyActivity();
    return createSuccessResponse(activity);
  } catch (error) {
    console.error('Error gathering activity:', error);
    return createErrorResponse(500, 'Error gathering activity');
  }
}
