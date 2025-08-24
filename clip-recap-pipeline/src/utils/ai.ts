import { Env } from '../types';

export interface AIRetryOptions {
  timeout?: number;
  retries?: number;
}

export class AIService {
  constructor(private env: Env) {}

  async callWithRetry(
    model: string, 
    params: any, 
    options: AIRetryOptions = { timeout: 30000, retries: 2 }
  ): Promise<any> {
    for (let i = 0; i <= options.retries!; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout);
        
        const result = await this.env.ai.run(model, params, { signal: controller.signal });
        clearTimeout(timeoutId);
        return result;
      } catch (error) {
        if (i === options.retries) throw error;
        console.log(`AI call failed, retrying... (${i + 1}/${options.retries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
      }
    }
  }
}
