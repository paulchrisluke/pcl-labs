import { Env, TwitchClip, TwitchTokenResponse, Transcript } from '../types';

export class TwitchService {
  constructor(private env: Env) {}

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

  async getRecentClips(): Promise<TwitchClip[]> {
    const token = await this.getAccessToken();
    
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
    // For now, we'll need to implement clip downloading
    // This is a placeholder - actual implementation would need to:
    // 1. Parse the clip URL to get the actual video URL
    // 2. Download the video
    // 3. Extract audio
    
    throw new Error('Clip audio downloading not yet implemented');
  }

  private async transcribeAudio(audioBuffer: ArrayBuffer, clipId: string): Promise<Transcript> {
    // Use Workers AI Whisper for transcription
    const result = await this.env.ai.run('@cf/openai/whisper-large-v3-turbo', {
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
