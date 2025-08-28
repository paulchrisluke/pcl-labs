/**
 * Mock R2 Bucket implementation for testing
 * 
 * This provides a consistent, realistic simulation of Cloudflare R2 bucket behavior
 * with proper return types and data persistence during test runs.
 */

// In-memory storage for mock R2 data
const r2Store = new Map<string, {
  data: Uint8Array;
  size: number;
  uploaded: string;
  httpMetadata?: {
    contentType?: string;
    [key: string]: any;
  };
}>();

export interface MockR2Object {
  key: string;
  size: number;
  uploaded: string;
  httpMetadata?: {
    contentType?: string;
    [key: string]: any;
  };
}

export interface MockR2ListResult {
  objects: MockR2Object[];
  truncated: boolean;
  cursor?: string;
}

export interface MockR2GetResult {
  body: Blob;
  size: number;
  uploaded: string;
  httpMetadata?: {
    contentType?: string;
    [key: string]: any;
  };
  json: () => Promise<any>;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface MockR2PutResult {
  ok: boolean;
  size: number;
  uploaded: string;
}

export interface MockR2HeadResult {
  size: number;
  uploaded: string;
  httpMetadata?: {
    contentType?: string;
    [key: string]: any;
  };
  ok: boolean;
}

export class MockR2Bucket {
  /**
   * Store data in the mock R2 bucket
   */
  async put(
    key: string, 
    data: string | Uint8Array, 
    options?: {
      httpMetadata?: {
        contentType?: string;
        [key: string]: any;
      };
      [key: string]: any;
    }
  ): Promise<MockR2PutResult> {
    console.log(`📤 Mock R2 put: ${key}`);
    
    let uint8Data: Uint8Array;
    if (typeof data === 'string') {
      uint8Data = new TextEncoder().encode(data);
    } else {
      uint8Data = data;
    }
    
    console.log(`📄 Data size: ${uint8Data.length} bytes`);
    if (options?.httpMetadata?.contentType) {
      console.log(`📋 Content-Type: ${options.httpMetadata.contentType}`);
    }
    
    // Store the data in our in-memory Map
    r2Store.set(key, {
      data: uint8Data,
      size: uint8Data.length,
      uploaded: new Date().toISOString(),
      httpMetadata: options?.httpMetadata
    });
    
    return {
      ok: true,
      size: uint8Data.length,
      uploaded: new Date().toISOString()
    };
  }

  /**
   * Retrieve data from the mock R2 bucket
   */
  async get(key: string): Promise<MockR2GetResult | null> {
    console.log(`📥 Mock R2 get: ${key}`);
    
    const stored = r2Store.get(key);
    if (!stored) {
      console.log(`❌ No data found for key: ${key}`);
      return null;
    }
    
    console.log(`📄 Retrieved ${stored.size} bytes`);
    
    // Create a Blob with the stored data
    const contentType = stored.httpMetadata?.contentType || 'application/octet-stream';
    const blob = new Blob([stored.data.buffer.slice(stored.data.byteOffset, stored.data.byteOffset + stored.data.byteLength) as ArrayBuffer], { type: contentType });
    
    return {
      body: blob,
      size: stored.size,
      uploaded: stored.uploaded,
      httpMetadata: stored.httpMetadata,
      json: async () => {
        try {
          const text = new TextDecoder().decode(stored.data);
          return JSON.parse(text);
        } catch (error) {
          throw new Error(`Failed to parse JSON for key ${key}: ${error}`);
        }
      },
      text: async () => {
        return new TextDecoder().decode(stored.data);
      },
      arrayBuffer: async () => {
        return stored.data.buffer.slice(
          stored.data.byteOffset,
          stored.data.byteOffset + stored.data.byteLength
        ) as ArrayBuffer;
      }
    };
  }

  /**
   * List objects in the mock R2 bucket
   */
  async list(options?: {
    prefix?: string;
    delimiter?: string;
    cursor?: string;
    limit?: number;
    [key: string]: any;
  }): Promise<MockR2ListResult> {
    console.log(`📋 Mock R2 list: ${options?.prefix || 'all'}`);
    
    let objects = Array.from(r2Store.entries()).map(([key, value]) => ({
      key,
      size: value.size,
      uploaded: value.uploaded,
      httpMetadata: value.httpMetadata
    }));
    
    // Apply prefix filter if specified
    if (options?.prefix) {
      objects = objects.filter(obj => obj.key.startsWith(options.prefix!));
    }
    
    // Apply limit if specified
    const limit = options?.limit || 1000;
    const truncated = objects.length > limit;
    objects = objects.slice(0, limit);
    
    console.log(`📊 Found ${objects.length} objects${truncated ? ' (truncated)' : ''}`);
    
    return {
      objects,
      truncated,
      cursor: truncated ? `cursor-${Date.now()}` : undefined
    };
  }

  /**
   * Get metadata for an object without retrieving the full content
   */
  async head(key: string): Promise<MockR2HeadResult | null> {
    console.log(`🔍 Mock R2 head: ${key}`);
    
    const stored = r2Store.get(key);
    if (!stored) {
      console.log(`❌ No data found for key: ${key}`);
      return null;
    }
    
    console.log(`📄 Object size: ${stored.size} bytes`);
    
    return {
      size: stored.size,
      uploaded: stored.uploaded,
      httpMetadata: stored.httpMetadata,
      ok: true
    };
  }

  /**
   * Delete an object from the mock R2 bucket
   */
  async delete(key: string): Promise<{ ok: boolean }> {
    console.log(`🗑️ Mock R2 delete: ${key}`);
    
    const deleted = r2Store.delete(key);
    console.log(`✅ Object ${deleted ? 'deleted' : 'not found'}: ${key}`);
    
    return { ok: deleted };
  }

  /**
   * Clear all stored data (useful for test cleanup)
   */
  clear(): void {
    console.log(`🧹 Mock R2 clear: ${r2Store.size} objects removed`);
    r2Store.clear();
  }

  /**
   * Get the number of stored objects
   */
  get size(): number {
    return r2Store.size;
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return r2Store.has(key);
  }
}

/**
 * Create a mock environment with the improved R2 bucket
 */
export function createMockEnvironment(): any {
  return {
    R2_BUCKET: new MockR2Bucket()
  };
}
