# Content Scoring System Refactoring

## Overview

The content scoring system in `manifest-builder.ts` has been refactored to use normalized components with configurable weights, replacing the previous hardcoded multipliers and arbitrary caps.

## Changes Made

### 1. New Configuration System (`src/config/scoring.ts`)

- **ScoringWeights Interface**: Defines weights for each scoring component
- **ScoringConfig Interface**: Combines weights with normalization parameters
- **DEFAULT_SCORING_CONFIG**: Balanced default configuration prioritizing:
  - Content quality (40%): content_score from AI analysis
  - GitHub relevance (25%): confidence in GitHub context matching
  - Engagement (15%): view count as proxy for audience interest
  - Content depth (10%): transcript length as proxy for content richness
  - Duration (10%): preference for longer clips
- **Validation Functions**: `validateWeights()` and `normalizeWeights()` for weight management

### 2. New Scoring Utilities (`src/utils/scoring.ts`)

- **calculateNormalizedScoreComponents()**: Normalizes each component to 0-1 range
- **calculateWeightedContentScore()**: Combines normalized components with weights
- **calculateDetailedScore()**: Provides detailed breakdown for debugging
- **Unit-testable functions**: All scoring logic is now easily testable

### 3. Refactored Manifest Builder

- **Updated calculateContentScore()**: Now uses the new normalized scoring system
- **Enhanced logging**: Detailed scoring breakdown for items with GitHub context
- **Removed hardcoded multipliers**: All scoring logic moved to configurable system

## Key Improvements

### Normalization
- **Content Score**: Already 0-1, clamped to ensure range
- **GitHub Confidence**: Already 0-1, clamped to ensure range  
- **Duration**: Normalized by `maxDurationSeconds` (default: 600s = 10 minutes)
- **Views**: Normalized by `maxViewCount` (default: 1000 views)
- **Transcript Length**: Normalized by `maxTranscriptWords` (default: 200 words)

### Configurability
- **Weights**: Easily adjustable without code changes
- **Thresholds**: Normalization parameters can be tuned
- **Validation**: Automatic weight normalization if they don't sum to 1.0

### Maintainability
- **Separation of Concerns**: Scoring logic separated from manifest building
- **Unit Testing**: Comprehensive test suite (`test-scoring-unit.ts`)
- **Documentation**: JSDoc comments for all functions
- **Type Safety**: Full TypeScript support with interfaces

## Usage

### Basic Scoring
```typescript
import { calculateWeightedContentScore } from './src/utils/scoring.js';
import { DEFAULT_SCORING_CONFIG } from './src/config/scoring.js';

const score = calculateWeightedContentScore(contentItem, DEFAULT_SCORING_CONFIG);
```

### Custom Configuration
```typescript
import { ScoringConfig } from './src/config/scoring.js';

const customConfig: ScoringConfig = {
  weights: {
    contentScore: 0.5,
    githubConfidence: 0.3,
    views: 0.1,
    transcriptLength: 0.05,
    duration: 0.05,
  },
  normalization: {
    maxDurationSeconds: 900, // 15 minutes
    maxViewCount: 2000,
    maxTranscriptWords: 300,
  },
};

const score = calculateWeightedContentScore(contentItem, customConfig);
```

### Detailed Analysis
```typescript
import { calculateDetailedScore } from './src/utils/scoring.js';

const details = calculateDetailedScore(contentItem);
console.log('Score breakdown:', details.weightedComponents);
```

## Testing

Run the scoring system tests:
```bash
npm run test:scoring
```

The test suite covers:
- Normalized component calculation
- Weighted scoring
- Edge cases (zero values, maximum values)
- Weight validation and normalization
- Detailed scoring breakdown

## Migration Notes

- **Backward Compatibility**: The `calculateContentScore()` method signature remains unchanged
- **Default Behavior**: Uses the same general scoring priorities as before
- **Performance**: No significant performance impact
- **Logging**: Enhanced logging for debugging and analysis

## Future Enhancements

- **Environment-specific configs**: Different weights for dev/test/prod
- **A/B Testing**: Easy weight adjustment for experimentation
- **Analytics**: Track scoring component distributions
- **Machine Learning**: Use scoring data to optimize weights automatically
