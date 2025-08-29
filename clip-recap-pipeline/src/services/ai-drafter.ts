import type { Environment } from '../types/index.js';
import type { Manifest, AIDraft, AIGenerationMetadata } from '../types/content.js';

// Simple hash function for idempotency (since crypto is not available in Workers)
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
  private readonly MODEL = 'gemma-instruct';
  private readonly TEMPERATURE = 0.3;
  private readonly TOP_P = 0.9;
  private readonly SEED = 42; // Fixed seed for determinism

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
      const contentHash = this.calculateContentHash(manifest);

      // Check if we already have a draft with same content hash
      if (manifest.gen?.prompt_hash && manifest.draft) {
        const existingPromptHash = this.calculatePromptHash(manifest);
        if (existingPromptHash === manifest.gen.prompt_hash) {
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
      const promptHash = this.calculatePromptHash(manifest);
      const gen: AIGenerationMetadata = {
        model: this.MODEL,
        params: {
          temperature: this.TEMPERATURE,
          top_p: this.TOP_P,
          seed: this.SEED,
        },
        prompt_hash: promptHash,
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
        max_tokens: 2000,
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
   * Build prompt for AI generation
   */
  private buildPrompt(manifest: Manifest): string {
    const sections = manifest.sections.map((section, index) => {
      const sectionPrompt = `
Section ${index + 1}: ${section.title}
- Bullets: ${section.bullets.join('; ')}
- Repo: ${section.repo || 'N/A'}
- PR Links: ${section.pr_links?.join(', ') || 'N/A'}
- Entities: ${section.entities?.join(', ') || 'N/A'}
`;
      return sectionPrompt;
    }).join('\n');

    return `You are a professional developer writing a daily development recap blog post. Generate engaging, concise content based on the following sections.

Style: Professional, technical, developer-focused. Preserve technical terms and names. No hype or marketing language.

Structure:
1. Write a brief intro paragraph (2-3 sentences) that sets up the day's development work
2. For each section, write a paragraph (3-4 sentences) that expands on the bullets and context
3. Write a brief outro paragraph (2-3 sentences) that wraps up the day's work

Manifest:
Title: ${manifest.title}
Summary: ${manifest.summary}
Category: ${manifest.category}
Tags: ${manifest.tags.join(', ')}

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
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate structure
        if (parsed.intro && parsed.sections && parsed.outro) {
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
    const intro = `Today's development session covered ${manifest.sections.length} key areas of work.`;
    
    const sections = manifest.sections.map(section => ({
      paragraph: `In this section, we discussed ${section.title.toLowerCase()}. ${section.bullets.join(' ')}`
    }));

    const outro = `This wraps up today's development work and progress.`;

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
      paragraph: lines[i + 1] || `Section ${i + 1} content.`
    }));

    const outro = lines[lines.length - 1] || 'This wraps up today\'s development work.';

    return {
      intro: this.sanitizeText(intro),
      sections,
      outro: this.sanitizeText(outro),
    };
  }

  /**
   * Sanitize text content
   */
  private sanitizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
      .substring(0, 500); // Limit length
  }

  /**
   * Calculate content hash for idempotency
   */
  private calculateContentHash(manifest: Manifest): string {
    const content = {
      post_id: manifest.post_id,
      title: manifest.title,
      summary: manifest.summary,
      sections: manifest.sections.map(s => ({
        title: s.title,
        bullets: s.bullets,
        repo: s.repo,
        pr_links: s.pr_links,
        entities: s.entities,
      })),
    };
    
    return simpleHash(JSON.stringify(content));
  }

  /**
   * Calculate prompt hash for idempotency
   */
  private calculatePromptHash(manifest: Manifest): string {
    const prompt = this.buildPrompt(manifest);
    return simpleHash(prompt);
  }
}
