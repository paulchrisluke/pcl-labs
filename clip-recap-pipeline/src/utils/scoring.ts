import type { ContentItem } from '../types/content.js';
import type { ScoringConfig, ScoringWeights } from '../config/scoring.js';
import { DEFAULT_SCORING_CONFIG, validateWeights, normalizeWeights } from '../config/scoring.js';

/**
 * Normalized scoring components for content items
 */
export interface NormalizedScoreComponents {
  /** Normalized content score (0-1) */
  contentScore: number;
  /** Normalized GitHub confidence score (0-1) */
  githubConfidence: number;
  /** Normalized duration score (0-1) */
  duration: number;
  /** Normalized view count score (0-1) */
  views: number;
  /** Normalized transcript length score (0-1) */
  transcriptLength: number;
}

/**
 * Calculate normalized score components for a content item
 * 
 * Each component is normalized to a 0-1 range using configurable thresholds.
 * This function is unit-testable and allows for easy tuning of scoring parameters.
 * 
 * @param item - The content item to score
 * @param config - Scoring configuration (uses defaults if not provided)
 * @returns Object containing each normalized component score
 */
export function calculateNormalizedScoreComponents(
  item: ContentItem,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): NormalizedScoreComponents {
  // Normalize content score (already 0-1, clamp to ensure range)
  const contentScore = Math.max(0, Math.min(1, item.content_score || 0));

  // Normalize GitHub confidence score based on presence of GitHub context URL
  const githubConfidence = item.github_context_url ? 1 : 0;

  // Normalize duration score using configurable threshold
  const duration = Math.min(1, item.clip_duration / config.normalization.maxDurationSeconds);

  // Normalize view count score using configurable threshold
  const views = item.clip_view_count 
    ? Math.min(1, item.clip_view_count / config.normalization.maxViewCount)
    : 0;

  // Normalize transcript length score using configurable threshold
  // Prioritize transcript_size_bytes if available, fall back to transcript_summary word count
  let transcriptLength = 0;
  if (item.transcript_size_bytes) {
    // Approximate words = bytes / 6, then normalize
    const approximateWords = item.transcript_size_bytes / 6;
    transcriptLength = Math.min(1, approximateWords / config.normalization.maxTranscriptWords);
  } else if (item.transcript_summary) {
    // Fall back to counting words in transcript_summary
    const wordCount = item.transcript_summary.split(/\s+/).length;
    transcriptLength = Math.min(1, wordCount / config.normalization.maxTranscriptWords);
  }

  return {
    contentScore,
    githubConfidence,
    duration,
    views,
    transcriptLength,
  };
}

/**
 * Calculate weighted content score for ranking
 * 
 * Combines normalized components using configurable weights and scales to 0-100.
 * Weights are automatically normalized if they don't sum to 1.0.
 * 
 * @param item - The content item to score
 * @param config - Scoring configuration (uses defaults if not provided)
 * @returns Final score from 0-100
 */
export function calculateWeightedContentScore(
  item: ContentItem,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): number {
  // Get normalized components
  const components = calculateNormalizedScoreComponents(item, config);

  // Ensure weights are normalized
  const normalizedWeights = validateWeights(config.weights) 
    ? config.weights 
    : normalizeWeights(config.weights);

  // Calculate weighted sum
  const weightedSum = 
    components.contentScore * normalizedWeights.contentScore +
    components.githubConfidence * normalizedWeights.githubConfidence +
    components.duration * normalizedWeights.duration +
    components.views * normalizedWeights.views +
    components.transcriptLength * normalizedWeights.transcriptLength;

  // Scale to 0-100 range
  return Math.round(weightedSum * 100);
}

/**
 * Calculate detailed scoring breakdown for debugging and analysis
 * 
 * @param item - The content item to score
 * @param config - Scoring configuration (uses defaults if not provided)
 * @returns Detailed scoring information including components and weights
 */
export function calculateDetailedScore(
  item: ContentItem,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): {
  finalScore: number;
  components: NormalizedScoreComponents;
  weights: ScoringWeights;
  weightedComponents: Record<keyof NormalizedScoreComponents, number>;
} {
  const components = calculateNormalizedScoreComponents(item, config);
  const normalizedWeights = validateWeights(config.weights) 
    ? config.weights 
    : normalizeWeights(config.weights);

  const weightedComponents = {
    contentScore: components.contentScore * normalizedWeights.contentScore,
    githubConfidence: components.githubConfidence * normalizedWeights.githubConfidence,
    duration: components.duration * normalizedWeights.duration,
    views: components.views * normalizedWeights.views,
    transcriptLength: components.transcriptLength * normalizedWeights.transcriptLength,
  };

  const finalScore = calculateWeightedContentScore(item, config);

  return {
    finalScore,
    components,
    weights: normalizedWeights,
    weightedComponents,
  };
}
