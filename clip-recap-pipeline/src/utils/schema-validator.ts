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
 * Validate format constraints
 */
function validateFormat(value: string, format: string): string | null {
  switch (format) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'must be a valid email address';
      }
      break;
    case 'uri':
      try {
        new URL(value);
      } catch {
        return 'must be a valid URI';
      }
      break;
    case 'date':
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value) || isNaN(Date.parse(value))) {
        return 'must be a valid date in YYYY-MM-DD format';
      }
      break;
    case 'date-time':
      if (isNaN(Date.parse(value))) {
        return 'must be a valid ISO date-time string';
      }
      break;
  }
  return null;
}

/**
 * Validate array item against schema
 */
function validateArrayItem(item: any, itemSchema: any, fieldPath: string): ValidationResult {
  const errors: string[] = [];
  
  if (itemSchema.type === 'string') {
    if (typeof item !== 'string') {
      errors.push(`Field '${fieldPath}' must be a string`);
    } else {
      if (itemSchema.maxLength && item.length > itemSchema.maxLength) {
        errors.push(`Field '${fieldPath}' must be at most ${itemSchema.maxLength} characters long`);
      }
      if (itemSchema.format) {
        const formatError = validateFormat(item, itemSchema.format);
        if (formatError) {
          errors.push(`Field '${fieldPath}': ${formatError}`);
        }
      }
    }
  } else if (itemSchema.type === 'number') {
    if (typeof item !== 'number' || isNaN(item)) {
      errors.push(`Field '${fieldPath}' must be a valid number`);
    }
  } else if (itemSchema.type === 'integer') {
    if (typeof item !== 'number' || isNaN(item) || !Number.isInteger(item)) {
      errors.push(`Field '${fieldPath}' must be a valid integer`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate object against schema
 */
function validateObject(obj: any, objSchema: any, fieldPath: string): ValidationResult {
  const errors: string[] = [];
  
  // Check for additional properties if not allowed
  if (objSchema.additionalProperties === false) {
    const allowedProps = Object.keys(objSchema.properties || {});
    const actualProps = Object.keys(obj);
    const extraProps = actualProps.filter(prop => !allowedProps.includes(prop));
    if (extraProps.length > 0) {
      errors.push(`Field '${fieldPath}' contains disallowed properties: ${extraProps.join(', ')}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
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
          maxLength: prop.maxLength,
          minLength: prop.minLength,
          enum: prop.enum,
          format: prop.format,
          pattern: prop.pattern,
          const: prop.const
        };
      } else if (prop.type === 'number') {
        schema[propName] = { 
          type: 'number', 
          required: jsonSchema.required?.includes(propName) || false,
          min: prop.minimum,
          max: prop.maximum,
          enum: prop.enum,
          const: prop.const
        };
      } else if (prop.type === 'integer') {
        schema[propName] = { 
          type: 'integer', 
          required: jsonSchema.required?.includes(propName) || false,
          min: prop.minimum,
          max: prop.maximum,
          enum: prop.enum,
          const: prop.const
        };
      } else if (prop.type === 'boolean') {
        schema[propName] = { 
          type: 'boolean', 
          required: jsonSchema.required?.includes(propName) || false,
          enum: prop.enum,
          const: prop.const
        };
      } else if (prop.type === 'array') {
        schema[propName] = { 
          type: 'array', 
          required: jsonSchema.required?.includes(propName) || false,
          maxItems: prop.maxItems,
          minItems: prop.minItems,
          uniqueItems: prop.uniqueItems,
          items: prop.items
        };
      } else if (prop.type === 'object') {
        schema[propName] = { 
          type: 'object', 
          required: jsonSchema.required?.includes(propName) || false,
          properties: prop.properties,
          additionalProperties: prop.additionalProperties
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
              maxLength: prop.maxLength,
              minLength: prop.minLength,
              enum: prop.enum,
              format: prop.format,
              pattern: prop.pattern,
              const: prop.const
            };
          } else if (type === 'number') {
            schema[propName] = { 
              type: 'number', 
              required: false,
              min: prop.minimum,
              max: prop.maximum,
              enum: prop.enum,
              const: prop.const
            };
          } else if (type === 'integer') {
            schema[propName] = { 
              type: 'integer', 
              required: false,
              min: prop.minimum,
              max: prop.maximum,
              enum: prop.enum,
              const: prop.const
            };
          } else if (type === 'boolean') {
            schema[propName] = { 
              type: 'boolean', 
              required: false,
              enum: prop.enum,
              const: prop.const
            };
          } else if (type === 'array') {
            schema[propName] = { 
              type: 'array', 
              required: false,
              maxItems: prop.maxItems,
              minItems: prop.minItems,
              uniqueItems: prop.uniqueItems,
              items: prop.items
            };
          } else if (type === 'object') {
            schema[propName] = { 
              type: 'object', 
              required: false,
              properties: prop.properties,
              additionalProperties: prop.additionalProperties
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
        // Validate minLength
        if (fieldConfig.minLength !== undefined && value.length < fieldConfig.minLength) {
          errors.push(`Field '${field}' must be at least ${fieldConfig.minLength} characters long`);
          continue;
        }
        
        // Validate maxLength
        if (fieldConfig.maxLength !== undefined && value.length > fieldConfig.maxLength) {
          errors.push(`Field '${field}' must be at most ${fieldConfig.maxLength} characters long`);
          continue;
        }
        
        // Validate enum
        if (fieldConfig.enum && !fieldConfig.enum.includes(value)) {
          errors.push(`Field '${field}' must be one of: ${fieldConfig.enum.join(', ')}`);
          continue;
        }
        
        // Validate const
        if (fieldConfig.const !== undefined && value !== fieldConfig.const) {
          errors.push(`Field '${field}' must be exactly '${fieldConfig.const}'`);
          continue;
        }
        
        // Validate format
        if (fieldConfig.format) {
          const formatError = validateFormat(value, fieldConfig.format);
          if (formatError) {
            errors.push(`Field '${field}': ${formatError}`);
            continue;
          }
        }
        
        // Validate pattern
        if (fieldConfig.pattern) {
          const regex = new RegExp(fieldConfig.pattern);
          if (!regex.test(value)) {
            errors.push(`Field '${field}' must match pattern: ${fieldConfig.pattern}`);
            continue;
          }
        }
        
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
        
        // Validate enum
        if (fieldConfig.enum && !fieldConfig.enum.includes(value)) {
          errors.push(`Field '${field}' must be one of: ${fieldConfig.enum.join(', ')}`);
          continue;
        }
        
        // Validate const
        if (fieldConfig.const !== undefined && value !== fieldConfig.const) {
          errors.push(`Field '${field}' must be exactly ${fieldConfig.const}`);
          continue;
        }
        
        sanitizedData[field] = value;
      }
    } else if (fieldConfig.type === 'integer') {
      if (value !== null && value !== undefined && (typeof value !== 'number' || isNaN(value) || !Number.isInteger(value))) {
        errors.push(`Field '${field}' must be a valid integer`);
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
        
        // Validate enum
        if (fieldConfig.enum && !fieldConfig.enum.includes(value)) {
          errors.push(`Field '${field}' must be one of: ${fieldConfig.enum.join(', ')}`);
          continue;
        }
        
        // Validate const
        if (fieldConfig.const !== undefined && value !== fieldConfig.const) {
          errors.push(`Field '${field}' must be exactly ${fieldConfig.const}`);
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
        // Validate enum
        if (fieldConfig.enum && !fieldConfig.enum.includes(value)) {
          errors.push(`Field '${field}' must be one of: ${fieldConfig.enum.join(', ')}`);
          continue;
        }
        
        // Validate const
        if (fieldConfig.const !== undefined && value !== fieldConfig.const) {
          errors.push(`Field '${field}' must be exactly ${fieldConfig.const}`);
          continue;
        }
        
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
        
        // Validate uniqueItems
        if (fieldConfig.uniqueItems && value.length !== new Set(value).size) {
          errors.push(`Field '${field}' must contain unique items`);
          continue;
        }
        
        // Validate array items if schema is provided
        if (fieldConfig.items) {
          for (let i = 0; i < value.length; i++) {
            const itemValidation = validateArrayItem(value[i], fieldConfig.items, `${field}[${i}]`);
            if (!itemValidation.isValid && itemValidation.errors) {
              errors.push(...itemValidation.errors);
              continue;
            }
          }
        }
        
        sanitizedData[field] = value;
      }
    } else if (fieldConfig.type === 'object') {
      if (value !== null && value !== undefined && (typeof value !== 'object' || Array.isArray(value))) {
        errors.push(`Field '${field}' must be an object`);
        continue;
      }
      if (value !== null && value !== undefined) {
        // Validate object properties if schema is provided
        if (fieldConfig.properties) {
          const objectValidation = validateObject(value, fieldConfig, field);
          if (!objectValidation.isValid && objectValidation.errors) {
            errors.push(...objectValidation.errors);
            continue;
          }
        }
        
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
