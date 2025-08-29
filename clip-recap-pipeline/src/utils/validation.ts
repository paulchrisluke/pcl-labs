// Validation utilities for the clip-recap-pipeline

import type { TwitchClip, EnhancedTwitchClip } from '../types/index.js';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedData?: any;
}

export interface FieldConfig {
  type: 'string' | 'array' | 'boolean' | 'object' | 'number';
  maxLength?: number;
  maxItems?: number;
  required?: boolean;
  min?: number;
  max?: number;
}

export interface ValidationSchema {
  [field: string]: FieldConfig;
}

// Validation function for clipId to prevent path traversal attacks
export function validateClipId(clipId: string): ValidationResult {
  // Check for null/undefined
  if (!clipId || typeof clipId !== 'string') {
    return { isValid: false, error: 'clipId must be a non-empty string' };
  }

  // Check length (reasonable limit for Twitch clip IDs)
  if (clipId.length > 50) {
    return { isValid: false, error: 'clipId is too long (max 50 characters)' };
  }

  // Check for dangerous characters that could enable path traversal
  const dangerousPattern = /[\/\\\.\0]/;
  if (dangerousPattern.test(clipId)) {
    return { isValid: false, error: 'clipId contains invalid characters' };
  }

  // Only allow alphanumeric characters, hyphens, and underscores
  const validPattern = /^[A-Za-z0-9_-]+$/;
  if (!validPattern.test(clipId)) {
    return { isValid: false, error: 'clipId contains invalid characters (only A-Z, a-z, 0-9, _, - allowed)' };
  }

  return { isValid: true };
}

// Sanitize string inputs to remove dangerous characters
export function sanitizeString(input: string): string {
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove dangerous characters that could be used for XSS
    .replace(/[<>\"'&]/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Trim whitespace
    .trim();
}

// Generic validation function using a schema
export function validateData(data: any, schema: ValidationSchema, forbiddenFields: string[] = []): ValidationResult {
  // Check if data is a plain object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { isValid: false, error: 'data must be a plain object' };
  }

  // Check for forbidden fields
  for (const field of forbiddenFields) {
    if (field in data) {
      return { isValid: false, error: `Field '${field}' is not allowed to be modified` };
    }
  }

  // Validate and sanitize each field
  const sanitizedData: any = {};
  const errors: string[] = [];

  for (const [field, value] of Object.entries(data)) {
    // Check if field is allowed
    if (!(field in schema)) {
      errors.push(`Field '${field}' is not allowed`);
      continue;
    }

    const fieldConfig = schema[field];
    
    // Type validation
    if (fieldConfig.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`Field '${field}' must be a string`);
        continue;
      }
      
      // Length validation
      if (fieldConfig.maxLength && value.length > fieldConfig.maxLength) {
        errors.push(`Field '${field}' is too long (max ${fieldConfig.maxLength} characters)`);
        continue;
      }
      
      // Sanitize string inputs
      const sanitized = sanitizeString(value);
      sanitizedData[field] = sanitized;
      
    } else if (fieldConfig.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`Field '${field}' must be an array`);
        continue;
      }
      
      // Array length validation
      if (fieldConfig.maxItems && value.length > fieldConfig.maxItems) {
        errors.push(`Field '${field}' has too many items (max ${fieldConfig.maxItems})`);
        continue;
      }
      
      // Validate array contents (assuming string array for tags)
      if (field === 'tags') {
        const sanitizedTags = value
          .filter((tag: any) => typeof tag === 'string')
          .map((tag: string) => sanitizeString(tag))
          .filter((tag: string) => tag.length > 0 && tag.length <= 50);
        
        sanitizedData[field] = sanitizedTags;
      } else {
        sanitizedData[field] = value;
      }
      
    } else if (fieldConfig.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`Field '${field}' must be a boolean`);
        continue;
      }
      sanitizedData[field] = value;
      
    } else if (fieldConfig.type === 'number') {
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(`Field '${field}' must be a valid number`);
        continue;
      }
      
      // Range validation
      if (fieldConfig.min !== undefined && value < fieldConfig.min) {
        errors.push(`Field '${field}' must be at least ${fieldConfig.min}`);
        continue;
      }
      
      if (fieldConfig.max !== undefined && value > fieldConfig.max) {
        errors.push(`Field '${field}' must be at most ${fieldConfig.max}`);
        continue;
      }
      
      sanitizedData[field] = value;
      
    } else if (fieldConfig.type === 'object') {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`Field '${field}' must be an object`);
        continue;
      }
      sanitizedData[field] = value;
    }
  }

  if (errors.length > 0) {
    return { isValid: false, error: `Validation errors: ${errors.join(', ')}` };
  }

  return { isValid: true, sanitizedData };
}

// Predefined schema for clip data validation
export const CLIP_DATA_SCHEMA: ValidationSchema = {
  title: { type: 'string', maxLength: 200, required: false },
  description: { type: 'string', maxLength: 1000, required: false },
  tags: { type: 'array', maxItems: 20, required: false },
  category: { type: 'string', maxLength: 100, required: false },
  language: { type: 'string', maxLength: 10, required: false },
  is_public: { type: 'boolean', required: false },
  custom_metadata: { type: 'object', required: false }
};

// Predefined forbidden fields for clip data
export const CLIP_FORBIDDEN_FIELDS = [
  '_id', 'id', 'owner', 'created_at', 'updated_at', 
  'broadcaster_id', 'creator_id', 'broadcaster_name', 
  'creator_name', 'url', 'embed_url', 'thumbnail_url'
];

// Convenience function for clip data validation
export function validateClipData(data: Partial<TwitchClip>): ValidationResult {
  return validateData(data, CLIP_DATA_SCHEMA, CLIP_FORBIDDEN_FIELDS);
}

// Schema for complete clip objects (including required id field)
export const CLIP_OBJECT_SCHEMA: ValidationSchema = {
  id: { type: 'string', maxLength: 50, required: true },
  title: { type: 'string', maxLength: 200, required: false },
  description: { type: 'string', maxLength: 1000, required: false },
  tags: { type: 'array', maxItems: 20, required: false },
  category: { type: 'string', maxLength: 100, required: false },
  language: { type: 'string', maxLength: 10, required: false },
  is_public: { type: 'boolean', required: false },
  custom_metadata: { type: 'object', required: false },
  // Twitch-specific fields that might be present
  url: { type: 'string', maxLength: 500, required: false },
  embed_url: { type: 'string', maxLength: 500, required: false },
  thumbnail_url: { type: 'string', maxLength: 500, required: false },
  duration: { type: 'number', min: 0, max: 3600, required: false },
  view_count: { type: 'number', min: 0, required: false },
  created_at: { type: 'string', maxLength: 50, required: false },
  broadcaster_name: { type: 'string', maxLength: 100, required: false },
  creator_name: { type: 'string', maxLength: 100, required: false }
};

// Forbidden fields for complete clip objects (system-managed fields)
export const CLIP_OBJECT_FORBIDDEN_FIELDS = [
  '_id', 'owner', 'updated_at', 'broadcaster_id', 'creator_id'
];

// Validation function for complete clip objects
export function validateClipObject(clip: TwitchClip | EnhancedTwitchClip): ValidationResult {
  return validateData(clip, CLIP_OBJECT_SCHEMA, CLIP_OBJECT_FORBIDDEN_FIELDS);
}
