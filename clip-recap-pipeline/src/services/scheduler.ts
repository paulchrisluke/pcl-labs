import { Environment } from '../types';
import { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';
import { TwitchService } from './twitch';
import { ContentService } from './content';
import { DiscordService } from './discord';

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
  
  // Handle daily pipeline (09:00 ICT)
  if (event.cron === "0 9 * * *") {
    await handleDailyPipeline(env);
    return;
  }
  
  console.log(`Unknown cron pattern: ${event.cron}`);
}

async function handleTokenValidation(env: Environment): Promise<void> {
  console.log('Starting hourly Twitch token validation...');
  
  try {
    const twitchService = new TwitchService(env);
    const token = await twitchService.getValidatedToken();
    console.log('✅ Token validation successful');
  } catch (error) {
    console.error('❌ Token validation failed:', error);
    // Could send Discord notification here if needed
  }
}

async function handleDailyPipeline(env: Environment): Promise<void> {
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
    
    // Step 2: Transcribe clips
    console.log(`Transcribing ${clips.length} clips...`);
    const transcripts = await twitchService.transcribeClips(clips);
    
    // Step 3: Score and select best clips
    console.log('Scoring and selecting clips...');
    const selectedClips = await contentService.selectBestClips(clips, transcripts);
    
    // Step 4: Generate blog post
    console.log('Generating blog post...');
    const blogPost = await contentService.generateBlogPost(selectedClips, transcripts);
    
    // Step 5: Create GitHub PR
    console.log('Creating GitHub PR...');
    const pr = await contentService.createPR(blogPost);
    
    // Step 6: Judge the content
    console.log('Running content judge...');
    const judgeResult = await contentService.judgeContent(blogPost);
    
    // Step 7: Update PR with judge results
    await contentService.updatePRWithJudgeResults(pr.number, judgeResult);
    
    // Step 8: Send Discord notification
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
