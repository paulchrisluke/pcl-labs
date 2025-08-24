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

    // Prefer Node's Buffer if available; fallback to browser btoa
    const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
    const BufferCtor = g.Buffer;
    if (BufferCtor) {
      // Node.js path
      return BufferCtor.from(bytes)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    }
    // Browser path
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary)
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
  
  const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  const BufferCtor = g.Buffer;
  const binaryKey = BufferCtor
    ? new Uint8Array(BufferCtor.from(pemContents, 'base64'))
    : Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  // Get crypto.subtle - Cloudflare Workers environment
  const cryptoSubtle = (globalThis as any).crypto?.subtle;
  if (!cryptoSubtle) {
    throw new Error('Web Crypto API not available');
  }

  const cryptoKey = await cryptoSubtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await cryptoSubtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}
