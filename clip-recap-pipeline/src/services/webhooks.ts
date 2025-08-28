import type { Environment } from '../types/index.js';
import { GitHubEventService } from './github-events.js';

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
    const contentType = request.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // GitHub sends payload as form-encoded data
        const bodyString = new TextDecoder().decode(bodyBytes);
        const params = new URLSearchParams(bodyString);
        const payloadParam = params.get('payload');
        
        if (!payloadParam) {
          console.error('No payload found in form data');
          return new Response('Bad Request: No payload in form data', { status: 400 });
        }
        
        payload = JSON.parse(payloadParam);
      } else {
        // Handle raw JSON payload (fallback)
        payload = JSON.parse(new TextDecoder().decode(bodyBytes));
      }
    } catch (e) {
      console.error('Invalid payload parsing', e);
      return new Response('Bad Request: Invalid payload', { status: 400 });
    }

    const delivery = request.headers.get('x-github-delivery');
    console.log(`Received GitHub webhook: ${event} (delivery: ${delivery})`);

    // Store the event for temporal matching (M8 - GitHub Integration)
    if (delivery && payload.repository?.full_name) {
      const storeEventTask = async () => {
        try {
          const githubEventService = new GitHubEventService(env);
          const stored = await githubEventService.storeEvent(
            delivery,
            event,
            payload,
            payload.repository.full_name
          );
          
          if (!stored) {
            console.warn(`Failed to store GitHub event: ${event} (${delivery})`);
          }
        } catch (error) {
          console.error(`Failed to store GitHub event: ${event} (${delivery})`, error);
        }
      };

      // Use ctx.waitUntil if available to offload to background task
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(storeEventTask().catch(error => {
          console.error(`Background task failed to store GitHub event: ${event} (${delivery})`, error);
        }));
      } else {
        // Fallback to synchronous execution with error handling
        try {
          await storeEventTask();
        } catch (error) {
          console.error(`Failed to store GitHub event: ${event} (${delivery})`, error);
        }
      }
    }

    switch (event) {
      case 'pull_request': {
        return await handlePullRequestEvent(payload, env);
      }
      case 'push': {
        return await handlePushEvent(payload, env);
      }
      case 'issues': {
        return await handleIssueEvent(payload, env);
      }
      case 'check_run': {
        return await handleCheckRunEvent(payload, env);
      }
      case 'ping': {
        // GitHub sends ping events to test webhook connectivity
        console.log('Received GitHub ping event - webhook is working!');
        return new Response('Pong', { status: 200 });
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

async function handlePushEvent(payload: any, env: Environment): Promise<Response> {
  const { ref, commits, repository } = payload;
  
  // Guard against non-array commits
  if (!Array.isArray(commits)) {
    console.warn(`Push event has non-array commits: ${typeof commits}`);
    return new Response('OK', { status: 200 });
  }
  
  console.log(`Push to ${ref}: ${commits.length} commits`);
  
  // Only process pushes to the repository's default branch
  const defaultBranch = repository?.default_branch;
  if (!defaultBranch) {
    console.warn(`Repository missing default_branch, skipping push processing`);
    return new Response('OK', { status: 200 });
  }
  
  if (ref === `refs/heads/${defaultBranch}`) {
    console.log(`${defaultBranch} branch push with ${commits.length} commits`);
    // Could trigger additional actions here
  }
  
  return new Response('OK', { status: 200 });
}

async function handleIssueEvent(payload: any, env: Environment): Promise<Response> {
  const { action, issue } = payload;
  
  console.log(`Issue ${action}: #${issue.number} - ${issue.title}`);
  
  // Handle issue events (closed, reopened, etc.)
  if (action === 'closed') {
    console.log(`Issue #${issue.number} was closed`);
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
