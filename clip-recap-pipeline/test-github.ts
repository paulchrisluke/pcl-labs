// Simple test script for GitHub service
// Run with: npx tsx test-github.ts

import { GitHubService } from './src/services/github.js';
import reposConfig from './src/config/repos.json';

async function testGitHubService() {
  // Build tokens map from environment variables
  const tokens: Record<string, string> = {};
  
  // Add global fallback token
  const globalToken = process.env.GITHUB_TOKEN;
  if (globalToken) {
    // Use global token for all repos that don't have specific tokens
    for (const repo of reposConfig.repositories) {
      if (!tokens[repo.tokenKey]) {
        tokens[repo.tokenKey] = globalToken;
      }
    }
  }
  
  // Add repo-specific tokens if they exist
  for (const repo of reposConfig.repositories) {
    const repoToken = process.env[repo.tokenKey];
    if (repoToken) {
      tokens[repo.tokenKey] = repoToken;
    }
  }
  
  // Check if we have any tokens
  if (Object.keys(tokens).length === 0) {
    console.error('Please set GITHUB_TOKEN environment variable or repo-specific tokens');
    console.log('You can get a token from: https://github.com/settings/tokens');
    console.log('Required scopes: repo (for private repos) or public_repo (for public repos)');
    console.log('Available token keys:', reposConfig.repositories.map(r => r.tokenKey).join(', '));
    process.exit(1);
  }

  try {
    console.log('🔍 Testing GitHub service...');
    console.log('📋 Using tokens for:', Object.keys(tokens).join(', '));
    
    const githubService = new GitHubService(tokens);
    
    console.log('📊 Gathering daily activity...');
    const activity = await githubService.gatherDailyActivity();
    
    console.log(`✅ Found activity for ${activity.length} repositories:`);
    activity.forEach(repo => {
      console.log(`  - ${repo.owner}/${repo.repository}: ${repo.summary.totalCommits} commits, ${repo.summary.totalPRs} PRs`);
    });
    
    console.log('\n📝 Computing daily summary...');
    // Compute summary from the activity data
    const summary = computeDailySummary(activity);
    console.log('📊 Daily Summary:');
    console.log(JSON.stringify(summary, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing GitHub service:', error);
    process.exit(1);
  }
}

function computeDailySummary(activity: any[]) {
  const summary = {
    totalRepositories: activity.length,
    totalCommits: 0,
    totalPRs: 0,
    totalIssues: 0,
    totalReleases: 0,
    topContributors: new Set<string>(),
    repositories: activity.map(repo => ({
      name: `${repo.owner}/${repo.repository}`,
      commits: repo.summary.totalCommits,
      prs: repo.summary.totalPRs,
      issues: repo.summary.totalIssues,
      releases: repo.summary.totalReleases,
      contributors: repo.summary.topContributors
    }))
  };
  
  // Aggregate totals
  activity.forEach(repo => {
    summary.totalCommits += repo.summary.totalCommits;
    summary.totalPRs += repo.summary.totalPRs;
    summary.totalIssues += repo.summary.totalIssues;
    summary.totalReleases += repo.summary.totalReleases;
    
    // Add contributors to the set
    repo.summary.topContributors.forEach((contributor: string) => {
      summary.topContributors.add(contributor);
    });
  });
  
  // Convert Set to Array for JSON serialization
  summary.topContributors = Array.from(summary.topContributors);
  
  return summary;
}

testGitHubService();
