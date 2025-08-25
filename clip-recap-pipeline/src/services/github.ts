import { Octokit } from '@octokit/rest';
import reposConfig from '../config/repos.json';

// Type for GitHub pull request with optional stats
interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  user?: { login: string } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

interface Repository {
  name: string;
  owner: string;
  type: string;
  enabled: boolean;
  description: string;
  tokenKey: string;
}

interface GitActivity {
  repository: string;
  owner: string;
  commits: CommitInfo[];
  pullRequests: PRInfo[];
  issues: IssueInfo[];
  releases: ReleaseInfo[];
  summary: {
    totalCommits: number;
    totalPRs: number;
    totalIssues: number;
    totalReleases: number;
    topContributors: string[];
  };
}

interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

interface PRInfo {
  number: number;
  title: string;
  state: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

interface IssueInfo {
  number: number;
  title: string;
  state: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  labels: string[];
}

interface ReleaseInfo {
  id: number;
  name: string;
  tagName: string;
  publishedAt: string;
  url: string;
  description: string;
}

export class GitHubService {
  private config: typeof reposConfig;
  private tokens: Record<string, string>;

  constructor(tokens: Record<string, string>) {
    this.tokens = tokens;
    this.config = reposConfig;
  }

  private getOctokitForRepo(repo: Repository): Octokit {
    const token = this.tokens[repo.tokenKey];
    if (!token) {
      throw new Error(`No token found for repository ${repo.owner}/${repo.name} (key: ${repo.tokenKey})`);
    }
    return new Octokit({
      auth: token,
    });
  }

  async gatherDailyActivity(): Promise<GitActivity[]> {
    const activities: GitActivity[] = [];
    const lookbackDate = new Date();
    lookbackDate.setHours(lookbackDate.getHours() - this.config.settings.lookbackHours);

    for (const repo of this.config.repositories) {
      if (!repo.enabled) continue;

      try {
        const activity = await this.getRepositoryActivity(repo, lookbackDate);
        activities.push(activity);
      } catch (error) {
        console.error(`Error gathering activity for ${repo.owner}/${repo.name}:`, error);
      }
    }

    return activities;
  }

  private async getRepositoryActivity(repo: Repository, since: Date): Promise<GitActivity> {
    const [commits, pullRequests, issues, releases] = await Promise.all([
      this.getCommits(repo, since),
      this.getPullRequests(repo, since),
      this.getIssues(repo, since),
      this.getReleases(repo, since),
    ]);

    const topContributors = this.getTopContributors(commits);

    return {
      repository: repo.name,
      owner: repo.owner,
      commits,
      pullRequests,
      issues,
      releases,
      summary: {
        totalCommits: commits.length,
        totalPRs: pullRequests.length,
        totalIssues: issues.length,
        totalReleases: releases.length,
        topContributors,
      },
    };
  }

  private async getCommits(repo: Repository, since: Date): Promise<CommitInfo[]> {
    const octokit = this.getOctokitForRepo(repo);
    const { data: commits } = await octokit.repos.listCommits({
      owner: repo.owner,
      repo: repo.name,
      since: since.toISOString(),
      per_page: this.config.settings.maxCommitsPerRepo,
    });

    return commits
      .filter(commit => this.shouldIncludeCommit(commit.commit.message))
      .map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || commit.author?.login || 'Unknown',
        date: commit.commit.author?.date || '',
        url: commit.html_url,
        filesChanged: 0, // Would need additional API call to get this
        additions: 0, // Would need additional API call to get this
        deletions: 0, // Would need additional API call to get this
      }));
  }

  private async getPullRequests(repo: Repository, since: Date): Promise<PRInfo[]> {
    const octokit = this.getOctokitForRepo(repo);
    const { data: prs } = await octokit.pulls.list({
      owner: repo.owner,
      repo: repo.name,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: this.config.settings.maxPRsPerRepo,
    });

    return (prs as GitHubPullRequest[])
      .filter(pr => new Date(pr.updated_at) >= since)
      .map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user?.login || 'Unknown',
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        url: pr.html_url,
        additions: pr.additions ?? 0,
        deletions: pr.deletions ?? 0,
        changedFiles: pr.changed_files ?? 0,
      }));
  }

  private async getIssues(repo: Repository, since: Date): Promise<IssueInfo[]> {
    if (!this.config.settings.includeIssues) return [];

    const octokit = this.getOctokitForRepo(repo);
    const { data: issues } = await octokit.issues.listForRepo({
      owner: repo.owner,
      repo: repo.name,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: 50,
    });

    return issues
      .filter(issue => !issue.pull_request && new Date(issue.updated_at) >= since)
      .map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        author: issue.user?.login || 'Unknown',
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        url: issue.html_url,
        labels: issue.labels.map(label => typeof label === 'string' ? label : label.name || ''),
      }));
  }

  private async getReleases(repo: Repository, since: Date): Promise<ReleaseInfo[]> {
    if (!this.config.settings.includeReleases) return [];

    const octokit = this.getOctokitForRepo(repo);
    const { data: releases } = await octokit.repos.listReleases({
      owner: repo.owner,
      repo: repo.name,
      per_page: 10,
    });

    return releases
      .filter(release => release.published_at && new Date(release.published_at) >= since)
      .map(release => ({
        id: release.id,
        name: release.name || release.tag_name,
        tagName: release.tag_name,
        publishedAt: release.published_at || '',
        url: release.html_url,
        description: release.body || '',
      }));
  }

  private shouldIncludeCommit(message: string): boolean {
    const excludePatterns = this.config.settings.filterPatterns.excludePatterns;
    return !excludePatterns.some((pattern: string) => {
      try {
        return new RegExp(pattern).test(message);
      } catch (error) {
        console.error(`Invalid regex pattern: ${pattern}`, error);
        return false;
      }
    });
  }

  private getTopContributors(commits: CommitInfo[]): string[] {
    const contributorCounts = commits.reduce((acc, commit) => {
      acc[commit.author] = (acc[commit.author] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(contributorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([author]) => author);
  }


}
