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
  const tokenBytes = new TextEncoder().encode(token);
  const adminTokenBytes = new TextEncoder().encode(adminToken);
  
  return constantTimeCompare(tokenBytes, adminTokenBytes);
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
 * Verify admin authentication using either Bearer token or X-API-Key
 * Uses constant-time comparison for security
 */
export function verifyAdminAuthWithApiKey(request: Request, env: Environment): boolean {
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  
  // Check Bearer token first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyAdminAuth(request, env);
  }
  
  // Check X-API-Key with constant-time comparison
  if (apiKey && env.ADMIN_KEY) {
    const apiKeyBytes = new TextEncoder().encode(apiKey);
    const adminKeyBytes = new TextEncoder().encode(env.ADMIN_KEY);
    
    return constantTimeCompare(apiKeyBytes, adminKeyBytes);
  }
  
  return false;
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
 */
export async function requireHmacAuth(
  request: Request,
  env: Environment,
  body: string = ''
): Promise<Response | null> {
  // Check for Authorization header first - reject immediately if present
  if (request.headers.has('authorization')) {
    return createUnauthorizedResponse('Authorization header not allowed with HMAC authentication');
  }
  
  // Proceed with HMAC validation
  const isValid = await verifyHmacSignature(request, env, body);
  if (!isValid) {
    return createUnauthorizedResponse('HMAC authentication required');
  }
  
  // Return null to indicate successful authentication
  return null;
}
