import { Environment } from '../types';

export interface AIRetryOptions {
  timeout?: number;
  retries?: number;
}

export class AIService {
  constructor(private env: Environment) {}

  async callWithRetry(
    model: string, 
    params: any, 
    options: AIRetryOptions = {}
  ): Promise<any> {
    const retries = options?.retries ?? 2;
    const timeout = options?.timeout ?? 30_000;
    for (let i = 0; i <= retries; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const result = await this.env.ai.run(model, params, { signal: controller.signal });
        return result;
      } catch (error) {
        if (i === retries) throw error;
        console.warn(`AI call failed, retrying... (${i + 1}/${retries})`);
        const backoffMs = 1000 * Math.pow(2, i); // 1s, 2s, 4s, ...
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }
}
