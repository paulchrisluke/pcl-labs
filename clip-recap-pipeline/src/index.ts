import { Env } from './types';
import { handleScheduled } from './services/scheduler';
import { handleWebhook } from './services/webhooks';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    // Webhook endpoints
    if (url.pathname === '/webhook/github') {
      return handleWebhook(request, env, ctx);
    }
    
    // Default response
    return new Response('Twitch Clip Recap Pipeline', { status: 200 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleScheduled(event, env, ctx);
  }
};
