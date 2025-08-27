import type { Environment } from '../types/index.js';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  clip_id: string;
  created_at: string;
  model: string;
  language: string;
  segments: TranscriptSegment[];
  text: string;
  redacted: boolean;
}

export class TranscriptionService {
  constructor(private env: Environment) {}

  /**
   * Redact PII from transcript text
   */
  private redactText(text: string): string {
    return text
      // Email addresses
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
      // IP addresses (validated octets 0-255)
      .replace(/\b(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g, '[ip]')
      // API keys/tokens (20+ chars with at least one digit and one letter, allowing common punctuation)
      .replace(/\b(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9\-_\.]{20,}\b/g, '[token]')
      // URLs with sensitive data
      .replace(/https?:\/\/[^\s]+(?:password|token|key|secret)[^\s]*/gi, '[url]')
      // Database connection strings
      .replace(/postgresql:\/\/[^@]+@[^\s]+/gi, '[db_connection]')
      .replace(/mysql:\/\/[^@]+@[^\s]+/gi, '[db_connection]')
      // Environment variable patterns (targeted secret-looking names)
      .replace(/\b(SECRET|API_KEY|TOKEN|PASSWORD|KEY|ACCESS_TOKEN|PRIVATE_KEY|SECRET_KEY)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/gi, '[env_var]');
  }

  /**
   * Convert transcript segments to VTT format
   */
  private toVTT(segments: TranscriptSegment[]): string {
    if (!segments?.length) return '';

    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    
    /**
     * Format time in VTT format with proper validation and precision
     * @param seconds - Time in seconds (must be non-negative)
     * @returns Formatted time string in HH:MM:SS.mmm format
     */
    const formatTime = (seconds: number): string => {
      // Validate input: ensure non-negative number
      if (typeof seconds !== 'number' || seconds < 0 || !isFinite(seconds)) {
        console.warn(`Invalid time value: ${seconds}, using 0`);
        seconds = 0;
      }

      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      const si = Math.floor(s);
      
      // Fix millisecond calculation to prevent values >= 1000
      // Use Math.floor instead of Math.round and ensure proper bounds
      const ms = Math.floor((s - si) * 1000);
      const clampedMs = Math.min(ms, 999); // Ensure ms never exceeds 999
      
      return `${pad(h)}:${pad(m)}:${pad(si)}.${pad(clampedMs, 3)}`;
    };

    const lines = ['WEBVTT', ''];
    let i = 1;

    for (const segment of segments) {
      // Validate segment data
      if (!segment || typeof segment !== 'object') {
        console.warn('Invalid segment data, skipping');
        continue;
      }

      // Validate and sanitize time values
      const start = typeof segment.start === 'number' && segment.start >= 0 ? segment.start : 0;
      const end = typeof segment.end === 'number' && segment.end > start ? segment.end : (start + 1);
      
      // Validate text
      const text = typeof segment.text === 'string' ? segment.text.trim() : '';
      if (!text) {
        console.warn('Empty segment text, skipping');
        continue;
      }
      
      lines.push(String(i++));
      lines.push(`${formatTime(start)} --> ${formatTime(end)}`);
      lines.push(text);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Transcribe audio file using Workers AI Whisper
   */
  async transcribeClip(clipId: string): Promise<TranscriptResult | null> {
    try {
      console.log(`🎤 Starting transcription for clip ${clipId}`);

      // Check if already transcribed
      const existingTranscript = await this.env.R2_BUCKET.get(`transcripts/${clipId}.json`);
      if (existingTranscript) {
        console.log(`📝 Transcript already exists for ${clipId}, skipping`);
        return await existingTranscript.json() as TranscriptResult;
      }

      // Get audio file from R2
      const audioObj = await this.env.R2_BUCKET.get(`audio/${clipId}.wav`);
      if (!audioObj || !('body' in audioObj)) {
        console.error(`❌ Audio file not found for clip ${clipId}`);
        return null;
      }

      // Convert to Uint8Array for Whisper
      const audioBuffer = await new Response(audioObj.body).arrayBuffer();
      const audioBytes = new Uint8Array(audioBuffer);

      console.log(`🎵 Audio loaded for ${clipId}, size: ${audioBytes.length} bytes`);

      // Call Whisper API - pass Uint8Array directly to avoid memory duplication
      // The Whisper API accepts TypedArray/buffer directly, no need to spread into new array
      const whisperResponse = await this.env.ai.run('@cf/openai/whisper-large-v3-turbo', {
        audio: audioBytes
      });

      console.log(`✅ Whisper transcription completed for ${clipId}`);

      // Process and redact transcript
      const rawText = (whisperResponse.text || '').trim();
      const redactedText = this.redactText(rawText);

      // Process segments if available
      const segments: TranscriptSegment[] = [];
      if (whisperResponse.segments && Array.isArray(whisperResponse.segments)) {
        for (const segment of whisperResponse.segments) {
          if (segment.text) {
            segments.push({
              start: segment.start || 0,
              end: segment.end || (segment.start + 1),
              text: this.redactText(segment.text)
            });
          }
        }
      }

      // Create transcript result
      const transcript: TranscriptResult = {
        clip_id: clipId,
        created_at: new Date().toISOString(),
        model: 'whisper-large-v3-turbo',
        language: whisperResponse.language || 'en',
        segments,
        text: redactedText,
        redacted: true
      };

      // Store transcript files
      await this.storeTranscript(clipId, transcript);

      console.log(`💾 Transcript stored for ${clipId}`);
      return transcript;

    } catch (error) {
      console.error(`❌ Transcription failed for ${clipId}:`, error);
      return null;
    }
  }

  /**
   * Store transcript in multiple formats
   */
  private async storeTranscript(clipId: string, transcript: TranscriptResult): Promise<void> {
    const timestamp = new Date().toISOString();

    // Store JSON transcript
    await this.env.R2_BUCKET.put(
      `transcripts/${clipId}.json`,
      JSON.stringify(transcript, null, 2),
      {
        httpMetadata: {
          contentType: 'application/json',
        },
      }
    );

    // Store plain text transcript
    await this.env.R2_BUCKET.put(
      `transcripts/${clipId}.txt`,
      transcript.text,
      {
        httpMetadata: {
          contentType: 'text/plain; charset=utf-8',
        },
      }
    );

    // Store VTT if segments available
    if (transcript.segments.length > 0) {
      const vtt = this.toVTT(transcript.segments);
      await this.env.R2_BUCKET.put(
        `transcripts/${clipId}.vtt`,
        vtt,
        {
          httpMetadata: {
            contentType: 'text/vtt; charset=utf-8',
          },
        }
      );
    }

    // Store processing marker
    await this.env.R2_BUCKET.put(
      `transcripts/${clipId}.ok`,
      timestamp,
      {
        httpMetadata: {
          contentType: 'text/plain',
        },
      }
    );
  }

  /**
   * Transcribe multiple clips
   */
  async transcribeClips(clipIds: string[]): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{ clipId: string; success: boolean; error?: string }>;
  }> {
    const results = {
      total: clipIds.length,
      successful: 0,
      failed: 0,
      results: [] as Array<{ clipId: string; success: boolean; error?: string }>
    };

    console.log(`🎤 Starting batch transcription for ${clipIds.length} clips`);

    for (const clipId of clipIds) {
      try {
        const transcript = await this.transcribeClip(clipId);
        if (transcript) {
          results.successful++;
          results.results.push({ clipId, success: true });
        } else {
          results.failed++;
          results.results.push({ clipId, success: false, error: 'Transcription failed' });
        }
      } catch (error) {
        results.failed++;
        results.results.push({ 
          clipId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    console.log(`📊 Batch transcription completed: ${results.successful}/${results.total} successful`);
    return results;
  }

  /**
   * Get transcript for a clip
   */
  async getTranscript(clipId: string): Promise<TranscriptResult | null> {
    try {
      const transcriptObj = await this.env.R2_BUCKET.get(`transcripts/${clipId}.json`);
      if (!transcriptObj) {
        return null;
      }
      return await transcriptObj.json() as TranscriptResult;
    } catch (error) {
      console.error(`Error getting transcript for ${clipId}:`, error);
      return null;
    }
  }

  /**
   * Check if transcript exists
   */
  async hasTranscript(clipId: string): Promise<boolean> {
    try {
      const marker = await this.env.R2_BUCKET.head(`transcripts/${clipId}.ok`);
      return !!marker;
    } catch {
      return false;
    }
  }
}
