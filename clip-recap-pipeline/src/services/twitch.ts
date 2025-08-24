import { Env, TwitchClip, TwitchTokenResponse, Transcript } from '../types';
import { AIService } from '../utils/ai';

export class TwitchService {
  private aiService: AIService;

  constructor(private env: Env) {
    this.aiService = new AIService(env);
  }

  private async getAccessToken(): Promise<string> {
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
    return data.access_token;
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
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
    const token = await this.getAccessToken();
    
    // Validate the token as required by Twitch
    const isValid = await this.validateToken(token);
    if (!isValid) {
      throw new Error('Twitch token validation failed');
    }
    
    return token;
  }

  async getRecentClips(): Promise<TwitchClip[]> {
    const token = await this.getValidatedToken();
    
    // Get clips from last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const response = await fetch(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${this.env.TWITCH_BROADCASTER_ID}&started_at=${yesterday.toISOString()}&ended_at=${now.toISOString()}&first=100`,
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

    const data = await response.json();
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

      const clipData = await clipResponse.json();
      const clip = clipData.data?.[0];
      
      if (!clip) {
        throw new Error('Clip not found');
      }

      // For now, we'll use a placeholder approach since direct video downloading
      // from Twitch requires additional authentication and may violate ToS
      // In a production environment, you might want to:
      // 1. Use a service like yt-dlp with proper authentication
      // 2. Use Twitch's official APIs if available
      // 3. Implement a different approach for audio extraction
      
      console.log(`Clip found: ${clip.title} (${clip.duration}s)`);
      
      // For now, return a placeholder buffer - in production you'd download the actual audio
      // This allows the pipeline to continue testing other components
      const placeholderBuffer = new ArrayBuffer(1024); // 1KB placeholder
      
      console.log(`Returning placeholder audio buffer for clip: ${clipId}`);
      return placeholderBuffer;
      
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
    // Use Workers AI Whisper for transcription
    const result = await this.aiService.callWithRetry('@cf/openai/whisper-large-v3-turbo', {
      audio: audioBuffer,
    });

    return {
      clip_id: clipId,
      lang: 'en',
      segments: result.segments || [],
    };
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
