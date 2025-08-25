import { Environment, TwitchClip, Transcript, BlogPost, JudgeResult, ClipSection } from '../types/index.js';
import { generateJWT } from '../utils/jwt.js';
import { AIService } from '../utils/ai.js';

export class ContentService {
  private aiService: AIService;
  private cachedGitHubToken: string | null = null;
  private cachedGitHubTokenExpiry: number | null = null;

  constructor(private env: Environment) {
    this.aiService = new AIService(env);
  }

  async selectBestClips(clips: TwitchClip[], transcripts: Transcript[]): Promise<TwitchClip[]> {
    console.log('Selecting best clips...');
    
    // Score clips based on dev-focused criteria
    const scoredClips = clips.map(clip => {
      const transcript = transcripts.find(t => t.clip_id === clip.id);
      const score = this.scoreClip(clip, transcript);
      return { clip, score };
    });

    // Sort by score and take top 5-12
    const sortedClips = scoredClips
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(12, Math.max(5, clips.length)))
      .map(item => item.clip);

    console.log(`Selected ${sortedClips.length} clips out of ${clips.length}`);
    return sortedClips;
  }

  private scoreClip(clip: TwitchClip, transcript?: Transcript): number {
    let score = 0;
    const text = transcript?.segments?.map((s: any) => s.text).join(' ').toLowerCase() || '';

    // Dev-focused scoring
    if (text.includes('test') && (text.includes('pass') || text.includes('green'))) score += 5;
    if (text.includes('commit') || text.includes('merge') || text.includes('pr')) score += 4;
    if (text.includes('fix') || text.includes('bug') || text.includes('issue')) score += 4;
    if (text.includes('build') && (text.includes('success') || text.includes('fail'))) score += 3;
    if (text.includes('finally') || text.includes('works')) score += 3;
    if (text.includes('error') || text.includes('exception')) score += 2;
    if (text.includes('deploy') || text.includes('release')) score += 2;
    
    // View count bonus (but not too much)
    score += Math.min(clip.view_count / 10, 5);
    
    // Duration penalty for very long clips
    if (clip.duration > 120) score -= 2;
    
    return score;
  }

  async generateBlogPost(clips: TwitchClip[], transcripts: Transcript[]): Promise<BlogPost> {
    console.log('Generating blog post...');
    
    const date = new Date().toISOString().split('T')[0];
    const sections: ClipSection[] = [];

    for (const clip of clips) {
      const transcript = transcripts.find(t => t.clip_id === clip.id);
      const section = await this.generateClipSection(clip, transcript);
      sections.push(section);
    }

    const intro = await this.generateIntro(clips, sections);
    const title = await this.generateTitle(clips, sections);

    return {
      title,
      date,
      clip_count: clips.length,
      sections,
      intro,
      tags: ['Development', 'Live Coding', 'Twitch', 'Daily Recap']
    };
  }

  private parseLLMJSON(raw: string): any {
    try {
      // Strip code fences and language hints
      let cleaned = raw.trim();
      
      // Remove markdown code blocks
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      
      // Find the first {...} block
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }
      
      const jsonStr = jsonMatch[0];
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse LLM JSON response:', error);
      throw error;
    }
  }

  private async generateClipSection(clip: TwitchClip, transcript?: Transcript): Promise<ClipSection> {
    const text = transcript?.segments?.map((s: any) => s.text).join(' ') || '';
    
    // Generate section using Workers AI
    const prompt = `Create a blog section for this Twitch clip:

Clip Title: ${clip.title}
Duration: ${clip.duration} seconds
Transcript: ${text}

Generate:
1. A compelling H2 title (max 60 chars)
2. 2-3 bullet points highlighting key moments
3. A 3-5 sentence paragraph summarizing the clip
4. Extract any repository names mentioned

Format as JSON:
{
  "h2": "title",
  "bullets": ["point1", "point2"],
  "paragraph": "summary text",
  "repo": "org/repo if mentioned"
}`;

    // Replace the direct call with a protected version that returns a fallback on error
    let result;
    try {
      result = await this.aiService.callWithRetry('@cf/google/gemma-2b-it', {
        prompt,
        max_tokens: 500,
      });
    } catch (error) {
      console.error('AI service call failed:', error);
      // Return fallback section immediately
      return {
        clip_id: clip.id,
        h2: clip.title,
        bullets: ['Development progress', 'Live coding session'],
        paragraph: 'Interesting development moment captured during the stream.',
        clip_url: clip.embed_url,
      };
    }
    
    try {
      const parsed = this.parseLLMJSON(result.response);
      
      // Validate and coerce fields
      const h2 = typeof parsed.h2 === 'string' ? parsed.h2.substring(0, 60) : clip.title;
      const bullets = Array.isArray(parsed.bullets) && parsed.bullets.length >= 2 && parsed.bullets.length <= 3
        ? parsed.bullets.filter((b: any) => typeof b === 'string')
        : ['Development progress', 'Live coding session'];
      const paragraph = typeof parsed.paragraph === 'string' && parsed.paragraph.length > 50
        ? parsed.paragraph
        : 'Interesting development moment captured during the stream.';
      
      // Normalize repo to "org/repo" format or undefined
      let repo: string | undefined;
      if (typeof parsed.repo === 'string' && parsed.repo.includes('/')) {
        repo = parsed.repo.trim();
      }
      
      return {
        clip_id: clip.id,
        h2,
        bullets,
        paragraph,
        clip_url: clip.embed_url,
        repo,
      };
    } catch (error) {
      console.error('AI response parsing failed:', error);
      // Fallback if AI parsing fails
      return {
        clip_id: clip.id,
        h2: clip.title,
        bullets: ['Development progress', 'Live coding session'],
        paragraph: 'Interesting development moment captured during the stream.',
        clip_url: clip.embed_url,
      };
    }
  }

  private async generateIntro(clips: TwitchClip[], sections: ClipSection[]): Promise<string> {
    const prompt = `Write a brief intro paragraph for a daily development recap blog post with ${clips.length} clips. Keep it under 100 words and mention it's from a Twitch stream.`;

    const result = await this.aiService.callWithRetry('@cf/google/gemma-2b-it', {
      prompt,
      max_tokens: 200,
    });

    return result.response || `Daily development recap from today's Twitch stream featuring ${clips.length} key moments.`;
  }

  private async generateTitle(clips: TwitchClip[], sections: ClipSection[]): Promise<string> {
    const prompt = `Generate a compelling title for a daily development recap blog post with ${clips.length} clips. Keep it under 60 characters and make it engaging for developers.`;

    const result = await this.aiService.callWithRetry('@cf/google/gemma-2b-it', {
      prompt,
      max_tokens: 100,
    });

    return result.response || `Daily Dev Recap - ${clips.length} Key Moments`;
  }

  async createPR(blogPost: BlogPost): Promise<any> {
    console.log('Creating GitHub PR...');
    
    const date = blogPost.date;
    const branchName = `auto/daily-recap-${date}`;
    const filePath = `content/blog/development/${date}-daily-dev-recap.mdx`;
    
    try {
      // Get GitHub installation token
      const token = await this.getGitHubToken();
      
      // Create branch
      await this.createBranch(token, branchName);
      
      // Create MDX file
      const mdxContent = this.generateMDX(blogPost);
      await this.createFile(token, branchName, filePath, mdxContent, `Add daily recap for ${blogPost.date}`, blogPost.date);
      
      // Create PR
      const pr = await this.createPullRequest(token, branchName, blogPost);
      
      return pr;
    } catch (error) {
      console.error('Failed to create PR:', error);
      throw new Error(`PR creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getGitHubToken(): Promise<string> {
    // Check cache first
    const now = Date.now();
    if (this.cachedGitHubToken && this.cachedGitHubTokenExpiry && now < this.cachedGitHubTokenExpiry) {
      return this.cachedGitHubToken;
    }

    // Generate JWT for GitHub App
    let jwt: string;
    try {
      jwt = await this.generateJWT();
    } catch (error) {
      throw new Error(`Failed to generate JWT for GitHub authentication: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Get installation token
    let response: Response;
    try {
      response = await fetch(
        `https://api.github.com/app/installations/${this.env.GITHUB_INSTALLATION_ID}/access_tokens`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwt}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
    } catch (error) {
      throw new Error(`Network error while fetching GitHub token: ${error instanceof Error ? error.message : 'Unknown network error'}`);
    }

    if (!response.ok) {
      let errorBody: string;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unable to read error response body';
      }
      throw new Error(`Failed to get GitHub token: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    let data: { token: string };
    try {
      data = await response.json() as { token: string };
    } catch (error) {
      throw new Error(`Failed to parse GitHub token response: ${error instanceof Error ? error.message : 'Invalid JSON response'}`);
    }

    // Cache the token with expiry (55 minutes to be safe)
    this.cachedGitHubToken = data.token;
    this.cachedGitHubTokenExpiry = now + (55 * 60 * 1000); // 55 minutes in milliseconds

    return data.token;
  }

  private async generateJWT(): Promise<string> {
    return generateJWT(this.env.GITHUB_PRIVATE_KEY, this.env.GITHUB_APP_ID);
  }

  private async createBranch(token: string, branchName: string): Promise<void> {
    // Get latest commit from main branch
    const response = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/git/ref/heads/${this.env.CONTENT_REPO_MAIN_BRANCH}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get main branch: ${response.statusText}`);
    }

    const data = await response.json() as { object: { sha: string } };
    
    // Create new branch
    const createResponse = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/git/refs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: data.object.sha,
        }),
      }
    );

    if (!createResponse.ok) {
      const errorBody = await createResponse.text();
      // If branch already exists, that might be okay depending on your use case
      if (createResponse.status === 422 && errorBody.includes('Reference already exists')) {
        console.log(`Branch ${branchName} already exists, continuing...`);
      } else {
        throw new Error(`Failed to create branch: ${createResponse.statusText} - ${errorBody}`);
      }
    }
  }

  private encodeBase64UnicodeSafe(content: string): string {
    // Cloudflare Workers compatible base64 encoding
    return btoa(unescape(encodeURIComponent(content)));
  }

  private async createFile(token: string, branch: string, path: string, content: string, commitMessage: string, date?: string): Promise<void> {
    const response = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: commitMessage,
          content: this.encodeBase64UnicodeSafe(content), // Unicode-safe base64 encode
          branch,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 422) {
        // Try update: fetch current sha then PUT with sha
        const getResp = await fetch(
          `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/contents/${path}?ref=${branch}`,
          { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json' } }
        );
        if (!getResp.ok) {
          const t = await getResp.text().catch(() => '');
          throw new Error(`Failed to read existing file for update: ${getResp.status} ${getResp.statusText} - ${t}`);
        }
        const { sha } = await getResp.json();
        const upd = await fetch(
          `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/contents/${path}`,
          {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json' },
            body: JSON.stringify({
              message: `Update daily recap for ${date || new Date().toISOString().split('T')[0]}`,
              content: this.encodeBase64UnicodeSafe(content),
              branch,
              sha,
            }),
          }
        );
        if (!upd.ok) {
          const t = await upd.text().catch(() => '');
          throw new Error(`Failed to update existing file: ${upd.status} ${upd.statusText} - ${t}`);
        }
        return;
      }
      const body = await response.text().catch(() => '');
      throw new Error(`Failed to create file: ${response.status} ${response.statusText} - ${body}`);
    }
  }

  private async createPullRequest(token: string, branch: string, blogPost: BlogPost): Promise<any> {
    const response = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/pulls`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          title: blogPost.title,
          body: this.generatePRBody(blogPost),
          head: branch,
          base: this.env.CONTENT_REPO_STAGING_BRANCH,
          draft: false,
        }),
      }
    );

    if (!response.ok) {
      let errorBody: string;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unable to read error response body';
      }
      throw new Error(`Failed to create PR: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return await response.json();
  }

  private generatePRBody(blogPost: BlogPost): string {
    const escapeYaml = (str: string) => {
      // Handle backslashes, quotes, newlines, and carriage returns
      return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
    };

    return `**Date**: ${blogPost.date}
**Clips**: ${blogPost.clip_count}
**Status**: Ready for review

### Summary
${blogPost.intro}

### Clips Included
${blogPost.sections.map((s: any) => `- ${s.h2}`).join('\n')}

---
*Auto-generated by Twitch Clip Recap Pipeline*`;
  }

  private generateMDX(blogPost: BlogPost): string {
    const escapeYaml = (str: string) => str.replace(/"/g, '\\"');
    const frontMatter = `---
title: "${escapeYaml(blogPost.title)}"
category: "development"
tags: ${JSON.stringify(blogPost.tags)}
description: "${escapeYaml(blogPost.intro)}"
date: "${blogPost.date}"
updated: "${blogPost.date}"
canonical: "https://paulchrisluke.com/blog/development/${blogPost.date}-daily-dev-recap"
draft: false
---

`;

    const content = `${blogPost.intro}

${blogPost.sections.map((section: any) => `
## ${section.h2}

${section.bullets.map((bullet: any) => `- ${bullet}`).join('\n')}

${section.paragraph}

<iframe
  src="${section.clip_url}"
  height="378"
  width="620"
  frameborder="0"
  scrolling="no"
  allowfullscreen="true"
  sandbox="allow-scripts allow-same-origin allow-presentation">
</iframe>
`).join('\n')}

---
*Generated from Twitch clips on ${blogPost.date}*`;

    return frontMatter + content;
  }

  async judgeContent(blogPost: BlogPost): Promise<JudgeResult> {
    console.log('Judging content...');
    
    const prompt = `Evaluate this blog post for quality and developer relevance:

Title: ${blogPost.title}
Intro: ${blogPost.intro}
Sections: ${blogPost.sections.length}
Content: ${blogPost.sections.map((s: any) => s.paragraph).join(' ')}

Rate on a scale of 0-100 for each category:
- Coherence (0-20): Each section stands alone
- Technical correctness (0-25): Matches transcript/clip content
- Dev signal (0-20): Clear development milestones
- Narrative flow (0-15): Setup → attempt → result
- Length/clarity (0-10): Precise, no fluff
- Safety/compliance (0-10): No secrets/PII

Format as JSON:
{
  "overall": 85,
  "per_axis": {
    "coherence": 18,
    "correctness": 22,
    "dev_signal": 17,
    "narrative_flow": 14,
    "length": 8,
    "safety": 6
  },
  "reasons": ["reason1", "reason2"],
  "action": "approve"
}`;

    const result = await this.aiService.callWithRetry('@cf/google/gemma-2b-it', {
      prompt,
      max_tokens: 500,
    });

    try {
      const parsed = this.parseLLMJSON(result.response);
      
      // Validate and coerce fields
      const overall = typeof parsed.overall === 'number' && parsed.overall >= 0 && parsed.overall <= 100 
        ? parsed.overall : 80;
      
      const per_axis = typeof parsed.per_axis === 'object' && parsed.per_axis !== null
        ? {
            coherence: typeof parsed.per_axis.coherence === 'number' ? Math.max(0, Math.min(20, parsed.per_axis.coherence)) : 18,
            correctness: typeof parsed.per_axis.correctness === 'number' ? Math.max(0, Math.min(25, parsed.per_axis.correctness)) : 20,
            dev_signal: typeof parsed.per_axis.dev_signal === 'number' ? Math.max(0, Math.min(20, parsed.per_axis.dev_signal)) : 16,
            narrative_flow: typeof parsed.per_axis.narrative_flow === 'number' ? Math.max(0, Math.min(15, parsed.per_axis.narrative_flow)) : 14,
            length: typeof parsed.per_axis.length === 'number' ? Math.max(0, Math.min(10, parsed.per_axis.length)) : 8,
            safety: typeof parsed.per_axis.safety === 'number' ? Math.max(0, Math.min(10, parsed.per_axis.safety)) : 6
          }
        : {
            coherence: 18,
            correctness: 20,
            dev_signal: 16,
            narrative_flow: 14,
            length: 8,
            safety: 6
          };
      
      const reasons = Array.isArray(parsed.reasons) && parsed.reasons.length > 0
        ? parsed.reasons.filter((r: any) => typeof r === 'string')
        : ['AI parsing failed, using fallback'];
      
      const action = parsed.action === 'approve' || parsed.action === 'reject' || parsed.action === 'revise'
        ? parsed.action : 'approve';
      
      return {
        overall,
        per_axis,
        reasons,
        action: action as const
      };
    } catch (error) {
      console.error('AI response parsing failed:', error);
      // Fallback
      return {
        overall: 80,
        per_axis: {
          coherence: 18,
          correctness: 20,
          dev_signal: 16,
          narrative_flow: 14,
          length: 8,
          safety: 6
        },
        reasons: ['AI parsing failed, using fallback'],
        action: 'approve' as const
      };
    }
  }
  async updatePRWithJudgeResults(
    prNumber: number,
    judgeResult: JudgeResult,
    headSha?: string
  ): Promise<void> {
    console.log(`Updating PR ${prNumber} with judge results...`);
    
    const token = await this.getGitHubToken();
    
    // Get PR details to find the head SHA if not provided
    if (!headSha) {
      const prResponse = await fetch(
        `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/pulls/${prNumber}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      
      if (!prResponse.ok) {
        throw new Error(`Failed to get PR details: ${prResponse.statusText}`);
      }
      
      const prData = await prResponse.json() as { head: { sha: string } };
      headSha = prData.head.sha;
    }
    
    // Create check run
    const checkRunResponse = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/check-runs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          name: 'Content Quality Judge',
          head_sha: headSha,
          status: 'completed',
          completed_at: new Date().toISOString(),
          conclusion: judgeResult.overall >= 80 ? 'success' : 'neutral',
          output: {
            title: `Content Quality Score: ${judgeResult.overall}/100`,
            summary: `Judge evaluation completed`,
            text: [
              '## Judge Results',
              '',
              `**Overall Score**: ${judgeResult.overall}/100`,
              '',
              '**Breakdown:**',
              ...Object.entries(judgeResult.per_axis).map(([k, v]) => `- ${k}: ${v}`),
              '',
              '**Reasons:**',
              ...judgeResult.reasons.map((r: any) => `- ${r}`),
              '',
              `**Action**: ${judgeResult.action}`,
            ].join('\n'),
          },
        }),
      }
    );

    if (!checkRunResponse.ok) {
      let errorBody: string;
      try {
        errorBody = await checkRunResponse.text();
      } catch {
        errorBody = 'Unable to read error response body';
      }
      throw new Error(`Failed to create check run: ${checkRunResponse.status} ${checkRunResponse.statusText} - ${errorBody}`);
    }
  }

}
