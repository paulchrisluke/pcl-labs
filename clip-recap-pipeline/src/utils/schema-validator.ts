import Ajv from 'ajv';
import contentItemSchema from '../../schema/content-item.schema.json' with { type: 'json' };
import manifestSchema from '../../schema/manifest.schema.json' with { type: 'json' };

// Initialize Ajv
const ajv = new (Ajv as any)({
  allErrors: true,
  strict: false,
  verbose: true,
});

// Compile validators
const contentItemValidator = ajv.compile(contentItemSchema);
const manifestValidator = ajv.compile(manifestSchema);

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  sanitizedData?: any;
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
 * Validate a ContentItem against the schema
 */
export function validateContentItem(data: any): ValidationResult {
  const isValid = contentItemValidator(data);
  
  if (!isValid) {
    return {
      isValid: false,
      errors: contentItemValidator.errors?.map((error: any) => 
        `${error.instancePath} ${error.message}`.trim()
      ) || ['Validation failed']
    };
  }
  
  return {
    isValid: true
  };
}

/**
 * Validate a Manifest against the schema
 */
export function validateManifest(data: any): ValidationResult {
  const isValid = manifestValidator(data);
  
  if (!isValid) {
    return {
      isValid: false,
      errors: manifestValidator.errors?.map((error: any) => 
        `${error.instancePath} ${error.message}`.trim()
      ) || ['Validation failed']
    };
  }
  
  return {
    isValid: true
  };
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
