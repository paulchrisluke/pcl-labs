import type { Environment } from '../types/index.js';
import type { Manifest, AIDraft, AIGenerationMetadata, ManifestSection } from '../types/content.js';

// Async hash function using Web Crypto API with fallback
async function hashId(str: string): Promise<string> {
  try {
    // Check if crypto.subtle and TextEncoder are available
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      // Convert ArrayBuffer to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (error) {
    console.warn('Web Crypto not available, falling back to simple hash:', error);
  }
  
  // Fallback to simple hash
  return simpleHash(str);
}

// Simple hash function for idempotency (fallback when crypto is not available in Workers)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

export interface DraftingResult {
  draft: AIDraft;
  gen: AIGenerationMetadata;
  contentHash: string;
  promptHash: string;
}

/**
 * AI Drafter Service
 * Uses Workers AI Gemma to generate blog post content from manifests
 */
export class AIDrafterService {
  private env: Environment;
  private readonly MODEL = '@hf/google/gemma-7b-it';
  private readonly TEMPERATURE = 0.3;
  private readonly TOP_P = 0.9;
  private readonly SEED = 42; // Fixed seed for determinism
  private readonly MAX_TOKENS = 2000;

  constructor(env: Environment) {
    this.env = env;
  }

  /**
   * Generate AI draft from manifest
   */
  async generateDraft(manifest: Manifest): Promise<DraftingResult> {
    try {
      console.log(`🤖 Generating AI draft for ${manifest.post_id}...`);

      // Calculate content hash for idempotency
      const contentHash = await this.calculateContentHash(manifest);

      // Check if we already have a draft with same content hash
      if (manifest.gen?.prompt_hash && manifest.draft) {
        const existingPromptHash = await this.calculatePromptHash(manifest);
        if (existingPromptHash === manifest.gen.prompt_hash && contentHash === manifest.gen.content_hash) {
          console.log(`✅ Using existing draft (idempotent)`);
          return {
            draft: manifest.draft,
            gen: manifest.gen,
            contentHash,
            promptHash: existingPromptHash,
          };
        }
      }

      // Generate new draft
      const draft = await this.generateDraftContent(manifest);
      const promptHash = await this.calculatePromptHash(manifest);
      const gen: AIGenerationMetadata = {
        model: this.MODEL,
        params: {
          temperature: this.TEMPERATURE,
          top_p: this.TOP_P,
          seed: this.SEED,
          max_tokens: this.MAX_TOKENS,
        },
        prompt_hash: promptHash,
        content_hash: contentHash,
        generated_at: new Date().toISOString(),
      };

      console.log(`✅ Generated AI draft with ${draft.intro.length + draft.outro.length} chars intro/outro`);

      return {
        draft,
        gen,
        contentHash,
        promptHash,
      };
    } catch (error) {
      console.error('❌ Failed to generate AI draft:', error);
      throw error;
    }
  }

  /**
   * Generate draft content using Workers AI Gemma
   */
  private async generateDraftContent(manifest: Manifest): Promise<AIDraft> {
    const prompt = this.buildPrompt(manifest);
    
    try {
      // Call Workers AI Gemma
      const response = await this.env.ai.run(this.MODEL, {
        prompt,
        temperature: this.TEMPERATURE,
        top_p: this.TOP_P,
        seed: this.SEED,
        max_tokens: this.MAX_TOKENS,
      });

      if (!response || !response.response) {
        throw new Error('No response from AI model');
      }

      // Parse the AI response
      return this.parseAIResponse(response.response, manifest.sections.length);
    } catch (error) {
      console.error('❌ AI generation failed:', error);
      // Fallback to basic content
      return this.generateFallbackDraft(manifest);
    }
  }

  /**
   * Build prompt for AI generation with GitHub context
   */
  private buildPrompt(manifest: Manifest): string {
    const sections = manifest.sections.map((section, index) => {
      // Build GitHub context from safe fields
      const githubContext = this.buildGitHubContext(section);
      
      const sectionPrompt = `
Section ${index + 1}: ${section.title}
- Bullets: ${section.bullets.join('; ')}
- Repo: ${section.repo || 'N/A'}
- PR Links: ${section.pr_links?.join(', ') || 'N/A'}
- GitHub Context: ${githubContext}
- Entities: ${section.entities?.join(', ') || 'N/A'}
`;
      return sectionPrompt;
    }).join('\n');

    // Count GitHub-related content by checking for GitHub-related fields
    const githubSections = manifest.sections.filter(section => 
      section.repo || (section.pr_links && section.pr_links.length > 0) || (section.entities && section.entities.length > 0)
    ).length;

    const githubContext = githubSections > 0 
      ? `\n\nGitHub Integration: This recap includes ${githubSections} sections with linked GitHub activity (commits, pull requests, issues). When writing about these sections, incorporate the GitHub context to show the connection between the development discussion and the actual code changes.`
      : '';

    return `You are a professional developer writing a daily development recap blog post. Generate engaging, concise content based on the following sections.

Style: Professional, technical, developer-focused. Preserve technical terms and names. No hype or marketing language. When GitHub activity is mentioned, reference the specific commits, PRs, or issues to show the connection between discussion and implementation.

Structure:
1. Write a brief intro paragraph (2-3 sentences) that sets up the day's development work
2. For each section, write a paragraph (3-4 sentences) that expands on the bullets and context
3. Write a brief outro paragraph (2-3 sentences) that wraps up the day's work

Manifest:
Title: ${manifest.title}
Summary: ${manifest.summary}
Category: ${manifest.category}
Tags: ${manifest.tags.join(', ')}${githubContext}

Sections:
${sections}

Generate the content in this exact JSON format:
{
  "intro": "intro paragraph here",
  "sections": [
    {"paragraph": "section 1 paragraph here"},
    {"paragraph": "section 2 paragraph here"}
  ],
  "outro": "outro paragraph here"
}`;
  }

  /**
   * Parse AI response into structured draft
   */
  private parseAIResponse(response: string, expectedSections: number): AIDraft {
    try {
      let jsonCandidate: string | null = null;
      
      // First, look for fenced JSON block (```json ... ```)
      const fencedMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (fencedMatch) {
        jsonCandidate = fencedMatch[1].trim();
      } else {
        // Fall back to non-greedy brace capture
        const braceMatch = response.match(/\{[\s\S]*?\}/);
        if (braceMatch) {
          jsonCandidate = braceMatch[0];
        }
      }
      
      if (jsonCandidate) {
        const parsed = JSON.parse(jsonCandidate);
        
        // Validate structure
        if (parsed.intro && parsed.sections && parsed.outro && Array.isArray(parsed.sections)) {
          // Ensure we have the right number of sections
          if (parsed.sections.length === expectedSections) {
            return {
              intro: this.sanitizeText(parsed.intro),
              sections: parsed.sections.map((s: { paragraph?: string }) => ({
                paragraph: this.sanitizeText(s.paragraph || '')
              })),
              outro: this.sanitizeText(parsed.outro),
            };
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse AI response as JSON:', error);
    }

    // Fallback: generate basic content from response
    return this.generateFallbackFromResponse(response, expectedSections);
  }

  /**
   * Generate fallback draft when AI fails
   */
  private generateFallbackDraft(manifest: Manifest): AIDraft {
    const intro = this.sanitizeText(`Today's development session covered ${manifest.sections.length} key areas of work.`);
    
    const sections = manifest.sections.map(section => ({
      paragraph: this.sanitizeText(`In this section, we discussed ${section.title.toLowerCase()}. ${section.bullets.join(' ')}`)
    }));

    const outro = this.sanitizeText(`This wraps up today's development work and progress.`);

    return {
      intro,
      sections,
      outro,
    };
  }

  /**
   * Generate fallback from partial AI response
   */
  private generateFallbackFromResponse(response: string, expectedSections: number): AIDraft {
    const lines = response.split('\n').filter(line => line.trim().length > 0);
    
    const intro = lines[0] || 'Today\'s development session covered key areas of work.';
    
    const sections = Array.from({ length: expectedSections }, (_, i) => ({
      paragraph: this.sanitizeText(lines[i + 1] || `Section ${i + 1} content.`)
    }));

    const outro = lines[lines.length - 1] || 'This wraps up today\'s development work.';

    return {
      intro: this.sanitizeText(intro),
      sections,
      outro: this.sanitizeText(outro),
    };
  }

  /**
   * Build GitHub context from safe fields
   */
  private buildGitHubContext(section: ManifestSection): string {
    const parts: string[] = [];
    
    if (section.repo) {
      parts.push(`Repository: ${section.repo}`);
    }
    
    if (section.pr_links && section.pr_links.length > 0) {
      parts.push(`PR Links: ${section.pr_links.join(', ')}`);
    }
    
    if (section.entities && section.entities.length > 0) {
      parts.push(`Entities: ${section.entities.join(', ')}`);
    }
    
    return parts.length > 0 ? parts.join(' | ') : 'N/A';
  }

  /**
   * Sanitize text content
   */
  private sanitizeText(text: string): string {
    return text
      // Normalize Unicode quotes and dashes to ASCII equivalents
      .replace(/["""]/gu, '"')
      .replace(/[''']/gu, "'")
      .replace(/[—–]/gu, '-')
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      // Allow Unicode letters, numbers, and technical punctuation
      .replace(/[^\p{L}\p{N}\s.,!?\-():/\\'`[\]]/gu, '') // Remove only truly unsafe chars
      .substring(0, 500); // Limit length
  }

  /**
   * Calculate content hash for idempotency
   */
  private async calculateContentHash(manifest: Manifest): Promise<string> {
    const content = {
      post_id: manifest.post_id,
      title: manifest.title,
      summary: manifest.summary,
      category: manifest.category,
      tags: manifest.tags,
      sections: manifest.sections.map(s => ({
        title: s.title,
        bullets: s.bullets,
        repo: s.repo,
        pr_links: s.pr_links,
        entities: s.entities,
      })),
    };
    
    return hashId(JSON.stringify(content));
  }

  /**
   * Calculate prompt hash for idempotency
   */
  private async calculatePromptHash(manifest: Manifest): Promise<string> {
    const prompt = this.buildPrompt(manifest);
    // Include model and parameters in hash for proper idempotency
    const hashInput = JSON.stringify({
      prompt,
      model: this.MODEL,
      temperature: this.TEMPERATURE,
      top_p: this.TOP_P,
      seed: this.SEED,
      max_tokens: this.MAX_TOKENS,
    });
    return hashId(hashInput);
  }
}
