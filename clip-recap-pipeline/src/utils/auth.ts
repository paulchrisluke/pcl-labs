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
  
  const expectedSignature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Normalize both signatures to lowercase and convert to bytes for constant-time comparison
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
 * Middleware function to require HMAC authentication for endpoints
 * Returns null if authentication passes, or a Response if it fails
 * 
 * @param request - The incoming request
 * @param env - Environment variables
 * @param body - Optional body string for POST requests (to avoid double-reading)
 */
export async function requireHmacAuth(
  request: Request, 
  env: Environment,
  body?: string
): Promise<Response | null> {
  // For POST requests, check Content-Length before processing
  if (request.method === 'POST') {
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      // Limit to 10MB to prevent DoS attacks
      if (size > 10 * 1024 * 1024) {
        console.warn(`🚨 Request body too large: ${size} bytes`);
        return new Response(JSON.stringify({
          success: false,
          error: 'Request body too large (max 10MB)'
        }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // If body is not provided, read it here to avoid double-reading
    if (body === undefined) {
      body = await request.text();
    }
  } else {
    // For non-POST requests, body should be empty
    body = '';
  }

  if (!(await verifyHmacSignature(request, env, body))) {
    console.warn(`🚨 Unauthorized access attempt to ${request.url}`);
    return createUnauthorizedResponse('HMAC authentication required');
  }
  return null; // Continue processing
}
