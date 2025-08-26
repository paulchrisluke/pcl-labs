import { Environment, TwitchClip, TwitchTokenResponse } from '../types/index.js';
import { getBroadcasterId } from '../get-broadcaster-id.js';

export class TwitchService {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private env: Environment) {
  }

  private async getAccessToken(): Promise<{ token: string; expiresAt: number }> {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.env.TWITCH_CLIENT_ID,
        client_secret: this.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get Twitch token: ${response.statusText}`);
    }

    const data: TwitchTokenResponse = await response.json();
    const now = Date.now();
    return { token: data.access_token, expiresAt: now + (data.expires_in * 1000) };
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json() as { expires_in: number };
        console.log(`Token validation successful. Expires in: ${data.expires_in} seconds`);
        return true;
      } else {
        console.error(`Token validation failed: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  async getValidatedToken(): Promise<string> {
    const skewMs = 60_000; // 60s safety buffer
    if (this.tokenCache && (this.tokenCache.expiresAt - Date.now()) > skewMs) {
      return this.tokenCache.token;
    }
    const { token, expiresAt } = await this.getAccessToken();
    // Validate only on fresh grants (helps diagnostics, avoids validating on every call)
    const isValid = await this.validateToken(token);
    if (!isValid) throw new Error('Twitch token validation failed');
    this.tokenCache = { token, expiresAt };
    return token;
  }

  async getRecentClips(): Promise<TwitchClip[]> {
    const token = await this.getValidatedToken();
    
    // Get broadcaster ID using the new function
    const broadcasterId = await getBroadcasterId(this.env);
    
    // Get clips from last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    console.log(`🔍 Fetching clips from ${yesterday.toISOString()} to ${now.toISOString()}`);
    
    const response = await fetch(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&started_at=${yesterday.toISOString()}&ended_at=${now.toISOString()}&first=100`,
      {
        headers: {
          'Client-ID': this.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch clips: ${response.statusText}`);
    }

    const data = await response.json() as { data: TwitchClip[] };
    console.log(`📊 Found ${data.data?.length || 0} clips from Twitch API`);
    return data.data || [];
  }


}
