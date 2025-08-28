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
      }
      
      this.errorCounts.set(key, {
        type,
        message,
        context,
        timestamp: now,
        count: 1
      });
    }

    // Log to console for immediate visibility
    if (context) {
      console.error(`🚨 [${type}] ${message}`, 'Context:', context);
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
