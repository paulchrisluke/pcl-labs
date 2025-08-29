/**
 * Content scoring configuration
 * 
 * This module defines the weights and normalization parameters for content scoring
 * in the manifest builder. All weights should sum to 1.0 for proper normalization.
 */

export interface ScoringWeights {
  /** Weight for content_score (0-1) */
  contentScore: number;
  /** Weight for GitHub confidence score (0-1) */
  githubConfidence: number;
  /** Weight for clip duration (0-1) */
  duration: number;
  /** Weight for view count (0-1) */
  views: number;
  /** Weight for transcript length (0-1) */
  transcriptLength: number;
}

export interface ScoringConfig {
  /** Weights for each scoring component (must sum to 1.0) */
  weights: ScoringWeights;
  /** Normalization parameters for each component */
  normalization: {
    /** Duration normalization: clips longer than this (seconds) get max score */
    maxDurationSeconds: number;
    /** View count normalization: clips with more views than this get max score */
    maxViewCount: number;
    /** Transcript length normalization: transcripts with more words than this get max score */
    maxTranscriptWords: number;
  };
}

/**
 * Default scoring configuration
 * 
 * Weights are balanced to prioritize:
 * - Content quality (40%): content_score from AI analysis
 * - GitHub relevance (25%): confidence in GitHub context matching
 * - Engagement (15%): view count as proxy for audience interest
 * - Content depth (10%): transcript length as proxy for content richness
 * - Duration (10%): preference for longer clips
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    contentScore: 0.40,
    githubConfidence: 0.25,
    views: 0.15,
    transcriptLength: 0.10,
    duration: 0.10,
  },
  normalization: {
    maxDurationSeconds: 600, // 10 minutes
    maxViewCount: 1000,
    maxTranscriptWords: 200,
  },
};

/**
 * Validate that weights sum to 1.0
 */
export function validateWeights(weights: ScoringWeights): boolean {
  const sum = Object.values(weights).reduce((acc, weight) => acc + weight, 0);
  return Math.abs(sum - 1.0) < 0.001; // Allow small floating point errors
}

/**
 * Normalize weights to sum to 1.0
 */
export function normalizeWeights(weights: ScoringWeights): ScoringWeights {
  const sum = Object.values(weights).reduce((acc, weight) => acc + weight, 0);
  if (sum === 0) {
    throw new Error('Cannot normalize weights: sum is 0');
  }
  
  return {
    contentScore: weights.contentScore / sum,
    githubConfidence: weights.githubConfidence / sum,
    views: weights.views / sum,
    transcriptLength: weights.transcriptLength / sum,
    duration: weights.duration / sum,
  };
}
