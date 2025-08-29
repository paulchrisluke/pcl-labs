import type { Environment } from '../types/index.js';
import type { Manifest } from '../types/content.js';

// AI evaluation result interface for type safety
export interface AiEvaluationResult {
  overall: number; // 0-100
  per_axis: {
    coherence: number; // 0-100
    correctness: number; // 0-100
    dev_signal: number; // 0-100
    narrative_flow: number; // 0-100
  };
  reasoning: string;
  recommendations: string[];
}

export interface JudgeEvaluation {
  overall: number; // 0-100
  per_axis: {
    coherence: number; // 0-100
    correctness: number; // 0-100
    dev_signal: number; // 0-100
    narrative_flow: number; // 0-100
  };
  version: string;
  reasoning: string;
  recommendations: string[];
}

export interface JudgeConfig {
  threshold: number; // Minimum overall score (default: 80)
  axisMin: number; // Minimum per-axis score (default: 60)
  model: string; // AI model to use
}

/**
 * AI Content Judge Service
 * Evaluates content quality using Workers AI
 */
export class AIJudgeService {
  private env: Environment;
  private config: JudgeConfig;

  constructor(env: Environment, config?: Partial<JudgeConfig>) {
    this.env = env;
    this.config = {
      threshold: 80,
      axisMin: 60,
      model: '@cf/meta/llama-3.1-8b-instruct',
      ...config,
    };
  }

  /**
   * Judge a manifest for content quality
   */
  async judgeManifest(manifest: Manifest): Promise<JudgeEvaluation> {
    try {
      console.log(`⚖️ Judging manifest ${manifest.post_id}...`);

      // Prepare content for evaluation
      const contentForEvaluation = this.prepareContentForEvaluation(manifest);

      // Run AI evaluation
      const evaluation = await this.runAIEvaluation(contentForEvaluation);

      // Validate and normalize scores
      const normalizedEvaluation = this.normalizeScores(evaluation);

      console.log(`✅ Judge results: ${normalizedEvaluation.overall}/100 overall`);

      return normalizedEvaluation;
    } catch (error) {
      console.error('❌ Failed to judge manifest:', error);
      
      // Return default evaluation on error
      return {
        overall: 50,
        per_axis: {
          coherence: 50,
          correctness: 50,
          dev_signal: 50,
          narrative_flow: 50,
        },
        version: '1.0.0',
        reasoning: 'Evaluation failed - using default scores',
        recommendations: ['Review content manually', 'Check AI service availability'],
      };
    }
  }

  /**
   * Prepare content for AI evaluation
   */
  private prepareContentForEvaluation(manifest: Manifest): string {
    let content = '';

    // Add manifest metadata with defensive handling for potentially undefined arrays
    const safeTags = Array.isArray(manifest.tags) ? manifest.tags : [];
    const safeCount = Array.isArray(manifest.clip_ids) ? manifest.clip_ids.length : 0;
    
    content += `Title: ${manifest.title}\n`;
    content += `Summary: ${manifest.summary}\n`;
    content += `Tags: ${safeTags.join(', ')}\n`;
    content += `Clips: ${safeCount}\n\n`;

    // Add sections content
    content += 'Sections:\n';
    manifest.sections.forEach((section, index) => {
      content += `\n${index + 1}. ${section.title}\n`;
      content += `   Bullets: ${section.bullets.join('; ')}\n`;
      content += `   Paragraph: ${section.paragraph}\n`;
      if (Array.isArray(section.pr_links)) {
        content += `   GitHub PRs: ${section.pr_links.length}\n`;
      }
    });

    return content;
  }

  /**
   * Run AI evaluation using Workers AI
   */
  private async runAIEvaluation(content: string): Promise<AiEvaluationResult> {
    const prompt = this.buildEvaluationPrompt(content);

    try {
      // Use Workers AI to evaluate content
      const response = await this.env.ai.run(this.config.model, {
        messages: [
          {
            role: 'system',
            content: 'You are an expert content evaluator for development blog posts. Evaluate the content quality and provide scores.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
      });

      // Parse the response
      return this.parseAIResponse(response.response);
    } catch (error) {
      console.error('❌ AI evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Sanitize content for prompt injection prevention
   */
  private sanitizeForPrompt(content: string): string {
    // Remove potential prompt injection patterns
    return content
      .replace(/\n{3,}/g, '\n\n')    // Limit consecutive newlines
      .replace(/[`]{3,}/g, '')       // Remove code block markers
      .slice(0, 4000);               // Limit content length
  }

  /**
   * Build evaluation prompt
   */
  private buildEvaluationPrompt(content: string): string {
    const sanitizedContent = this.sanitizeForPrompt(content);
    return `Please evaluate the following development blog post content and provide scores in JSON format.

Content to evaluate:
${sanitizedContent}

Evaluation criteria:
1. **Coherence** (0-100): How well do the sections flow together? Is the narrative logical?
2. **Correctness** (0-100): Are technical details accurate? Are GitHub links valid?
3. **Dev Signal** (0-100): How valuable is this for developers? Does it provide useful insights?
4. **Narrative Flow** (0-100): Is the story engaging? Does it maintain reader interest?

Please respond with a JSON object in this exact format:
{
  "overall": 85,
  "per_axis": {
    "coherence": 80,
    "correctness": 90,
    "dev_signal": 85,
    "narrative_flow": 75
  },
  "reasoning": "Brief explanation of the scores",
  "recommendations": ["Suggestion 1", "Suggestion 2"]
}

Only return valid JSON, no additional text.`;
  }

  /**
   * Parse AI response
   */
  private parseAIResponse(response: string): AiEvaluationResult {
    try {
      // Extract JSON from response
// Try to find JSON-like content more safely
      const trimmed = response.trim();
      let jsonStr = trimmed;
      
      // If response contains markdown code blocks, extract content
      const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }
      
      // Try to extract JSON from the content
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and type-check the response
      const validatedResult = this.validateAiResponse(parsed);
      return validatedResult;
    } catch (error) {
      console.error('❌ Failed to parse AI response:', error);
      console.log('Raw response:', response);
      
      // Return default evaluation with proper typing
      return {
        overall: 50,
        per_axis: {
          coherence: 50,
          correctness: 50,
          dev_signal: 50,
          narrative_flow: 50,
        },
        reasoning: 'Failed to parse AI response',
        recommendations: ['Review content manually'],
      };
    }
  }

  /**
   * Validate AI response and ensure it matches AiEvaluationResult interface
   */
  private validateAiResponse(parsed: unknown): AiEvaluationResult {
    // Type guard to validate the structure
    if (!this.isValidAiEvaluationResult(parsed)) {
      throw new Error('Invalid AI response structure');
    }

    return parsed;
  }

  /**
   * Type guard to validate AiEvaluationResult structure
   */
  private isValidAiEvaluationResult(obj: unknown): obj is AiEvaluationResult {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    const candidate = obj as Record<string, unknown>;

    // Check overall score
    if (typeof candidate.overall !== 'number' || candidate.overall < 0 || candidate.overall > 100) {
      return false;
    }

    // Check per_axis object
    if (!candidate.per_axis || typeof candidate.per_axis !== 'object') {
      return false;
    }

    const perAxis = candidate.per_axis as Record<string, unknown>;
    const requiredAxes = ['coherence', 'correctness', 'dev_signal', 'narrative_flow'];

    for (const axis of requiredAxes) {
      if (typeof perAxis[axis] !== 'number' || perAxis[axis] < 0 || perAxis[axis] > 100) {
        return false;
      }
    }

    // Check reasoning
    if (typeof candidate.reasoning !== 'string') {
      return false;
    }

    // Check recommendations
    if (!Array.isArray(candidate.recommendations) || 
        !candidate.recommendations.every((rec: unknown) => typeof rec === 'string')) {
      return false;
    }

    return true;
  }

  /**
   * Normalize and validate scores
   */
  private normalizeScores(evaluation: AiEvaluationResult): JudgeEvaluation {
    // Ensure scores are within 0-100 range
    const overall = Math.max(0, Math.min(100, evaluation.overall || 50));
    
    const per_axis = {
      coherence: Math.max(0, Math.min(100, evaluation.per_axis?.coherence || 50)),
      correctness: Math.max(0, Math.min(100, evaluation.per_axis?.correctness || 50)),
      dev_signal: Math.max(0, Math.min(100, evaluation.per_axis?.dev_signal || 50)),
      narrative_flow: Math.max(0, Math.min(100, evaluation.per_axis?.narrative_flow || 50)),
    };

    return {
      overall,
      per_axis,
      version: '1.0.0',
      reasoning: evaluation.reasoning || 'No reasoning provided',
      recommendations: Array.isArray(evaluation.recommendations) 
        ? evaluation.recommendations 
        : ['Review content manually'],
    };
  }

  /**
   * Check if content meets quality threshold
   */
  async meetsQualityThreshold(manifest: Manifest): Promise<{
    approved: boolean;
    evaluation: JudgeEvaluation;
    reasons: string[];
  }> {
    const evaluation = await this.judgeManifest(manifest);
    const reasons: string[] = [];

    // Check overall score
    if (evaluation.overall < this.config.threshold) {
      reasons.push(`Overall score ${evaluation.overall} below threshold ${this.config.threshold}`);
    }

    // Check per-axis scores
    Object.entries(evaluation.per_axis).forEach(([axis, score]) => {
      if (score < this.config.axisMin) {
        reasons.push(`${axis} score ${score} below minimum ${this.config.axisMin}`);
      }
    });

    const approved = reasons.length === 0;

    return {
      approved,
      evaluation,
      reasons,
    };
  }

  /**
   * Generate improvement suggestions
   */
  async generateImprovementSuggestions(manifest: Manifest): Promise<string[]> {
    try {
      const evaluation = await this.judgeManifest(manifest);
      const suggestions: string[] = [];

      // Add AI-generated recommendations
      suggestions.push(...evaluation.recommendations);

      // Add score-based suggestions
      if (evaluation.per_axis.coherence < 70) {
        suggestions.push('Improve section transitions and narrative flow');
      }
      if (evaluation.per_axis.correctness < 70) {
        suggestions.push('Verify technical accuracy and GitHub link validity');
      }
      if (evaluation.per_axis.dev_signal < 70) {
        suggestions.push('Add more developer-focused insights and technical details');
      }
      if (evaluation.per_axis.narrative_flow < 70) {
        suggestions.push('Enhance storytelling and engagement elements');
      }

      // Add content-specific suggestions
      if (manifest.sections.length < 3) {
        suggestions.push('Consider adding more sections for better coverage');
      }
      if (manifest.sections.filter(s => Array.isArray(s.pr_links) && s.pr_links.length > 0).length === 0) {
        suggestions.push('Include more GitHub context for better developer value');
      }

      return suggestions;
    } catch (error) {
      console.error('❌ Failed to generate improvement suggestions:', error);
      return ['Review content manually', 'Check for technical accuracy'];
    }
  }

  /**
   * Update manifest with judge results
   */
  updateManifestWithJudgeResults(manifest: Manifest, evaluation: JudgeEvaluation): Manifest {
    return {
      ...manifest,
      judge: {
        overall: evaluation.overall,
        per_axis: evaluation.per_axis,
        version: evaluation.version,
      },
    };
  }

  /**
   * Get judge statistics
   */
  async getJudgeStatistics(): Promise<{
    totalEvaluations: number;
    averageOverallScore: number;
    approvalRate: number;
    commonIssues: string[];
  }> {
    // This would query stored judge results
    // For now, return placeholder statistics
    return {
      totalEvaluations: 0,
      averageOverallScore: 0,
      approvalRate: 0,
      commonIssues: [],
    };
  }
}
