import { calculateWeightedContentScore, calculateDetailedScore, calculateNormalizedScoreComponents } from './src/utils/scoring.js';
import { DEFAULT_SCORING_CONFIG, validateWeights, normalizeWeights } from './src/config/scoring.js';
import type { ContentItem } from './src/types/content.js';

/**
 * Unit tests for the new scoring system
 */

// Test data
const createMockContentItem = (overrides: Partial<ContentItem> = {}): ContentItem => ({
  schema_version: '1.0.0',
  clip_id: 'test-clip-1',
  clip_title: 'Test Clip',
  clip_url: 'https://twitch.tv/clip/test',
  clip_duration: 300, // 5 minutes
  clip_view_count: 500,
  clip_created_at: '2024-01-01T12:00:00Z',
  processing_status: 'ready_for_content',
  transcript_url: 'https://r2.example.com/transcripts/test-clip-1.json',
  transcript_summary: 'This is a test transcript with multiple words to test the scoring system.',
  transcript_size_bytes: 1024,
  github_context_url: 'https://r2.example.com/github-context/test-clip-1.json',
  github_summary: 'GitHub context: 1 PRs, 2 commits, 0 issues (confidence: 80.0%)',
  github_context_size_bytes: 512,
  content_score: 0.7,
  stored_at: '2024-01-01T12:00:00Z',
  ...overrides
});

// Test functions
function testNormalizedComponents() {
  console.log('🧪 Testing normalized components...');
  
  const item = createMockContentItem();
  const components = calculateNormalizedScoreComponents(item);
  
  // Test that all components are in 0-1 range
  const allComponents = Object.values(components);
  const allInRange = allComponents.every(c => c >= 0 && c <= 1);
  
  console.log('Components:', components);
  console.log('All components in 0-1 range:', allInRange);
  
  // Test specific values
  const expectedContentScore = 0.7;
  const expectedGithubConfidence = 0.8;
  const expectedDuration = 300 / DEFAULT_SCORING_CONFIG.normalization.maxDurationSeconds; // 0.5
  const expectedViews = 500 / DEFAULT_SCORING_CONFIG.normalization.maxViewCount; // 0.5
  const expectedTranscriptLength = 13 / DEFAULT_SCORING_CONFIG.normalization.maxTranscriptWords; // ~0.065
  
  const tests = [
    { name: 'contentScore', actual: components.contentScore, expected: expectedContentScore },
    { name: 'githubConfidence', actual: components.githubConfidence, expected: expectedGithubConfidence },
    { name: 'duration', actual: components.duration, expected: expectedDuration },
    { name: 'views', actual: components.views, expected: expectedViews },
    { name: 'transcriptLength', actual: components.transcriptLength, expected: expectedTranscriptLength },
  ];
  
  tests.forEach(test => {
    const passed = Math.abs(test.actual - test.expected) < 0.001;
    console.log(`${test.name}: ${passed ? '✅' : '❌'} ${test.actual.toFixed(3)} (expected ~${test.expected.toFixed(3)})`);
  });
  
  console.log('');
}

function testWeightedScoring() {
  console.log('🧪 Testing weighted scoring...');
  
  const item = createMockContentItem();
  const score = calculateWeightedContentScore(item);
  
  console.log(`Final score: ${score}/100`);
  
  // Test that score is in 0-100 range
  const inRange = score >= 0 && score <= 100;
  console.log('Score in 0-100 range:', inRange ? '✅' : '❌');
  
  // Test that score is an integer
  const isInteger = Number.isInteger(score);
  console.log('Score is integer:', isInteger ? '✅' : '❌');
  
  console.log('');
}

function testDetailedScoring() {
  console.log('🧪 Testing detailed scoring...');
  
  const item = createMockContentItem();
  const details = calculateDetailedScore(item);
  
  console.log('Detailed breakdown:', {
    finalScore: details.finalScore,
    weights: details.weights,
    weightedComponents: Object.fromEntries(
      Object.entries(details.weightedComponents).map(([k, v]) => [k, v.toFixed(3)])
    ),
  });
  
  // Test that weights sum to 1
  const weightSum = Object.values(details.weights).reduce((sum, w) => sum + w, 0);
  const weightsSumToOne = Math.abs(weightSum - 1.0) < 0.001;
  console.log('Weights sum to 1:', weightsSumToOne ? '✅' : '❌', `(sum: ${weightSum.toFixed(3)})`);
  
  // Test that weighted components sum to final score
  const weightedSum = Object.values(details.weightedComponents).reduce((sum, w) => sum + w, 0);
  const finalScoreFromComponents = Math.round(weightedSum * 100);
  const componentsMatchFinal = finalScoreFromComponents === details.finalScore;
  console.log('Weighted components match final score:', componentsMatchFinal ? '✅' : '❌');
  
  console.log('');
}

function testEdgeCases() {
  console.log('🧪 Testing edge cases...');
  
  // Test with all zeros
  const zeroItem = createMockContentItem({
    content_score: 0,
    clip_view_count: 0,
    clip_duration: 0,
    transcript_summary: '',
    transcript_size_bytes: 0,
    github_summary: '',
    github_context_size_bytes: 0,
  });
  
  const zeroScore = calculateWeightedContentScore(zeroItem);
  console.log('All zeros score:', zeroScore, zeroScore === 0 ? '✅' : '❌');
  
  // Test with maximum values
  const maxItem = createMockContentItem({
    content_score: 1.0,
    clip_view_count: 2000, // Above max
    clip_duration: 1200, // Above max
    transcript_summary: 'This is a very long transcript with many words to test the maximum scoring scenario. '.repeat(20),
    transcript_size_bytes: 100000, // Above max
    github_summary: 'GitHub context: 10 PRs, 20 commits, 5 issues (confidence: 100.0%)',
    github_context_size_bytes: 100000, // Above max
  });
  
  const maxScore = calculateWeightedContentScore(maxItem);
  console.log('Maximum values score:', maxScore, maxScore === 100 ? '✅' : '❌');
  
  // Test with missing optional fields
  const minimalItem = createMockContentItem({
    content_score: undefined,
    clip_view_count: undefined,
    transcript_summary: undefined,
    transcript_size_bytes: undefined,
    github_summary: undefined,
    github_context_size_bytes: undefined,
    clip_duration: 0, // Also set duration to 0 for truly minimal item
  });
  
  const minimalScore = calculateWeightedContentScore(minimalItem);
  console.log('Minimal item score:', minimalScore, minimalScore === 0 ? '✅' : '❌');
  
  console.log('');
}

function testWeightValidation() {
  console.log('🧪 Testing weight validation...');
  
  // Test valid weights
  const validWeights = { contentScore: 0.4, githubConfidence: 0.25, views: 0.15, transcriptLength: 0.1, duration: 0.1 };
  const isValid = validateWeights(validWeights);
  console.log('Valid weights:', isValid ? '✅' : '❌');
  
  // Test invalid weights
  const invalidWeights = { contentScore: 0.5, githubConfidence: 0.5, views: 0.5, transcriptLength: 0.5, duration: 0.5 };
  const isInvalid = !validateWeights(invalidWeights);
  console.log('Invalid weights detected:', isInvalid ? '✅' : '❌');
  
  // Test weight normalization
  const normalized = normalizeWeights(invalidWeights);
  const normalizedSum = Object.values(normalized).reduce((sum, w) => sum + w, 0);
  const normalizedCorrectly = Math.abs(normalizedSum - 1.0) < 0.001;
  console.log('Weight normalization:', normalizedCorrectly ? '✅' : '❌', `(sum: ${normalizedSum.toFixed(3)})`);
  
  console.log('');
}

// Run all tests
console.log('🚀 Starting scoring system unit tests...\n');

testNormalizedComponents();
testWeightedScoring();
testDetailedScoring();
testEdgeCases();
testWeightValidation();

console.log('✅ All scoring system unit tests completed!');
