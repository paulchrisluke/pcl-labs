import { Environment } from '../types';

export async function handleWebhook(
  request: Request,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    
    // Verify webhook signature
    if (!(await verifyWebhookSignature(body, signature, env.GITHUB_WEBHOOK_SECRET))) {
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

async function verifyWebhookSignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  try {
    // Reject null or malformed signatures
    if (!signature || !signature.startsWith('sha256=')) {
      return false;
    }
    
    // Extract the signature value (remove 'sha256=' prefix)
    const signatureValue = signature.substring(7);
    
    // Validate signature format (should be 64 hex characters)
    if (!/^[a-f0-9]{64}$/i.test(signatureValue)) {
      return false;
    }
    
    // Convert secret to Uint8Array
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const bodyData = encoder.encode(body);
    
    // Import key for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Compute HMAC-SHA256 digest
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, bodyData);
    const computedDigest = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Simple string comparison (timing-safe comparison not available in Web Crypto API)
    return signatureValue === computedDigest;
  } catch (error) {
    // Return false on any parsing/verification error
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

async function handlePullRequestEvent(payload: any, env: Environment): Promise<Response> {
  const { action, pull_request } = payload;
  
  console.log(`PR ${action}: #${pull_request.number} - ${pull_request.title}`);
  
  // Handle PR events (merged, closed, etc.)
  if (action === 'closed' && pull_request.merged) {
    console.log(`PR #${pull_request.number} was merged`);
    // Could trigger additional actions here
  }
  
  return new Response('OK', { status: 200 });
}

async function handleCheckRunEvent(payload: any, env: Environment): Promise<Response> {
  const { action, check_run } = payload;
  
  console.log(`Check run ${action}: ${check_run.name} - ${check_run.conclusion}`);
  
  // Handle check run events
  if (action === 'completed') {
    console.log(`Check run completed: ${check_run.name} with conclusion: ${check_run.conclusion}`);
  }
  
  return new Response('OK', { status: 200 });
}
