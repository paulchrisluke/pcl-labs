import type { Environment } from '../types';
import type { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';
import { TwitchService } from './twitch.js';
import { ContentService } from './content.js';
import { DiscordService } from './discord.js';

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
