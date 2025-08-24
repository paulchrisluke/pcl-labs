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
  
  // For now, return a placeholder
  // In production, you'd sign this with the private key
  return btoa(JSON.stringify(header)) + '.' + btoa(JSON.stringify(payload)) + '.signature';
}
