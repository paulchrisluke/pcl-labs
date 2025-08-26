import type { Environment } from '../types/index.js';

export async function handleWebhook(
  request: Request,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // Read raw bytes to ensure HMAC matches GitHub's calculation
    const bodyBytes = await request.arrayBuffer();
    const signature = request.headers.get('x-hub-signature-256');
    if (!env.GITHUB_WEBHOOK_SECRET) {
      console.error('Missing GITHUB_WEBHOOK_SECRET');
      return new Response('Internal Server Error', { status: 500 });
    }

    // Verify webhook signature
    if (!(await verifyWebhookSignature(bodyBytes, signature, env.GITHUB_WEBHOOK_SECRET))) {
      return new Response('Unauthorized', { status: 401 });
    }

    const event = request.headers.get('x-github-event');
    if (!event) {
      return new Response('Bad Request: Missing x-github-event', { status: 400 });
    }
    let payload: any;
    try {
      payload = JSON.parse(new TextDecoder().decode(bodyBytes));
    } catch (e) {
      console.error('Invalid JSON payload', e);
      return new Response('Bad Request: Invalid JSON', { status: 400 });
    }

    const delivery = request.headers.get('x-github-delivery');
    console.log(`Received GitHub webhook: ${event} (delivery: ${delivery})`);

    switch (event) {
      case 'pull_request': {
        return await handlePullRequestEvent(payload, env);
      }
      case 'check_run': {
        return await handleCheckRunEvent(payload, env);
      }
      default: {
        console.log(`Unhandled event type: ${event}`);
        return new Response(null, { status: 204 });
      }
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function verifyWebhookSignature(
  body: ArrayBuffer,
  signature: string | null,
  secret: string
): Promise<boolean> {
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

    // Convert secret to key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    // Import key for HMAC verification
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode provided hex signature into bytes
    const sigBytes = new Uint8Array(
      signatureValue.match(/.{1,2}/g)!.map(h => parseInt(h, 16))
    );

    // Timing-safe HMAC-SHA256 verification on raw bytes
    return crypto.subtle.verify('HMAC', key, sigBytes, body);
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
