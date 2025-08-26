import { Environment, TwitchClip, TwitchTokenResponse, Transcript } from '../types/index.js';
import { AIService } from '../utils/ai.js';
import { getBroadcasterId } from '../get-broadcaster-id.js';

export class TwitchService {
  private aiService: AIService;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private env: Environment) {
    this.aiService = new AIService(env);
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
    return data.data || [];
  }

  async transcribeClips(clips: TwitchClip[]): Promise<Transcript[]> {
    const transcripts: Transcript[] = [];

    for (const clip of clips) {
      try {
        console.log(`Transcribing clip: ${clip.id}`);
        
        // Download the clip audio
        const audioBuffer = await this.downloadClipAudio(clip.url);
        
        // Transcribe using Workers AI Whisper
        const transcript = await this.transcribeAudio(audioBuffer, clip.id);
        
        // Store transcript in R2
        await this.storeTranscript(clip.id, transcript);
        
        transcripts.push(transcript);
        
        console.log(`Successfully transcribed clip: ${clip.id}`);
      } catch (error) {
        console.error(`Failed to transcribe clip ${clip.id}:`, error);
        // Continue with other clips
      }
    }

    return transcripts;
  }

  private async downloadClipAudio(clipUrl: string): Promise<ArrayBuffer> {
    try {
      console.log(`Downloading clip audio from: ${clipUrl}`);
      
      // For Twitch clips, we need to get the actual video URL
      // The clip URL format is: https://www.twitch.tv/username/clip/clipId
      // We need to extract the clip ID and get the actual video URL
      
      const clipId = this.extractClipId(clipUrl);
      if (!clipId) {
        throw new Error('Could not extract clip ID from URL');
      }
      
      // Get the clip info to find the video URL
      const token = await this.getValidatedToken();
      const clipResponse = await fetch(
        `https://api.twitch.tv/helix/clips?id=${clipId}`,
        {
          headers: {
            'Client-ID': this.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!clipResponse.ok) {
        throw new Error(`Failed to get clip info: ${clipResponse.statusText}`);
      }

      const clipData = await clipResponse.json() as { data?: TwitchClip[] };
      const clip = clipData.data?.[0];
      
      if (!clip) {
        throw new Error('Clip not found');
      }

      // The Twitch Helix API doesn't provide direct video URLs
      // Video URL extraction requires additional authentication and may violate ToS
      // This is a pipeline limitation that needs to be addressed properly
      throw new Error(`Video URL extraction not implemented for clip ${clipId}. Twitch Helix API does not provide direct video URLs. This requires additional authentication and may violate ToS.`);
      
    } catch (error) {
      console.error(`Failed to download clip audio: ${error}`);
      throw error;
    }
  }

  private extractClipId(clipUrl: string): string | null {
    // Extract clip ID from various Twitch clip URL formats
    const patterns = [
      /\/clip\/([a-zA-Z0-9_-]+)/,  // Standard clip URL
      /clips\.twitch\.tv\/([a-zA-Z0-9_-]+)/,  // Direct clips URL
    ];
    
    for (const pattern of patterns) {
      const match = clipUrl.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  private async transcribeAudio(audioBuffer: ArrayBuffer, clipId: string): Promise<Transcript> {
    try {
      // Use Workers AI Whisper for transcription
      const result = await this.aiService.callWithRetry('@cf/openai/whisper-large-v3-turbo', {
        audio: audioBuffer,
      });

      // Validate that result is non-null
      if (!result) {
        throw new Error('AI service returned null or undefined result');
      }

      // Validate that result.segments is an array, fallback to empty array if missing
      const segments = Array.isArray(result.segments) ? result.segments : [];

      // Extract language from result, fallback to 'en'
      const lang = result.language || 'en';

      return {
        clip_id: clipId,
        lang,
        segments,
      };
    } catch (error) {
      console.error(`Transcription failed for clip ${clipId} using Whisper service:`, error);
      
      // Return a controlled failure transcript object with predictable shape
      return {
        clip_id: clipId,
        lang: 'en',
        segments: [],
      };
    }
  }

  private async storeTranscript(clipId: string, transcript: Transcript): Promise<void> {
    const key = `transcripts/${clipId}.json`;
    await this.env.R2_BUCKET.put(key, JSON.stringify(transcript), {
      httpMetadata: {
        contentType: 'application/json',
      },
    });
  }
}
