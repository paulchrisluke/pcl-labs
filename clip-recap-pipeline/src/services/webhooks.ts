import { Env } from '../types';

export async function handleWebhook(
  request: Request, 
  env: Env, 
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    
    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature, env.GITHUB_WEBHOOK_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const event = request.headers.get('x-github-event');
    const payload = JSON.parse(body);
    
    console.log(`Received GitHub webhook: ${event}`);
    
    switch (event) {
      case 'pull_request':
        return handlePullRequestEvent(payload, env);
      case 'check_run':
        return handleCheckRunEvent(payload, env);
      default:
        console.log(`Unhandled event type: ${event}`);
        return new Response('OK', { status: 200 });
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

function verifyWebhookSignature(body: string, signature: string | null, secret: string): boolean {
  // This is a simplified signature verification
  // In production, you'd use crypto to verify the HMAC signature
  return true; // Placeholder
}

async function handlePullRequestEvent(payload: any, env: Env): Promise<Response> {
  const { action, pull_request } = payload;
  
  console.log(`PR ${action}: #${pull_request.number} - ${pull_request.title}`);
  
  // Handle PR events (merged, closed, etc.)
  if (action === 'closed' && pull_request.merged) {
    console.log(`PR #${pull_request.number} was merged`);
    // Could trigger additional actions here
  }
  
  return new Response('OK', { status: 200 });
}

async function handleCheckRunEvent(payload: any, env: Env): Promise<Response> {
  const { action, check_run } = payload;
  
  console.log(`Check run ${action}: ${check_run.name} - ${check_run.conclusion}`);
  
  // Handle check run events
  if (action === 'completed') {
    console.log(`Check run completed: ${check_run.name} with conclusion: ${check_run.conclusion}`);
  }
  
  return new Response('OK', { status: 200 });
}
