import type { Environment } from '../types/index.js';

/**
 * Constant-time byte comparison to prevent timing attacks
 * Returns true only if both arrays have the same length and all bytes match
 */
function constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  
  return result === 0;
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.toLowerCase();
  if (normalized.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.substr(i, 2), 16);
  }
  
  return bytes;
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
  
  // Generate expected signature
  const expectedSignature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Compare signatures using constant-time comparison
  try {
    const signatureBytes = hexToBytes(signature.toLowerCase());
    const expectedBytes = hexToBytes(expectedHex.toLowerCase());
    
    return constantTimeCompare(signatureBytes, expectedBytes);
  } catch {
    // If hex conversion fails, return false
    return false;
  }
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

/**
 * HMAC authentication middleware
 * Rejects requests with Authorization header before any HMAC validation
 * 
 * @param request - The request to authenticate
 * @param env - Environment variables
 * @param body - Optional body string. If not provided, will read from request
 * @returns Response if authentication failed, null if successful
 */
export async function requireHmacAuth(
  request: Request,
  env: Environment,
  body?: string
): Promise<Response | null> {
  // Startup guard: Prevent DISABLE_AUTH=true in production
  const disableAuth = env.DISABLE_AUTH === 'true' || env.DISABLE_AUTH === '1';
  const isLocalDev = env.WRANGLER_DEV === 'true' || 
                    env.NODE_ENV === 'development' || 
                    request.headers.get('host')?.includes('localhost') ||
                    request.headers.get('host')?.includes('127.0.0.1');
  
  // CRITICAL: Only allow DISABLE_AUTH=true in local development
  if (disableAuth && !isLocalDev) {
    console.error('CRITICAL SECURITY ERROR: DISABLE_AUTH=true is not allowed in production environments');
    console.error('This setting bypasses all authentication and should only be used for local development');
    console.error(`Current environment: WRANGLER_DEV=${env.WRANGLER_DEV}, NODE_ENV=${env.NODE_ENV}, host=${request.headers.get('host')}`);
    return createForbiddenResponse('DISABLE_AUTH=true is not allowed in production environments');
  }
  
  if (disableAuth && isLocalDev) {
    return null; // Allow request to proceed
  }
  
  // Check for Authorization header first - reject immediately if present
  if (request.headers.has('authorization')) {
    return createUnauthorizedResponse('Authorization header not allowed with HMAC authentication');
  }
  
  // If body is not provided, read it from a cloned request to avoid consuming the stream
  let requestBody = body ?? '';
  if (body === undefined) {
    try {
      const clonedRequest = request.clone();
      requestBody = await clonedRequest.text();
    } catch (error) {
      return createUnauthorizedResponse('Failed to read request body for authentication');
    }
  }
  
  // Proceed with HMAC validation
  const isValid = await verifyHmacSignature(request, env, requestBody);
  if (!isValid) {
    return createUnauthorizedResponse('HMAC authentication required');
  }
  
  // Return null to indicate successful authentication
  return null;
}
