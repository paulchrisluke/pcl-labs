// Simple JWT generation for GitHub App authentication using Web Crypto API
// Note: In production, you'd use a proper JWT library
export async function generateJWT(
  privateKey: string,
  appId: string,
  options: { keyId?: string; skewSeconds?: number; ttlSeconds?: number } = {}
): Promise<string> {
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

  // Header (kid optional for GitHub App key id)
  const header = (options.keyId
    ? { alg: 'RS256', typ: 'JWT', kid: options.keyId }
    : { alg: 'RS256', typ: 'JWT' }) as const;

  // Backdate iat to avoid clock skew; exp <= iat + 600s (GitHub max)
  const now = Math.floor(Date.now() / 1000);
  const skew = Math.max(0, options.skewSeconds ?? 60);
  const ttl = Math.min(600, Math.max(60, options.ttlSeconds ?? 600));
  const iat = now - skew;
  const exp = iat + ttl;
  if (exp <= now) throw new Error('generateJWT: exp must be in the future');
  const iss = String(Number(appId));
  if (iss === 'NaN') throw new Error('generateJWT: appId must be a numeric string');
  const payload = { iat, exp, iss };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  // Convert PEM private key to CryptoKey
  const pemHeaderPkcs8 = '-----BEGIN PRIVATE KEY-----';
  const pemHeaderPkcs1 = '-----BEGIN RSA PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  if (key.includes(pemHeaderPkcs1)) {
    throw new Error(
      'generateJWT: PKCS#1 (BEGIN RSA PRIVATE KEY) detected. Convert to PKCS#8 (BEGIN PRIVATE KEY). Example:\n' +
      '  openssl pkcs8 -topk8 -nocrypt -in rsa-key.pem -out key-pkcs8.pem'
    );
  }
  const pemContents = key
    .replace(pemHeaderPkcs8, '')
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
