import type { Environment } from '../types/index.js';
import type { ContentItem, PaginationCursor } from '../types/content.js';
import { sanitizeContentItem, validateSchemaVersion } from '../utils/schema-validator.js';

export interface ContentItemQuery {
  date_range?: {
    start: string;
    end: string;
  };
  processing_status?: ContentItem['processing_status'];
  content_category?: ContentItem['content_category'];
  limit?: number;
  cursor?: string;
}

export interface ContentItemListResponse {
  items: ContentItem[];
  pagination: PaginationCursor;
}

/**
 * ContentItem Service - Unified data management for clips
 * Stores ContentItems in R2 with organized keyspace structure
 */
export class ContentItemService {
  private env: Environment;

  constructor(env: Environment) {
    this.env = env;
  }

  /**
   * Generate R2 key for ContentItem storage
   * Format: recaps/content-items/YYYY/MM/CLIP_ID.json
   * Uses UTC methods to ensure consistent keys across timezones
   */
  private generateContentItemKey(clipId: string, createdAt: string): string {
    const date = new Date(createdAt);
    // Validate that createdAt is a valid ISO/UTC timestamp
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format for createdAt: ${createdAt}`);
    }
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `recaps/content-items/${year}/${month}/${clipId}.json`;
  }

  /**
   * Store a ContentItem in R2
   */
  async storeContentItem(contentItem: ContentItem): Promise<boolean> {
    try {
      // Set stored_at server-side before persisting
      const itemToStore: ContentItem = {
        ...contentItem,
        stored_at: new Date().toISOString()
      };

      // Validate and sanitize the ContentItem
      const validation = sanitizeContentItem(itemToStore);
      if (!validation.isValid) {
        console.error('❌ ContentItem validation failed:', validation.errors || 'Unknown validation error');
        return false;
      }

      // Validate schema version
      validateSchemaVersion(validation.sanitizedData);

      // Generate storage key
      const key = this.generateContentItemKey(validation.sanitizedData.clip_id, validation.sanitizedData.clip_created_at);
      
      // Store in R2
      await this.env.R2_BUCKET.put(key, JSON.stringify(validation.sanitizedData), {
        httpMetadata: {
          contentType: 'application/json',
        },
        customMetadata: {
          'schema-version': validation.sanitizedData.schema_version,
          'clip-id': validation.sanitizedData.clip_id,
          'created-at': validation.sanitizedData.clip_created_at,
          'processing-status': validation.sanitizedData.processing_status,
        },
      });

      console.log(`✅ Stored ContentItem: ${validation.sanitizedData.clip_id} at ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to store ContentItem:', error);
      return false;
    }
  }

  /**
   * Retrieve a ContentItem from R2
   */
  async getContentItem(clipId: string, createdAt: string): Promise<ContentItem | null> {
    try {
      const key = this.generateContentItemKey(clipId, createdAt);
      const object = await this.env.R2_BUCKET.get(key);
      
      if (!object) {
        return null;
      }

      const data = await object.json();
      
      // Sanitize the retrieved data
      const sanitized = sanitizeContentItem(data);
      if (!sanitized.isValid) {
        console.error('❌ Retrieved ContentItem sanitization failed:', sanitized.errors || 'Unknown sanitization error');
        return null;
      }

      return sanitized.sanitizedData as ContentItem;
    } catch (error) {
      console.error('❌ Failed to retrieve ContentItem:', error);
      return null;
    }
  }

  /**
   * List ContentItems with filtering and cursor-based pagination
   */
  async listContentItems(query: ContentItemQuery = {}): Promise<ContentItemListResponse> {
    try {
      const { date_range, processing_status, content_category, limit = 50, cursor } = query;
      
      // Build prefix for listing
      let prefix = 'recaps/content-items/';
      
      if (date_range) {
        // For date range queries, we need to list all relevant year/month folders
        const items: ContentItem[] = [];
        let total = 0;
        let hasMore = false;
        let nextCursor: string | undefined;
        
        // Iterate through date range
        const startDate = new Date(date_range.start);
        const endDate = new Date(date_range.end);
        const currentDate = new Date(startDate);
        
        // If a cursor is provided, we need to determine which month to start from
        // The cursor format should be something like "recaps/content-items/2024/01/some-key"
        if (cursor) {
          const cursorParts = cursor.split('/');
          if (cursorParts.length >= 4) {
            const cursorYear = parseInt(cursorParts[2]);
            const cursorMonth = parseInt(cursorParts[3]);
            const cursorDate = new Date(cursorYear, cursorMonth - 1, 1);
            
            // If the cursor month is within our date range, start from there
            if (cursorDate >= startDate && cursorDate <= endDate) {
              currentDate.setFullYear(cursorYear);
              currentDate.setMonth(cursorMonth - 1);
              currentDate.setDate(1);
            }
          }
        }
        
        while (currentDate <= endDate) {
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, '0');
          const monthPrefix = `recaps/content-items/${year}/${month}/`;
          
          // Reset monthCursor to undefined for each new month to start from the beginning
          // Only use the provided cursor for the first month we're processing
          let monthCursor: string | undefined = undefined;
          let monthHasMore = true;
          
          // If this is the first month we're processing and we have a cursor, use it
          // We need to check if this is the month where the cursor points to
          if (cursor) {
            const cursorParts = cursor.split('/');
            if (cursorParts.length >= 4) {
              const cursorYear = parseInt(cursorParts[2]);
              const cursorMonth = parseInt(cursorParts[3]);
              
              if (year === cursorYear && month === String(cursorMonth).padStart(2, '0')) {
                monthCursor = cursor;
              }
            }
          }
          
          while (monthHasMore && items.length < limit) {
            const monthObjects = await this.env.R2_BUCKET.list({ 
              prefix: monthPrefix,
              limit: Math.min(100, limit - items.length),
              cursor: monthCursor
            });
            
            for (const obj of monthObjects.objects) {
              if (items.length >= limit) {
                hasMore = true;
                break;
              }
              
              try {
                // Use customMetadata to filter by processing_status without full GET
                const processingStatus = obj.customMetadata?.['processing-status'] as ContentItem['processing_status'];
                if (processing_status && processing_status !== processingStatus) {
                  continue;
                }
                
                const object = await this.env.R2_BUCKET.get(obj.key);
                if (object) {
                  const data = await object.json();
                  const sanitized = sanitizeContentItem(data);
                  
                  if (sanitized.isValid) {
                    const item = sanitized.sanitizedData as ContentItem;
                    
                    // Apply filters
                    if (processing_status && item.processing_status !== processing_status) continue;
                    if (content_category && item.content_category !== content_category) continue;
                    if (date_range) {
                      const itemDate = new Date(item.clip_created_at);
                      if (itemDate < startDate || itemDate > endDate) continue;
                    }
                    
                    items.push(item);
                    total++;
                  }
                }
              } catch (error) {
                console.warn(`⚠️ Failed to process object ${obj.key}:`, error);
              }
            }
            
            monthHasMore = monthObjects.truncated;
            monthCursor = monthObjects.cursor;
            
            if (monthHasMore && items.length < limit) {
              nextCursor = monthObjects.cursor;
            }
          }
          
          if (hasMore) break;
          
          // Move to next month
          currentDate.setMonth(currentDate.getMonth() + 1);
          currentDate.setDate(1);
        }
        
        return {
          items,
          pagination: {
            has_next: hasMore,
            has_prev: !!cursor,
            next_cursor: nextCursor,
            prev_cursor: cursor
          }
        };
      } else {
        // Simple listing without date range using cursor-based pagination
        const objects = await this.env.R2_BUCKET.list({ 
          prefix,
          limit,
          cursor
        });
        
        const items: ContentItem[] = [];
        let total = 0;
        
        for (const obj of objects.objects) {
          try {
            // Use customMetadata to filter by processing_status without full GET
            const processingStatus = obj.customMetadata?.['processing-status'] as ContentItem['processing_status'];
            if (processing_status && processing_status !== processingStatus) {
              continue;
            }
            
            const object = await this.env.R2_BUCKET.get(obj.key);
            if (object) {
              const data = await object.json();
              const sanitized = sanitizeContentItem(data);
              
              if (sanitized.isValid) {
                const item = sanitized.sanitizedData as ContentItem;
                
                // Apply filters
                if (processing_status && item.processing_status !== processing_status) continue;
                if (content_category && item.content_category !== content_category) continue;
                
                items.push(item);
                total++;
              }
            }
          } catch (error) {
            console.warn(`⚠️ Failed to process object ${obj.key}:`, error);
          }
        }
        
        return {
          items,
          pagination: {
            has_next: objects.truncated,
            has_prev: !!cursor,
            next_cursor: objects.cursor,
            prev_cursor: cursor
          }
        };
      }
    } catch (error) {
      console.error('❌ Failed to list ContentItems:', error);
      return {
        items: [],
        pagination: {
          has_next: false,
          has_prev: false
        }
      };
    }
  }

  /**
   * Update a ContentItem (partial update)
   */
  async updateContentItem(clipId: string, createdAt: string, updates: Partial<ContentItem>): Promise<boolean> {
    try {
      // Get existing item
      const existing = await this.getContentItem(clipId, createdAt);
      if (!existing) {
        console.error(`❌ ContentItem not found: ${clipId}`);
        return false;
      }

      // Merge updates
      const updatedItem: ContentItem = {
        ...existing,
        ...updates,
        // Ensure required fields are preserved
        schema_version: existing.schema_version,
        clip_id: existing.clip_id,
        clip_title: existing.clip_title,
        clip_url: existing.clip_url,
        clip_duration: existing.clip_duration,
        clip_created_at: existing.clip_created_at,
        stored_at: existing.stored_at,
        processing_status: updates.processing_status || existing.processing_status,
      };

      // Store updated item
      return await this.storeContentItem(updatedItem);
    } catch (error) {
      console.error('❌ Failed to update ContentItem:', error);
      return false;
    }
  }

  /**
   * Delete a ContentItem
   */
  async deleteContentItem(clipId: string, createdAt: string): Promise<boolean> {
    try {
      const key = this.generateContentItemKey(clipId, createdAt);
      await this.env.R2_BUCKET.delete(key);
      console.log(`✅ Deleted ContentItem: ${clipId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete ContentItem:', error);
      return false;
    }
  }

  /**
   * Get ContentItems for a specific date range (optimized for daily recaps)
   */
  async getContentItemsForDateRange(startDate: string, endDate: string): Promise<ContentItem[]> {
    const response = await this.listContentItems({
      date_range: { start: startDate, end: endDate },
      limit: 1000, // High limit for date range queries
    });
    
    return response.items;
  }

  /**
   * Get ContentItems ready for content generation
   */
  async getReadyContentItems(limit: number = 50): Promise<ContentItem[]> {
    const response = await this.listContentItems({
      processing_status: 'ready_for_content',
      limit,
    });
    
    return response.items;
  }

  /**
   * Count ContentItems by processing status using R2 pagination scan
   */
  async getProcessingStatusCounts(): Promise<Record<ContentItem['processing_status'], number>> {
    const counts: Record<ContentItem['processing_status'], number> = {
      pending: 0,
      audio_ready: 0,
      transcribed: 0,
      enhanced: 0,
      ready_for_content: 0,
    };
    
    let cursor: string | undefined;
    let hasMore = true;
    
    while (hasMore) {
      const objects = await this.env.R2_BUCKET.list({
        prefix: 'recaps/content-items/',
        limit: 1000,
        cursor
      });
      
      for (const obj of objects.objects) {
        try {
          // Read processing_status from customMetadata to avoid full GETs
          const processingStatus = obj.customMetadata?.['processing-status'] as ContentItem['processing_status'];
          if (processingStatus && Object.prototype.hasOwnProperty.call(counts, processingStatus)) {
            counts[processingStatus]++;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to process object ${obj.key} for status counting:`, error);
        }
      }
      
      hasMore = objects.truncated;
      cursor = objects.cursor;
    }
    
    return counts;
  }
}
