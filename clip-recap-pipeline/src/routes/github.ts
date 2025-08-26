import { GitHubService } from '../services/github.js';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
};

// Define allowed methods for each endpoint
const endpointMethods: Record<string, string[]> = {
  '/api/github/activity': ['GET'],
  // Add other endpoints here as they are implemented
  // '/api/github/other-endpoint': ['GET', 'POST'],
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
      // Parse the request URL to determine the endpoint
      const url = new URL(request.url);
      let path = url.pathname;
      if (path.endsWith('/') && path !== '/') {
        path = path.slice(0, -1);
      }

      // Read incoming CORS request headers
      const requestHeaders = request.headers.get('Access-Control-Request-Headers');
      const requestMethod = request.headers.get('Access-Control-Request-Method');
      
      // Get allowed methods for this specific endpoint
      const allowedMethods = endpointMethods[path] || ['GET', 'POST'];
      
      // Build dynamic CORS headers
      const dynamicCorsHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
      };
      
      // Set allowed methods based on the endpoint and requested method
      if (requestMethod && allowedMethods.includes(requestMethod.toUpperCase())) {
        // If the requested method is allowed for this endpoint, return only that method
        dynamicCorsHeaders['Access-Control-Allow-Methods'] = requestMethod.toUpperCase();
      } else {
        // If the requested method is not allowed or not specified, return all allowed methods for this endpoint
        dynamicCorsHeaders['Access-Control-Allow-Methods'] = allowedMethods.join(', ');
      }
      
      // Normalize and set allowed headers
      if (requestHeaders) {
        // Normalize header values by converting to lowercase and removing extra whitespace
        const normalizedHeaders = requestHeaders
          .split(',')
          .map(header => header.trim().toLowerCase())
          .join(', ');
        dynamicCorsHeaders['Access-Control-Allow-Headers'] = normalizedHeaders;
      } else {
        dynamicCorsHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      }
      
      return new Response(null, {
        status: 204,
        headers: dynamicCorsHeaders,
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
      // Log the missing tokens server-side for debugging
      console.error(`Missing GitHub tokens: ${missingTokens.join(', ')}`);
      // Return generic error to client to avoid exposing secret names
      return createErrorResponse(500, 'Internal server error');
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
