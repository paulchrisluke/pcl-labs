// Simple JWT generation for GitHub App authentication
// Note: In production, you'd use a proper JWT library

export function generateJWT(privateKey: string, appId: string): string {
  // This is a simplified JWT implementation
  // For production, use a proper JWT library like 'jsonwebtoken'
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 60), // 10 minutes
    iss: appId
  };
  
import { createSign } from 'crypto';
// Simple JWT generation for GitHub App authentication
// Note: In production, you'd use a proper JWT library
export function generateJWT(privateKey: string, appId: string): string {
  if (!privateKey) throw new Error('generateJWT: privateKey is required');
  if (!appId) throw new Error('generateJWT: appId is required');

  // Support env-stored keys with "\n" escapes
  const key = privateKey.includes('\\n')
    ? privateKey.replace(/\\n/g, '\n')
    : privateKey;

  const toBase64Url = (input: string | Buffer): string =>
    (Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  // Header
  const header = { alg: 'RS256', typ: 'JWT' } as const;

  // Backdate iat by 60s to avoid clock skew; exp = iat + 600s (GitHub max)
  const now = Math.floor(Date.now() / 1000);
  const iat = now - 60;
  const exp = iat + 600;
  const payload = { iat, exp, iss: appId };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(key); // PKCS#1 v1.5 by default

  return `${unsigned}.${toBase64Url(signature)}`;
}
}
