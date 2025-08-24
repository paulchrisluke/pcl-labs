// Simple JWT generation for GitHub App authentication using Web Crypto API
// Note: In production, you'd use a proper JWT library
export async function generateJWT(privateKey: string, appId: string): Promise<string> {
  if (!privateKey) throw new Error('generateJWT: privateKey is required');
  if (!appId) throw new Error('generateJWT: appId is required');

  // Support env-stored keys with "\n" escapes
  const key = privateKey.includes('\\n')
    ? privateKey.replace(/\\n/g, '\n')
    : privateKey;

  const toBase64Url = (input: string | Uint8Array): string => {
    const bytes = typeof input === 'string' 
      ? new TextEncoder().encode(input)
      : input;
    
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  };

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

  // Convert PEM private key to CryptoKey
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = key
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}
