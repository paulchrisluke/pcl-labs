import type { Environment } from '../types/index.js';

export interface DeduplicationResult {
  clipId: string;
  needsDownload: boolean;
  existingFiles: string[];
  reason: string;
}

export class DeduplicationService {
  constructor(private env: Environment) {}

  /**
   * Check if a clip already has video files in R2 storage
   */
  async checkClipVideoExists(clipId: string): Promise<DeduplicationResult> {
    const existingFiles: string[] = [];
    
    try {
      // Check for video files with different extensions
      const videoExtensions = ['.mp4', '.mkv', '.webm'];
      
      for (const ext of videoExtensions) {
        const videoKey = `clips/${clipId}${ext}`;
        try {
          const headResult = await this.env.R2_BUCKET.head(videoKey);
          if (headResult) {
            existingFiles.push(videoKey);
          }
        } catch (error) {
          // File doesn't exist, continue checking other extensions
        }
      }
      
      // Check for audio file as well (indicates processing was completed)
      const audioKey = `audio/${clipId}.wav`;
      try {
        const audioHeadResult = await this.env.R2_BUCKET.head(audioKey);
        if (audioHeadResult) {
          existingFiles.push(audioKey);
        }
      } catch (error) {
        // Audio file doesn't exist
      }
      
      const needsDownload = existingFiles.length === 0;
      const reason = needsDownload 
        ? 'No video or audio files found in R2 storage'
        : `Found existing files: ${existingFiles.join(', ')}`;
      
      return {
        clipId,
        needsDownload,
        existingFiles,
        reason
      };
      
    } catch (error) {
      console.error(`Error checking video existence for clip ${clipId}:`, error);
      return {
        clipId,
        needsDownload: true, // Default to downloading if check fails
        existingFiles: [],
        reason: `Error checking files: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check multiple clips for existing video files
   */
  async checkClipsForDeduplication(clipIds: string[]): Promise<{
    clipsToDownload: string[];
    clipsToSkip: DeduplicationResult[];
    summary: {
      total: number;
      toDownload: number;
      toSkip: number;
    };
  }> {
    console.log(`🔍 Checking ${clipIds.length} clips for existing video files...`);
    
    const results = await Promise.all(
      clipIds.map(clipId => this.checkClipVideoExists(clipId))
    );
    
    const clipsToDownload: string[] = [];
    const clipsToSkip: DeduplicationResult[] = [];
    
    for (const result of results) {
      if (result.needsDownload) {
        clipsToDownload.push(result.clipId);
      } else {
        clipsToSkip.push(result);
      }
    }
    
    const summary = {
      total: clipIds.length,
      toDownload: clipsToDownload.length,
      toSkip: clipsToSkip.length
    };
    
    console.log(`📊 Deduplication summary: ${summary.toDownload} to download, ${summary.toSkip} to skip`);
    
    if (clipsToSkip.length > 0) {
      console.log(`⏭️ Skipping clips with existing files:`);
      clipsToSkip.forEach(result => {
        console.log(`   - ${result.clipId}: ${result.reason}`);
      });
    }
    
    if (clipsToDownload.length > 0) {
      console.log(`📥 Clips to download: ${clipsToDownload.join(', ')}`);
    }
    
    return {
      clipsToDownload,
      clipsToSkip,
      summary
    };
  }

  /**
   * Get detailed information about existing files for a clip
   */
  async getClipFileInfo(clipId: string): Promise<{
    clipId: string;
    videoFiles: Array<{
      key: string;
      size?: number;
      lastModified?: Date;
    }>;
    audioFiles: Array<{
      key: string;
      size?: number;
      lastModified?: Date;
    }>;
    transcriptFiles: Array<{
      key: string;
      size?: number;
      lastModified?: Date;
    }>;
  }> {
    const videoFiles: Array<{ key: string; size?: number; lastModified?: Date }> = [];
    const audioFiles: Array<{ key: string; size?: number; lastModified?: Date }> = [];
    const transcriptFiles: Array<{ key: string; size?: number; lastModified?: Date }> = [];
    
    try {
      // Check video files
      const videoExtensions = ['.mp4', '.mkv', '.webm'];
      for (const ext of videoExtensions) {
        const videoKey = `clips/${clipId}${ext}`;
        try {
          const headResult = await this.env.R2_BUCKET.head(videoKey);
          if (headResult) {
            videoFiles.push({
              key: videoKey,
              size: headResult.size,
              lastModified: headResult.lastModified
            });
          }
        } catch (error) {
          // File doesn't exist
        }
      }
      
      // Check audio files
      const audioKey = `audio/${clipId}.wav`;
      try {
        const audioHeadResult = await this.env.R2_BUCKET.head(audioKey);
        if (audioHeadResult) {
          audioFiles.push({
            key: audioKey,
            size: audioHeadResult.size,
            lastModified: audioHeadResult.lastModified
          });
        }
      } catch (error) {
        // Audio file doesn't exist
      }
      
      // Check transcript files
      const transcriptKeys = [
        `transcripts/${clipId}.json`,
        `transcripts/${clipId}.vtt`
      ];
      
      for (const transcriptKey of transcriptKeys) {
        try {
          const transcriptHeadResult = await this.env.R2_BUCKET.head(transcriptKey);
          if (transcriptHeadResult) {
            transcriptFiles.push({
              key: transcriptKey,
              size: transcriptHeadResult.size,
              lastModified: transcriptHeadResult.lastModified
            });
          }
        } catch (error) {
          // Transcript file doesn't exist
        }
      }
      
    } catch (error) {
      console.error(`Error getting file info for clip ${clipId}:`, error);
    }
    
    return {
      clipId,
      videoFiles,
      audioFiles,
      transcriptFiles
    };
  }

  /**
   * Clean up orphaned files (files without corresponding clip metadata)
   */
  async cleanupOrphanedFiles(): Promise<{
    cleanedFiles: string[];
    errors: string[];
  }> {
    console.log('🧹 Starting orphaned file cleanup...');
    
    const cleanedFiles: string[] = [];
    const errors: string[] = [];
    
    try {
      // List all files in the clips directory
      const clipsList = await this.env.R2_BUCKET.list({ prefix: 'clips/' });
      
      if (!clipsList.objects) {
        console.log('No files found in clips directory');
        return { cleanedFiles, errors };
      }
      
      for (const obj of clipsList.objects) {
        if (!obj.key) continue;
        
        // Extract clip ID from filename
        const filename = obj.key.split('/').pop();
        if (!filename) continue;
        
        // Remove file extension to get clip ID
        const clipId = filename.replace(/\.(mp4|mkv|webm|json)$/, '');
        
        // Check if clip metadata exists
        const metadataKey = `clips/${clipId}.json`;
        try {
          const metadataExists = await this.env.R2_BUCKET.head(metadataKey);
          if (!metadataExists) {
            console.log(`🗑️ Deleting orphaned file: ${obj.key}`);
            await this.env.R2_BUCKET.delete(obj.key);
            cleanedFiles.push(obj.key);
          }
        } catch (error) {
          // Metadata doesn't exist, delete the orphaned file
          console.log(`🗑️ Deleting orphaned file: ${obj.key}`);
          try {
            await this.env.R2_BUCKET.delete(obj.key);
            cleanedFiles.push(obj.key);
          } catch (deleteError) {
            const errorMsg = `Failed to delete ${obj.key}: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        }
      }
      
      console.log(`✅ Cleanup completed: ${cleanedFiles.length} files cleaned, ${errors.length} errors`);
      
    } catch (error) {
      const errorMsg = `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
    
    return { cleanedFiles, errors };
  }
}
