import { GitHubService } from '../services/github';

export async function handleGitHubRequest(request: Request, env: any): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;

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
      return new Response(`Missing GitHub tokens: ${missingTokens.join(', ')}`, { status: 500 });
    }

    const githubService = new GitHubService(tokens);

    switch (path) {
      case '/api/github/activity':
        return await handleActivity(githubService);
      
      default:
        return new Response('Not found', { status: 404 });
    }
  } catch (error) {
    console.error('GitHub route error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

async function handleActivity(githubService: GitHubService): Promise<Response> {
  try {
    const activity = await githubService.gatherDailyActivity();
    return new Response(JSON.stringify(activity, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error gathering activity:', error);
    return new Response('Error gathering activity', { status: 500 });
  }
}
