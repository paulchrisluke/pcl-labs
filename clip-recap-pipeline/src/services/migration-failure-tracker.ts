import type { Environment } from '../types/index.js';

/**
 * Service for tracking migration failures using KV storage
 */
export class MigrationFailureTracker {
  private env: Environment;
  private readonly MIGRATION_SESSION_KEY = 'migration_session';
  private readonly FAILURE_COUNT_KEY = 'failure_count';

  constructor(env: Environment) {
    this.env = env;
  }

  /**
   * Generate a unique migration session ID
   */
  private generateMigrationSessionId(): string {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get or create a migration session ID
   */
  async getMigrationSessionId(): Promise<string> {
    let sessionId = await this.env.MIGRATION_FAILURES.get(this.MIGRATION_SESSION_KEY);
    
    if (!sessionId) {
      sessionId = this.generateMigrationSessionId();
      await this.env.MIGRATION_FAILURES.put(this.MIGRATION_SESSION_KEY, sessionId);
    }
    
    return sessionId;
  }

  /**
   * Record a migration failure for a specific clip
   */
  async recordFailure(clipId: string, errorType: string, errorMessage: string, context?: Record<string, any>): Promise<void> {
    const sessionId = await this.getMigrationSessionId();
    const failureKey = `failure:${sessionId}:${clipId}`;
    const failureData = {
      clipId,
      errorType,
      errorMessage,
      context,
      timestamp: new Date().toISOString(),
      sessionId
    };

    // Store the failure details
    await this.env.MIGRATION_FAILURES.put(failureKey, JSON.stringify(failureData));

    // Increment the failure counter for this session
    const countKey = `${this.FAILURE_COUNT_KEY}:${sessionId}`;
    const currentCount = await this.env.MIGRATION_FAILURES.get(countKey);
    const newCount = (parseInt(currentCount || '0') + 1).toString();
    await this.env.MIGRATION_FAILURES.put(countKey, newCount);
  }

  /**
   * Get the count of failed clips for the current migration session
   */
  async getFailureCount(): Promise<number> {
    const sessionId = await this.getMigrationSessionId();
    const countKey = `${this.FAILURE_COUNT_KEY}:${sessionId}`;
    const count = await this.env.MIGRATION_FAILURES.get(countKey);
    return parseInt(count || '0');
  }

  /**
   * Get all failures for the current migration session
   */
  async getFailures(): Promise<Array<{
    clipId: string;
    errorType: string;
    errorMessage: string;
    context?: Record<string, any>;
    timestamp: string;
  }>> {
    const sessionId = await this.getMigrationSessionId();
    const failures: Array<{
      clipId: string;
      errorType: string;
      errorMessage: string;
      context?: Record<string, any>;
      timestamp: string;
    }> = [];

    // List all keys for this session
    const listResult = await this.env.MIGRATION_FAILURES.list({
      prefix: `failure:${sessionId}:`
    });

    // Fetch all failure details
    for (const key of listResult.keys) {
      const failureData = await this.env.MIGRATION_FAILURES.get(key.name);
      if (failureData) {
        try {
          const parsed = JSON.parse(failureData);
          failures.push({
            clipId: parsed.clipId,
            errorType: parsed.errorType,
            errorMessage: parsed.errorMessage,
            context: parsed.context,
            timestamp: parsed.timestamp
          });
        } catch (error) {
          console.warn(`Failed to parse failure data for key ${key.name}:`, error);
        }
      }
    }

    // Sort by timestamp (most recent first)
    return failures.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Clear all failure tracking data for the current session
   */
  async clearFailures(): Promise<void> {
    const sessionId = await this.getMigrationSessionId();
    
    // List all keys for this session
    const listResult = await this.env.MIGRATION_FAILURES.list({
      prefix: `failure:${sessionId}:`
    });

    // Delete all failure records
    for (const key of listResult.keys) {
      await this.env.MIGRATION_FAILURES.delete(key.name);
    }

    // Delete the failure count
    const countKey = `${this.FAILURE_COUNT_KEY}:${sessionId}`;
    await this.env.MIGRATION_FAILURES.delete(countKey);
  }

  /**
   * Start a new migration session
   */
  async startNewSession(): Promise<string> {
    // Clear any existing session data
    await this.clearFailures();
    
    // Generate and store new session ID
    const sessionId = this.generateMigrationSessionId();
    await this.env.MIGRATION_FAILURES.put(this.MIGRATION_SESSION_KEY, sessionId);
    
    return sessionId;
  }
}
