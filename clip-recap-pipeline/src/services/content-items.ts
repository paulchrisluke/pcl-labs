import type { Environment } from '../types/index.js';
import type { ContentItem } from '../types/content.js';
import { validateContentItem, sanitizeContentItem, validateSchemaVersion } from '../utils/schema-validator.js';

export interface ContentItemQuery {
  date_range?: {
    start: string;
    end: string;
  };
  processing_status?: ContentItem['processing_status'];
  content_category?: ContentItem['content_category'];
  limit?: number;
  offset?: number;
}

export interface ContentItemListResponse {
  items: ContentItem[];
  total: number;
  has_more: boolean;
  next_offset?: string;
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
   */
  private generateContentItemKey(clipId: string, createdAt: string): string {
    const date = new Date(createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `recaps/content-items/${year}/${month}/${clipId}.json`;
  }

  /**
   * Store a ContentItem in R2
   */
  async storeContentItem(contentItem: ContentItem): Promise<boolean> {
    try {
      // Validate and sanitize the ContentItem
      const validation = sanitizeContentItem(contentItem);
      if (!validation.isValid) {
        console.error('❌ ContentItem validation failed:', validation.errors);
        return false;
      }

      // Validate schema version
      validateSchemaVersion(contentItem);

      // Generate storage key
      const key = this.generateContentItemKey(contentItem.clip_id, contentItem.clip_created_at);
      
      // Store in R2
      await this.env.R2_BUCKET.put(key, JSON.stringify(validation.sanitizedData), {
        httpMetadata: {
          contentType: 'application/json',
        },
        customMetadata: {
          'schema-version': contentItem.schema_version,
          'clip-id': contentItem.clip_id,
          'created-at': contentItem.clip_created_at,
          'processing-status': contentItem.processing_status,
        },
      });

      console.log(`✅ Stored ContentItem: ${contentItem.clip_id} at ${key}`);
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
      
      // Validate the retrieved data
      const validation = validateContentItem(data);
      if (!validation.isValid) {
        console.error('❌ Retrieved ContentItem validation failed:', validation.errors);
        return null;
      }

      return validation.sanitizedData as ContentItem;
    } catch (error) {
      console.error('❌ Failed to retrieve ContentItem:', error);
      return null;
    }
  }

  /**
   * List ContentItems with filtering and pagination
   */
  async listContentItems(query: ContentItemQuery = {}): Promise<ContentItemListResponse> {
    try {
      const { date_range, processing_status, content_category, limit = 50, offset: initialOffset = 0 } = query;
      let offset = initialOffset;
      
      // Build prefix for listing
      let prefix = 'recaps/content-items/';
      if (date_range) {
        const startDate = new Date(date_range.start);
        const endDate = new Date(date_range.end);
        
        // For date range queries, we need to list all relevant year/month folders
        const items: ContentItem[] = [];
        let total = 0;
        let hasMore = false;
        
        // Iterate through date range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, '0');
          const monthPrefix = `recaps/content-items/${year}/${month}/`;
          
          const monthObjects = await this.env.R2_BUCKET.list({ prefix: monthPrefix });
          
          for (const obj of monthObjects.objects) {
            if (offset > 0) {
              offset--;
              continue;
            }
            
            if (items.length >= limit) {
              hasMore = true;
              break;
            }
            
            try {
              const object = await this.env.R2_BUCKET.get(obj.key);
              if (object) {
                const data = await object.json();
                const validation = validateContentItem(data);
                
                if (validation.isValid) {
                  const item = validation.sanitizedData as ContentItem;
                  
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
          
          if (hasMore) break;
          
          // Move to next month
          currentDate.setMonth(currentDate.getMonth() + 1);
          currentDate.setDate(1);
        }
        
        return {
          items,
          total,
          has_more: hasMore,
        };
      } else {
        // Simple listing without date range
        const objects = await this.env.R2_BUCKET.list({ 
          prefix,
          limit: limit + offset + 1 // Get extra to check if there are more
        });
        
        const items: ContentItem[] = [];
        let total = 0;
        
        for (let i = offset; i < Math.min(offset + limit, objects.objects.length); i++) {
          const obj = objects.objects[i];
          try {
            const object = await this.env.R2_BUCKET.get(obj.key);
            if (object) {
              const data = await object.json();
              const validation = validateContentItem(data);
              
              if (validation.isValid) {
                const item = validation.sanitizedData as ContentItem;
                
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
          total,
          has_more: objects.objects.length > offset + limit,
        };
      }
    } catch (error) {
      console.error('❌ Failed to list ContentItems:', error);
      return {
        items: [],
        total: 0,
        has_more: false,
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
   * Count ContentItems by processing status
   */
  async getProcessingStatusCounts(): Promise<Record<ContentItem['processing_status'], number>> {
    const statuses: ContentItem['processing_status'][] = [
      'pending', 'audio_ready', 'transcribed', 'enhanced', 'ready_for_content'
    ];
    
    const counts: Record<ContentItem['processing_status'], number> = {
      pending: 0,
      audio_ready: 0,
      transcribed: 0,
      enhanced: 0,
      ready_for_content: 0,
    };
    
    for (const status of statuses) {
      const response = await this.listContentItems({ processing_status: status, limit: 1 });
      counts[status] = response.total;
    }
    
    return counts;
  }
}
