// Schema validation using the existing validation system instead of ajv
// This avoids the code generation issue in Cloudflare Workers

import contentItemSchema from '../../schema/content-item.schema.json' with { type: 'json' };
import manifestSchema from '../../schema/manifest.schema.json' with { type: 'json' };

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  sanitizedData?: any;
}

/**
 * Convert JSON Schema to our validation schema format
 */
function convertJsonSchemaToValidationSchema(jsonSchema: any): any {
  const schema: any = {};
  
  if (jsonSchema.properties) {
    for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
      const prop = propSchema as any;
      
      if (prop.type === 'string') {
        schema[propName] = { 
          type: 'string', 
          required: jsonSchema.required?.includes(propName) || false,
          maxLength: prop.maxLength
        };
      } else if (prop.type === 'number' || prop.type === 'integer') {
        schema[propName] = { 
          type: 'number', 
          required: jsonSchema.required?.includes(propName) || false,
          min: prop.minimum,
          max: prop.maximum
        };
      } else if (prop.type === 'boolean') {
        schema[propName] = { 
          type: 'boolean', 
          required: jsonSchema.required?.includes(propName) || false
        };
      } else if (prop.type === 'array') {
        schema[propName] = { 
          type: 'array', 
          required: jsonSchema.required?.includes(propName) || false,
          maxItems: prop.maxItems,
          minItems: prop.minItems
        };
      } else if (prop.type === 'object') {
        schema[propName] = { 
          type: 'object', 
          required: jsonSchema.required?.includes(propName) || false
        };
      } else if (Array.isArray(prop.type)) {
        // Handle union types like ["string", "null"]
        const nonNullTypes = prop.type.filter((t: string) => t !== 'null');
        if (nonNullTypes.length === 1) {
          const type = nonNullTypes[0];
          if (type === 'string') {
            schema[propName] = { 
              type: 'string', 
              required: false,
              maxLength: prop.maxLength
            };
          } else if (type === 'number' || type === 'integer') {
            schema[propName] = { 
              type: 'number', 
              required: false,
              min: prop.minimum,
              max: prop.maximum
            };
          } else if (type === 'boolean') {
            schema[propName] = { 
              type: 'boolean', 
              required: false
            };
          } else if (type === 'array') {
            schema[propName] = { 
              type: 'array', 
              required: false,
              maxItems: prop.maxItems,
              minItems: prop.minItems
            };
          } else if (type === 'object') {
            schema[propName] = { 
              type: 'object', 
              required: false
            };
          }
        }
      }
    }
  }
  
  return schema;
}

/**
 * Simple validation function that doesn't use code generation
 */
function validateData(data: any, schema: any, requiredFields: string[] = []): ValidationResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { isValid: false, errors: ['Data must be a plain object'] };
  }

  const errors: string[] = [];
  const sanitizedData: any = {};

  // Check required fields
  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate each field
  for (const [field, value] of Object.entries(data)) {
    if (!(field in schema)) {
      continue; // Skip unknown fields
    }

    const fieldConfig = schema[field];
    
    if (fieldConfig.type === 'string') {
      if (value !== null && value !== undefined && typeof value !== 'string') {
        errors.push(`Field '${field}' must be a string`);
        continue;
      }
      if (value !== null && value !== undefined) {
        sanitizedData[field] = value;
      }
    } else if (fieldConfig.type === 'number') {
      if (value !== null && value !== undefined && (typeof value !== 'number' || isNaN(value))) {
        errors.push(`Field '${field}' must be a valid number`);
        continue;
      }
      if (value !== null && value !== undefined) {
        if (fieldConfig.min !== undefined && value < fieldConfig.min) {
          errors.push(`Field '${field}' must be at least ${fieldConfig.min}`);
          continue;
        }
        if (fieldConfig.max !== undefined && value > fieldConfig.max) {
          errors.push(`Field '${field}' must be at most ${fieldConfig.max}`);
          continue;
        }
        sanitizedData[field] = value;
      }
    } else if (fieldConfig.type === 'boolean') {
      if (value !== null && value !== undefined && typeof value !== 'boolean') {
        errors.push(`Field '${field}' must be a boolean`);
        continue;
      }
      if (value !== null && value !== undefined) {
        sanitizedData[field] = value;
      }
    } else if (fieldConfig.type === 'array') {
      if (value !== null && value !== undefined && !Array.isArray(value)) {
        errors.push(`Field '${field}' must be an array`);
        continue;
      }
      if (value !== null && value !== undefined) {
        if (fieldConfig.minItems && value.length < fieldConfig.minItems) {
          errors.push(`Field '${field}' must have at least ${fieldConfig.minItems} items`);
          continue;
        }
        if (fieldConfig.maxItems && value.length > fieldConfig.maxItems) {
          errors.push(`Field '${field}' must have at most ${fieldConfig.maxItems} items`);
          continue;
        }
        sanitizedData[field] = value;
      }
    } else if (fieldConfig.type === 'object') {
      if (value !== null && value !== undefined && (typeof value !== 'object' || Array.isArray(value))) {
        errors.push(`Field '${field}' must be an object`);
        continue;
      }
      if (value !== null && value !== undefined) {
        sanitizedData[field] = value;
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, sanitizedData };
}

// Convert schemas to our format
const contentItemValidationSchema = convertJsonSchemaToValidationSchema(contentItemSchema);
const manifestValidationSchema = convertJsonSchemaToValidationSchema(manifestSchema);

/**
 * Validate a ContentItem against the schema
 */
export function validateContentItem(data: any): ValidationResult {
  const requiredFields = contentItemSchema.required || [];
  return validateData(data, contentItemValidationSchema, requiredFields);
}

/**
 * Validate a Manifest against the schema
 */
export function validateManifest(data: any): ValidationResult {
  const requiredFields = manifestSchema.required || [];
  return validateData(data, manifestValidationSchema, requiredFields);
}

/**
 * Validate and sanitize ContentItem data
 * Removes any properties not in the schema
 */
export function sanitizeContentItem(data: any): ValidationResult {
  // Validate first - return immediately if validation fails
  const validation = validateContentItem(data);
  
  if (!validation.isValid) {
    return validation;
  }
  
  // Use schema-based introspection to sanitize the data
  const sanitizedData = sanitizeUsingSchema(data, contentItemSchema);
  
  return {
    isValid: true,
    sanitizedData
  };
}

/**
 * Validate and sanitize Manifest data
 * Removes any properties not in the schema
 */
export function sanitizeManifest(data: any): ValidationResult {
  // Validate first - return immediately if validation fails
  const validation = validateManifest(data);
  
  if (!validation.isValid) {
    return validation;
  }
  
  // Use schema-based introspection to sanitize the data
  const sanitizedData = sanitizeUsingSchema(data, manifestSchema);
  
  return {
    isValid: true,
    sanitizedData
  };
}

/**
 * Helper function to sanitize data using schema introspection
 * Builds a sanitized object by including each property if it's required or if data[prop] !== undefined
 * Handles absence of properties/required arrays and preserves original values for included keys
 */
function sanitizeUsingSchema(data: any, schema: any): any {
  const sanitized: any = {};
  
  // Get schema properties and required fields, with fallbacks for safety
  const properties = schema.properties || {};
  const required = schema.required || [];
  
  // Include all properties that are either required or present in the data
  for (const [propName, propSchema] of Object.entries(properties)) {
    const isRequired = required.includes(propName);
    const hasValue = data[propName] !== undefined;
    
    if (isRequired || hasValue) {
      sanitized[propName] = data[propName];
    }
  }
  
  return sanitized;
}

/**
 * Get schema version from data object
 */
export function getSchemaVersion(data: any): string | null {
  return data?.schema_version || null;
}

/**
 * Check if schema version is supported
 */
export function isSchemaVersionSupported(version: string): boolean {
  return version === '1.0.0';
}

/**
 * Validate schema version and throw if unsupported
 */
export function validateSchemaVersion(data: any): void {
  const version = getSchemaVersion(data);
  if (!version) {
    throw new Error('Missing schema_version field');
  }
  
  if (!isSchemaVersionSupported(version)) {
    throw new Error(`Unsupported schema version: ${version}. Supported versions: 1.0.0`);
  }
}
