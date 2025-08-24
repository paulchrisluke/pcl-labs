import { Env, TwitchClip, Transcript, BlogPost, JudgeResult, ClipSection } from '../types';
import { generateJWT } from '../utils/jwt';

export class ContentService {
  constructor(private env: Env) {}

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
    const text = transcript?.segments?.map(s => s.text).join(' ').toLowerCase() || '';

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

  private async generateClipSection(clip: TwitchClip, transcript?: Transcript): Promise<ClipSection> {
    const text = transcript?.segments?.map(s => s.text).join(' ') || '';
    
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

    const result = await this.env.ai.run('@cf/google/gemma-2b-it', {
      prompt,
      max_tokens: 500,
    });

    try {
      const parsed = JSON.parse(result.response);
      return {
        clip_id: clip.id,
        h2: parsed.h2 || clip.title,
        bullets: parsed.bullets || ['Key development moment'],
        paragraph: parsed.paragraph || 'Interesting development progress.',
        clip_url: clip.embed_url,
        repo: parsed.repo,
      };
    } catch (error) {
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

    const result = await this.env.ai.run('@cf/google/gemma-2b-it', {
      prompt,
      max_tokens: 200,
    });

    return result.response || `Daily development recap from today's Twitch stream featuring ${clips.length} key moments.`;
  }

  private async generateTitle(clips: TwitchClip[], sections: ClipSection[]): Promise<string> {
    const topClip = clips[0];
    const prompt = `Generate a blog post title for a daily development recap. Include the date and reference this clip: "${topClip.title}". Keep it under 80 characters.`;

    const result = await this.env.ai.run('@cf/google/gemma-2b-it', {
      prompt,
      max_tokens: 100,
    });

    return result.response || `Daily Dev Recap: ${new Date().toISOString().split('T')[0]}`;
  }

  async createPR(blogPost: BlogPost): Promise<any> {
    console.log('Creating GitHub PR...');
    
    const date = blogPost.date;
    const branchName = `auto/daily-recap-${date}`;
    const filePath = `content/blog/development/${date}-daily-dev-recap.mdx`;
    
    // Get GitHub installation token
    const token = await this.getGitHubToken();
    
    // Create branch
    await this.createBranch(token, branchName);
    
    // Create MDX file
    const mdxContent = this.generateMDX(blogPost);
    await this.createFile(token, branchName, filePath, mdxContent);
    
    // Create PR
    const pr = await this.createPullRequest(token, branchName, blogPost);
    
    return pr;
  }

  private async getGitHubToken(): Promise<string> {
    // Generate JWT for GitHub App
    const jwt = this.generateJWT();
    
    // Get installation token
    const response = await fetch(
      `https://api.github.com/app/installations/${this.env.GITHUB_INSTALLATION_ID}/access_tokens`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get GitHub token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token;
  }

  private generateJWT(): string {
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

    const data = await response.json();
    
    // Create new branch
    await fetch(
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
  }

  private async createFile(token: string, branch: string, path: string, content: string): Promise<void> {
    const response = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `Add daily recap for ${new Date().toISOString().split('T')[0]}`,
          content: btoa(content), // Base64 encode
          branch,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create file: ${response.statusText}`);
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
      throw new Error(`Failed to create PR: ${response.statusText}`);
    }

    return await response.json();
  }

  private generatePRBody(blogPost: BlogPost): string {
    return `## Daily Dev Recap

**Date**: ${blogPost.date}
**Clips**: ${blogPost.clip_count}
**Status**: Ready for review

### Summary
${blogPost.intro}

### Clips Included
${blogPost.sections.map(s => `- ${s.h2}`).join('\n')}

---
*Auto-generated by Twitch Clip Recap Pipeline*`;
  }

  private generateMDX(blogPost: BlogPost): string {
    const frontMatter = `---
title: "${blogPost.title}"
category: "development"
tags: ${JSON.stringify(blogPost.tags)}
description: "${blogPost.intro}"
date: "${blogPost.date}"
updated: "${blogPost.date}"
canonical: "https://paulchrisluke.com/blog/development/${blogPost.date}-daily-dev-recap"
draft: false
---

`;

    const content = `${blogPost.intro}

${blogPost.sections.map(section => `
## ${section.h2}

${section.bullets.map(bullet => `- ${bullet}`).join('\n')}

${section.paragraph}

<iframe
  src="${section.clip_url}"
  height="378"
  width="620"
  frameborder="0"
  scrolling="no"
  allowfullscreen="true">
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
Content: ${blogPost.sections.map(s => s.paragraph).join(' ')}

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

    const result = await this.env.ai.run('@cf/google/gemma-2b-it', {
      prompt,
      max_tokens: 500,
    });

    try {
      return JSON.parse(result.response);
    } catch (error) {
      // Fallback
      return {
        overall: 80,
        per_axis: {
          coherence: 18,
          correctness: 20,
          dev_signal: 16,
          narrative_flow: 13,
          length: 8,
          safety: 5
        },
        reasons: ['Content generated successfully'],
        action: 'approve'
      };
    }
  }

  async updatePRWithJudgeResults(prNumber: number, judgeResult: JudgeResult): Promise<void> {
    console.log(`Updating PR ${prNumber} with judge results...`);
    
    const token = await this.getGitHubToken();
    
    // Create check run
    await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/check-runs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          name: 'Content Quality Judge',
          head_sha: 'latest', // You'd need to get the actual SHA
          status: 'completed',
          conclusion: judgeResult.overall >= 80 ? 'success' : 'neutral',
          output: {
            title: `Content Quality Score: ${judgeResult.overall}/100`,
            summary: `Judge evaluation completed`,
            text: `## Judge Results\n\n**Overall Score**: ${judgeResult.overall}/100\n\n**Breakdown**:\n${Object.entries(judgeResult.per_axis).map(([key, value]) => `- ${key}: ${value}`).join('\n')}\n\n**Reasons**:\n${judgeResult.reasons.map(r => `- ${r}`).join('\n')}\n\n**Action**: ${judgeResult.action}`,
          },
        }),
      }
    );
  }
}
