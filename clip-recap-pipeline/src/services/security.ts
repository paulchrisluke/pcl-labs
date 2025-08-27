import type { Environment } from '../types/index.js';

export interface SecurityHeaders {
  'X-Request-Signature': string;
  'X-Request-Timestamp': string;
  'X-Request-Nonce': string;
  'X-Idempotency-Key': string;
}

export class SecurityService {
  constructor(private env: Environment) {}

  /**
   * Generate a random nonce for request signing
   */
  private generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate an idempotency key for state-changing operations
   */
  private generateIdempotencyKey(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }

  /**
   * Create HMAC signature for request authentication
   */
  private async createSignature(body: string, timestamp: string, nonce: string): Promise<string> {
    const hmacSecret = this.env.HMAC_SHARED_SECRET;
    if (!hmacSecret) {
      throw new Error('HMAC_SHARED_SECRET not configured');
    }

    // Create signature payload: body + timestamp + nonce
    const payload = `${body}${timestamp}${nonce}`;
    
    // Create HMAC signature using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(hmacSecret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    
    // Convert to hex string
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create security headers for API requests
   */
  async createSecurityHeaders(body: string = ''): Promise<SecurityHeaders> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = this.generateNonce();
    const idempotencyKey = this.generateIdempotencyKey();
    
    const signature = await this.createSignature(body, timestamp, nonce);
    
    return {
      'X-Request-Signature': signature,
      'X-Request-Timestamp': timestamp,
      'X-Request-Nonce': nonce,
      'X-Idempotency-Key': idempotencyKey,
      'Origin': 'https://clip-recap-pipeline.paulchrisluke.workers.dev',
    };
  }

  /**
   * Create a secure fetch request with all required headers
   */
  async secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const body = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : '';
    
    const securityHeaders = await this.createSecurityHeaders(body);
    
    const headers = {
      'Content-Type': 'application/json',
      ...securityHeaders,
      ...options.headers,
    };

    const secureOptions: RequestInit = {
      ...options,
      headers,
      body: options.body,
    };

    return fetch(url, secureOptions);
  }

  /**
   * Create a secure POST request with automatic retry logic
   */
  async securePost(url: string, data: any, retries: number = 3): Promise<Response> {
    const body = JSON.stringify(data);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.secureFetch(url, {
          method: 'POST',
          body,
        });

        if (response.ok) {
          return response;
        }

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return response;
        }

        // Retry on server errors (5xx) or network errors
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`Request attempt ${attempt} failed:`, error);
        
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    throw new Error(`Request failed after ${retries} attempts`);
  }

  /**
   * Create a secure GET request
   */
  async secureGet(url: string): Promise<Response> {
    return this.secureFetch(url, {
      method: 'GET',
    });
  }

  /**
   * Validate response from the Python API
   */
  async validateResponse(response: Response): Promise<boolean> {
    if (!response.ok) {
      console.error(`API request failed: ${response.status} ${response.statusText}`);
      return false;
    }

    try {
      const data = await response.json();
      return data.success !== false;
    } catch (error) {
      console.error('Failed to parse API response:', error);
      return false;
    }
  }
}
