# Security Implementation

This document describes the security measures implemented for the clip recap pipeline, specifically for the communication between Cloudflare Workers and the Python API.

## Overview

The security implementation provides:
- **HMAC Authentication**: Signed requests between Workers and Python API
- **CORS Protection**: Only allow requests from Cloudflare Workers domains
- **Rate Limiting**: Prevent abuse of the API endpoints
- **Idempotency**: Prevent duplicate processing of requests
- **Request Validation**: Comprehensive validation of all security headers

## Architecture

### Components

1. **Python API Security Middleware** (`server/src/security.py`)
   - Validates HMAC signatures
   - Enforces CORS policy
   - Implements rate limiting
   - Validates request headers

2. **Cloudflare Workers Security Service** (`clip-recap-pipeline/src/services/security.ts`)
   - Creates HMAC signatures
   - Generates security headers
   - Provides secure fetch methods
   - Implements retry logic

## Security Headers

All requests to the Python API must include these headers:

- `X-Request-Signature`: HMAC-SHA256 signature of the request
- `X-Request-Timestamp`: Unix timestamp of the request
- `X-Request-Nonce`: Random nonce for request uniqueness
- `X-Idempotency-Key`: Unique key for state-changing operations
- `Origin`: Must be from a Cloudflare Workers domain

## HMAC Signature Generation

The signature is created using:
```
payload = body + timestamp + nonce
signature = HMAC-SHA256(secret, payload)
```

### Python API (Validation)
```python
def _create_signature(self, body: str, timestamp: str, nonce: str) -> str:
    payload = f"{body}{timestamp}{nonce}"
    signature = hmac.new(
        self.hmac_secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature
```

### Cloudflare Workers (Generation)
```typescript
private async createSignature(body: string, timestamp: string, nonce: string): Promise<string> {
    const payload = `${body}${timestamp}${nonce}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.env.HMAC_SHARED_SECRET);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
```

## CORS Policy

The Python API only accepts requests from:
- `*.workers.dev` domains (Cloudflare Workers)
- Specific origin if configured via `WORKERS_ORIGIN` environment variable

## Rate Limiting

- **Requests per window**: 10 requests
- **Window duration**: 60 seconds
- **Storage**: In-memory (for production, use Redis or similar)

## Environment Variables

### Python API (Vercel)
```bash
HMAC_SHARED_SECRET=your_secure_secret_here
WORKERS_ORIGIN=*.workers.dev  # or specific origin
```

### Cloudflare Workers
```bash
HMAC_SHARED_SECRET=your_secure_secret_here
AUDIO_PROCESSOR_URL=https://your-api.vercel.app/api/audio_processor
```

## Usage Examples

### Cloudflare Workers
```typescript
import { SecurityService } from './services/security.js';

const securityService = new SecurityService(env);

// Secure GET request
const response = await securityService.secureGet(`${apiUrl}/health`);

// Secure POST request with retry logic
const response = await securityService.securePost(`${apiUrl}/process-clips`, {
    clip_ids: ['clip123'],
    background: false
});
```

### Python API
The security middleware is automatically applied to all requests. No additional code needed in the API handlers.

## Testing

Run the security test suite:
```bash
python test_security.py
```

This will test:
- HMAC signature validation
- CORS policy enforcement
- Rate limiting
- Request header validation

## Security Considerations

### HMAC Secret
- Use a cryptographically secure random string (32+ characters)
- Keep the secret secure and rotate regularly
- Never commit the secret to version control
- Use different secrets for different environments

### CORS
- Only allow necessary origins
- Consider implementing IP allowlisting for additional security
- Monitor for suspicious origin patterns

### Rate Limiting
- Adjust limits based on expected usage
- Consider implementing per-endpoint limits
- Monitor for abuse patterns

### Idempotency
- Use unique keys for each operation
- Implement proper cleanup of old keys
- Consider using a database for key storage in production

## Deployment Checklist

- [ ] Set `HMAC_SHARED_SECRET` in both environments
- [ ] Configure `WORKERS_ORIGIN` if using specific origin
- [ ] Test security implementation with `test_security.py`
- [ ] Verify CORS headers are working correctly
- [ ] Test rate limiting functionality
- [ ] Monitor logs for security violations

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check HMAC secret is set correctly in both environments
2. **CORS errors**: Verify origin is from a valid Workers domain
3. **Rate limiting**: Check if requests are being made too rapidly
4. **Signature validation failed**: Ensure timestamp is within 5-minute window

### Debug Mode

Enable debug logging by setting log level to DEBUG in the Python API.

## Future Enhancements

- [ ] IP allowlisting for additional security
- [ ] Database-backed rate limiting
- [ ] Request/response logging for security monitoring
- [ ] Automatic secret rotation
- [ ] Security metrics and alerting
