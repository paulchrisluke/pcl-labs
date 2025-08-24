// Simple test script for GitHub service
// Run with: node test-github.js

import { GitHubService } from './src/services/github.js';

async function testGitHubService() {
  // You'll need to set this environment variable or pass it directly
  const githubToken = process.env.GITHUB_TOKEN;
  
  if (!githubToken) {
    console.error('Please set GITHUB_TOKEN environment variable');
    console.log('You can get a token from: https://github.com/settings/tokens');
    console.log('Required scopes: repo (for private repos) or public_repo (for public repos)');
    process.exit(1);
  }

  try {
    console.log('🔍 Testing GitHub service...');
    
    const githubService = new GitHubService(githubToken);
    
    console.log('📊 Gathering daily activity...');
    const activity = await githubService.gatherDailyActivity();
    
    console.log(`✅ Found activity for ${activity.length} repositories:`);
    activity.forEach(repo => {
      console.log(`  - ${repo.owner}/${repo.repository}: ${repo.summary.totalCommits} commits, ${repo.summary.totalPRs} PRs`);
    });
    
    console.log('\n📝 Generating daily summary...');
    const summary = await githubService.generateDailySummary();
    console.log(summary);
    
  } catch (error) {
    console.error('❌ Error testing GitHub service:', error);
    process.exit(1);
  }
}

testGitHubService();
