import type { Environment } from '../types';
import type { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';
import { TwitchService } from './twitch.js';
import { ContentService } from './content.js';
import { DiscordService } from './discord.js';
import { TranscriptionService } from './transcribe.js';
import { DeduplicationService } from './deduplication.js';

export async function handleScheduled(
  event: ScheduledEvent,
  env: Environment,
  ctx: ExecutionContext
): Promise<void> {
  console.log(`Scheduled event triggered: ${event.cron}`);
  
  // Handle hourly token validation
  if (event.cron === "0 * * * *") {
    await handleTokenValidation(env);
    return;
  }
  
  // Handle daily pipeline (02:00 UTC = 09:00 ICT)
  if (event.cron === "0 2 * * *") {
    await handleDailyPipeline(env);
    return;
  }
  
  // Handle transcription pipeline (every 6 hours)
  if (event.cron === "0 */6 * * *") {
    await handleTranscriptionPipeline(env);
    return;
  }
  
  console.log(`Unknown cron pattern: ${event.cron}`);
}

async function handleTokenValidation(env: Environment): Promise<void> {
  console.log('Starting hourly token validation...');
  
  const validationErrors: string[] = [];
  
  // Validate Twitch credentials
  try {
    const twitchService = new TwitchService(env);
    const token = await twitchService.getValidatedToken();
    console.log('✅ Twitch token validation successful');
  } catch (error) {
    const errorMsg = `Twitch token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('❌', errorMsg);
    validationErrors.push(errorMsg);
  }

  // Validate GitHub credentials
  try {
    const contentService = new ContentService(env);
    const token = await contentService.getGitHubToken();
    console.log('✅ GitHub App token validation successful');
  } catch (error) {
    const errorMsg = `GitHub App token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('❌', errorMsg);
    validationErrors.push(errorMsg);
  }

  // Validate GitHub personal access tokens
  try {
    const testToken = env.GITHUB_TOKEN || env.GITHUB_TOKEN_PAULCHRISLUKE || env.GITHUB_TOKEN_BLAWBY;
    if (testToken) {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'clip-recap-pipeline/1.0.0',
        },
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ GitHub personal token validation successful');
    } else {
      console.log('⚠️ No GitHub personal tokens found to validate');
    }
  } catch (error) {
    const errorMsg = `GitHub personal token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('❌', errorMsg);
    validationErrors.push(errorMsg);
  }

  // Send Discord notification if there are validation errors
  if (validationErrors.length > 0) {
    try {
      const discordService = new DiscordService(env);
      await discordService.notifyTokenValidationErrors(validationErrors);
    } catch (discordError) {
      console.error('Failed to send token validation error notification:', discordError);
    }
  }
}

/**
 * Process audio for clips: download, extract, and transcribe with deduplication
 */
export async function processAudioForClips(clipIds: string[], env: Environment): Promise<void> {
  console.log(`🎵 Processing audio for ${clipIds.length} clips...`);
  
  try {
    // Step 0: Check for existing video files to avoid duplicate downloads
    console.log('🔍 Checking for existing video files...');
    const deduplicationService = new DeduplicationService(env);
    const deduplicationResult = await deduplicationService.checkClipsForDeduplication(clipIds);
    
    if (deduplicationResult.clipsToDownload.length === 0) {
      console.log('✅ All clips already have video files, skipping download phase');
    } else {
      // Step 1: Call audio processor service to download and extract audio (only for clips that need it)
      console.log(`📥 Downloading and extracting audio for ${deduplicationResult.clipsToDownload.length} clips...`);
      await processAudioWithRetry(deduplicationResult.clipsToDownload, env);
    }
    
    // Step 2: Transcribe audio files using Workers AI (for all clips that have audio)
    console.log('🎤 Transcribing audio files...');
    await processTranscriptionWithRetry(clipIds, env);
    
  } catch (error) {
    console.error('❌ Audio processing failed:', error);
    // Don't throw - allow pipeline to continue without audio processing
    console.log('⚠️ Continuing pipeline without audio processing...');
  }
}

/**
 * Process audio with retry logic and error handling
 */
async function processAudioWithRetry(clipIds: string[], env: Environment, maxRetries: number = 3): Promise<void> {
  const baseUrl = env.AUDIO_PROCESSOR_URL || 'https://pcl-labs.vercel.app';
  const audioProcessorUrl = `${baseUrl}/api/process-clips`;
  
  // Use security service for authenticated requests
  const { SecurityService } = await import('./security.js');
  const securityService = new SecurityService(env);
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📥 Audio processing attempt ${attempt}/${maxRetries}...`);
      
      const audioResponse = await securityService.securePost(`${audioProcessorUrl}`, {
        clip_ids: clipIds,
        background: false
      });
      
      if (!audioResponse.ok) {
        const errorText = await audioResponse.text();
        throw new Error(`Audio processing failed: ${audioResponse.status} - ${errorText}`);
      }
      
      const audioResult = await audioResponse.json();
      console.log(`✅ Audio processing result: ${(audioResult as any).message}`);
      
      // Wait for audio processing to complete
      console.log('⏳ Waiting for audio processing to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify audio files were created
      const verificationResults = await verifyAudioProcessing(clipIds, env);
      const successCount = verificationResults.filter(r => r.success).length;
      
      if (successCount > 0) {
        console.log(`✅ Audio processing successful for ${successCount}/${clipIds.length} clips`);
        return; // Success, exit retry loop
      } else {
        throw new Error('No audio files were created successfully');
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Audio processing attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed
  throw new Error(`Audio processing failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

/**
 * Process transcription with retry logic and error handling
 */
async function processTranscriptionWithRetry(clipIds: string[], env: Environment, maxRetries: number = 3): Promise<void> {
  const transcriptionService = new TranscriptionService(env);
  
  // Get clips that have audio but no transcript
  // Get clips that have audio but no transcript
  const clipsToTranscribe = [];
  for (const clipId of clipIds) {
    try {
      // Check for audio, but handle R2 errors gracefully
      let hasAudio = false;
      try {
        hasAudio = !!(await env.R2_BUCKET.head(`audio/${clipId}.wav`));
      } catch (r2Error) {
        console.warn(`Failed to check audio file for ${clipId}:`, r2Error);
        continue; // Skip this clip if we can't check R2
      }

      const hasTranscript = await transcriptionService.hasTranscript(clipId);
      
      if (hasAudio && !hasTranscript) {
        clipsToTranscribe.push(clipId);
      }
    } catch (error) {
      console.error(`Error checking transcription status for ${clipId}:`, error);
    }
  }
  
  if (clipsToTranscribe.length === 0) {
    console.log('✅ All clips already transcribed or no audio available');
    return;
  }
  
  console.log(`🎤 Transcribing ${clipsToTranscribe.length} clips...`);
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎤 Transcription attempt ${attempt}/${maxRetries}...`);
      
      const transcriptionResults = await transcriptionService.transcribeClips(clipsToTranscribe);
      console.log(`✅ Transcription completed: ${transcriptionResults.successful}/${transcriptionResults.total} successful`);
      
      if (transcriptionResults.successful > 0) {
        return; // Success, exit retry loop
      } else {
        throw new Error('No transcriptions were completed successfully');
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Transcription attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed
  console.error(`❌ Transcription failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  // Don't throw - allow pipeline to continue without transcription
}

/**
 * Verify that audio processing was successful
 */
async function verifyAudioProcessing(clipIds: string[], env: Environment): Promise<Array<{clipId: string, success: boolean, error?: string}>> {
  const results = [];
  
  for (const clipId of clipIds) {
    try {
      const hasAudio = await env.R2_BUCKET.head(`audio/${clipId}.wav`);
      results.push({
        clipId,
        success: !!hasAudio,
        error: hasAudio ? undefined : 'Audio file not found'
      });
    } catch (error) {
      results.push({
        clipId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

export async function handleDailyPipeline(env: Environment): Promise<void> {
  console.log('Starting daily clip recap pipeline...');
  
  try {
    const twitchService = new TwitchService(env);
    const contentService = new ContentService(env);
    const discordService = new DiscordService(env);
    
    // Step 1: Fetch clips from last 24h
    console.log('Fetching clips...');
    const clips = await twitchService.getRecentClips();
    
    if (clips.length === 0) {
      console.log('No clips found for the last 24 hours');
      return;
    }
    
    // Step 1.5: Store clips to R2
    console.log(`Storing ${clips.length} clips to R2...`);
    
    const uploadPromises = clips.map(async (clip) => {
      const key = `clips/${clip.id}.json`;
      try {
        await env.R2_BUCKET.put(key, JSON.stringify(clip), {
          httpMetadata: {
            contentType: 'application/json',
          },
        });
        return { status: 'fulfilled' as const, clipId: clip.id, key };
      } catch (error) {
        return { 
          status: 'rejected' as const, 
          clipId: clip.id, 
          key, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    const uploadResults = await Promise.allSettled(uploadPromises);
    
    // Process results and log outcomes
    let successCount = 0;
    let failureCount = 0;
    
    for (const result of uploadResults) {
      if (result.status === 'fulfilled') {
        const uploadResult = result.value;
        if (uploadResult.status === 'fulfilled') {
          successCount++;
          console.log(`✅ Successfully uploaded clip ${uploadResult.clipId} to ${uploadResult.key}`);
        } else {
          failureCount++;
          console.error(`❌ Failed to upload clip ${uploadResult.clipId} to ${uploadResult.key}: ${uploadResult.error}`);
        }
      } else {
        failureCount++;
        console.error(`❌ Upload promise rejected for unknown clip: ${result.reason}`);
      }
    }
    
    console.log(`📊 R2 upload summary: ${successCount} successful, ${failureCount} failed`);
    
    if (failureCount > 0) {
      console.warn(`⚠️ ${failureCount} clip uploads failed, but pipeline will continue`);
    } else {
      console.log('✅ All clips stored to R2 successfully');
    }
    
    // Step 1.75: Process audio for clips (download, extract, upload to R2)
    console.log('Processing audio for clips...');
    const clipIds = clips.map(clip => clip.id);
    await processAudioForClips(clipIds, env);
    
    // Step 2: Score and select best clips
    console.log('Scoring and selecting clips...');
    const selectedClips = await contentService.selectBestClips(clips, []);
    
    // Step 3: Generate blog post
    if (!selectedClips?.length) {
      console.log('No clips selected after scoring. Skipping blog generation and PR creation.');
      return;
    }
    console.log('Generating blog post...');
    const blogPost = await contentService.generateBlogPost(selectedClips, []);
    
    // Step 4: Create GitHub PR
    console.log('Creating GitHub PR...');
    const pr = await contentService.createPR(blogPost);
    
    // Step 5: Judge the content
    console.log('Running content judge...');
    const judgeResult = await contentService.judgeContent(blogPost);
    
    // Step 6: Update PR with judge results
    await contentService.updatePRWithJudgeResults(pr.number, judgeResult);
    
    // Step 7: Send Discord notification
    console.log('Sending Discord notification...');
    await discordService.notifyPRCreated(pr, judgeResult, selectedClips.length);
    
    console.log('Pipeline completed successfully!');
    
  } catch (error) {
    console.error('Pipeline failed:', error);
    
    // Send error notification to Discord
    try {
      const discordService = new DiscordService(env);
      await discordService.notifyError(error);
    } catch (discordError) {
      console.error('Failed to send error notification:', discordError);
    }
  }
}

/**
 * Handle transcription-only pipeline for existing clips
 * This runs more frequently to catch any clips that need transcription
 */
export async function handleTranscriptionPipeline(env: Environment): Promise<void> {
  console.log('Starting transcription-only pipeline...');
  
  try {
    // Get all stored clips
    console.log('📋 Getting all stored clips...');
    const list = await env.R2_BUCKET.list({ prefix: 'clips/' });
    const jsonFiles = list.objects.filter((obj: any) => obj.key.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log('No stored clips found');
      return;
    }
    
    console.log(`📊 Found ${jsonFiles.length} stored clips`);
    
    // Get clip IDs
    const clipIds = jsonFiles.map((obj: any) => obj.key.replace('clips/', '').replace('.json', ''));
    
    // Process transcription for all clips
    console.log('🎤 Processing transcription for all clips...');
    await processTranscriptionWithRetry(clipIds, env);
    
    console.log('✅ Transcription pipeline completed successfully!');
    
  } catch (error) {
    console.error('❌ Transcription pipeline failed:', error);
    
    // Send error notification to Discord
    try {
      const discordService = new DiscordService(env);
      await discordService.notifyError(error);
    } catch (discordError) {
      console.error('Failed to send error notification:', discordError);
    }
  }
}
