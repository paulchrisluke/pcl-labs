/**
 * Simple error tracking utility for monitoring application errors
 * In a production environment, this could be replaced with Sentry, DataDog, or similar
 */

export interface ErrorMetric {
  type: string;
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
  count: number;
}

class ErrorTracker {
  private errorCounts: Map<string, ErrorMetric> = new Map();
  private maxErrors = 1000; // Prevent memory leaks

  /**
   * Recursively sanitize context objects to redact sensitive information
   */
  private sanitizeContext(ctx?: Record<string, any>): Record<string, any> | undefined {
    if (!ctx) return undefined;
    
    const sanitized: Record<string, any> = {};
    const sensitiveKeyPattern = /(token|secret|password|authorization|api[-_]?key|cookie)/i;
    
    for (const [key, value] of Object.entries(ctx)) {
      if (sensitiveKeyPattern.test(key)) {
        sanitized[key] = '***redacted***';
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'object' && item !== null ? this.sanitizeContext(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Track an error occurrence
   */
  trackError(type: string, message: string, context?: Record<string, any>): void {
    const key = `${type}:${message}`;
    const now = new Date();
    
    if (this.errorCounts.has(key)) {
      const existing = this.errorCounts.get(key)!;
      existing.count++;
      existing.timestamp = now;
      if (context) {
        existing.context = { ...existing.context, ...context };
      }
    } else {
      // Clean up old errors if we're at capacity
      if (this.errorCounts.size >= this.maxErrors) {
        this.cleanupOldErrors();
        
        // If still at capacity after cleanup, evict the oldest entry
        if (this.errorCounts.size >= this.maxErrors) {
          this.evictOldestEntry();
        }
      }
      
      this.errorCounts.set(key, {
        type,
        message,
        context,
        timestamp: now,
        count: 1
      });
    }

    // Log to console for immediate visibility with sanitized context
    const sanitizedContext = this.sanitizeContext(context);
    if (sanitizedContext) {
      console.error(`🚨 [${type}] ${message}`, 'Context:', sanitizedContext);
    } else {
      console.error(`🚨 [${type}] ${message}`);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorTypes: Record<string, number>;
    recentErrors: ErrorMetric[];
  } {
    const errorTypes: Record<string, number> = {};
    const recentErrors: ErrorMetric[] = [];
    let totalErrors = 0;

    for (const entry of this.errorCounts) {
      const metric = entry[1];
      totalErrors += metric.count;
      errorTypes[metric.type] = (errorTypes[metric.type] || 0) + metric.count;
      recentErrors.push(metric);
    }

    // Sort by most recent
    recentErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      totalErrors,
      errorTypes,
      recentErrors: recentErrors.slice(0, 50) // Return last 50 errors
    };
  }

  /**
   * Clean up old errors to prevent memory leaks
   */
  private cleanupOldErrors(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const toDelete: string[] = [];

    for (const entry of this.errorCounts) {
      const key = entry[0];
      const metric = entry[1];
      if (metric.timestamp < cutoff) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.errorCounts.delete(key);
    }

    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} old error entries`);
    }
  }

  /**
   * Evict the oldest entry from the error map
   */
  private evictOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = new Date();

    for (const [key, metric] of this.errorCounts) {
      if (metric.timestamp < oldestTimestamp) {
        oldestTimestamp = metric.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.errorCounts.delete(oldestKey);
      console.log(`🗑️ Evicted oldest error entry: ${oldestKey}`);
    }
  }

  /**
   * Clear all error tracking data
   */
  clear(): void {
    this.errorCounts.clear();
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker();

/**
 * Helper function to track content migration errors
 */
export function trackContentMigrationError(
  errorType: 'missing_clip_id' | 'conversion_failed' | 'storage_failed' | 'json_parse_failed' | 'clip_validation_failed' | 'clip_read_failed' | 'clip_not_found_in_storage',
  message: string,
  context?: Record<string, any>
): void {
  errorTracker.trackError(`content_migration_${errorType}`, message, context);
}
