import type { Environment } from '../types/index.js';

/**
 * Verify admin authentication using Bearer token
 * Uses constant-time comparison for security
 */
export function verifyAdminAuth(request: Request, env: Environment): boolean {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const adminToken = env.ADMIN_FORCE_TRANSCRIBE_TOKEN || env.ADMIN_KEY;
  
  if (!adminToken) {
    console.error('Admin token not configured in environment');
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.subtle.timingSafeEqual(
    new TextEncoder().encode(token),
    new TextEncoder().encode(adminToken)
  );
}

/**
 * Verify HMAC signature for request authentication
 */
export async function verifyHmacSignature(
  request: Request, 
  env: Environment,
  body: string = ''
): Promise<boolean> {
  const signature = request.headers.get('x-request-signature');
  const timestamp = request.headers.get('x-request-timestamp');
  const nonce = request.headers.get('x-request-nonce');
  
  if (!signature || !timestamp || !nonce) {
    return false;
  }
  
  // Validate timestamp (within 5 minutes)
  try {
    const timestampInt = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestampInt) > 300) { // 5 minutes
      return false;
    }
  } catch {
    return false;
  }
  
  // Validate nonce format (alphanumeric, 16-64 chars)
  if (!/^[A-Za-z0-9]{16,64}$/.test(nonce)) {
    return false;
  }
  
  // Create expected signature
  const payload = `${body}${timestamp}${nonce}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(env.HMAC_SHARED_SECRET);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const expectedSignature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Constant-time comparison
  return crypto.subtle.timingSafeEqual(
    new TextEncoder().encode(signature),
    new TextEncoder().encode(expectedHex)
  );
}

/**
 * Create unauthorized response with consistent format
 */
export function createUnauthorizedResponse(message: string = 'Unauthorized access'): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Create forbidden response with consistent format
 */
export function createForbiddenResponse(message: string = 'Forbidden'): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' }
  });
}
