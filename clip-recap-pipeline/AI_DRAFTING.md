# AI Drafting Feature

## Overview

The AI Drafting feature uses **Workers AI Gemma (Instruct variant)** to automatically generate blog post content from manifests. This feature enhances the existing manifest → Markdown → PR pipeline by adding AI-generated prose while maintaining all existing checks and validation.

## Features

### 🤖 AI Content Generation
- **Model**: Workers AI Gemma Instruct (latest available)
- **Content**: Generates intro, section paragraphs, and outro
- **Style**: Professional, technical, developer-focused
- **Fallback**: Graceful degradation when AI fails

### 🔄 Idempotency & Auditability
- **Deterministic**: Fixed temperature (0.3), top_p (0.9), seed (42)
- **Content Hashing**: Prevents re-generation when content unchanged
- **Prompt Hashing**: Tracks prompt changes for audit trail
- **Metadata**: Records model, parameters, and generation timestamp

### 📝 Integration
- **Manifest Fields**: Adds `draft` and `gen` blocks
- **Markdown Rendering**: Uses AI content when available, falls back to existing
- **Front Matter**: Includes AI generation metadata
- **API Support**: Optional `generate_ai_draft` parameter

## Architecture

### Services

#### AIDrafterService (`src/services/ai-drafter.ts`)
- **Purpose**: Core AI content generation
- **Input**: Manifest with sections, bullets, GitHub context
- **Output**: Structured draft with intro, sections, outro
- **Features**: Idempotency, fallback generation, content sanitization

#### ManifestBuilderService Integration
- **Method**: `generateAIDraft(manifest: Manifest)`
- **Integration**: Optional step in manifest building pipeline
- **Error Handling**: Returns original manifest on failure

#### BlogGeneratorService Integration
- **AI-Aware Rendering**: Uses AI content when available
- **Fallback**: Preserves existing content when AI content missing
- **Metadata**: Includes AI generation info in front matter

### Data Flow

```
Manifest → AIDrafterService → Enhanced Manifest → BlogGeneratorService → Markdown
```

1. **Input**: Manifest with sections, bullets, GitHub context
2. **AI Processing**: Generate intro, section paragraphs, outro
3. **Idempotency Check**: Skip if content unchanged
4. **Manifest Update**: Add `draft` and `gen` fields
5. **Markdown Generation**: Use AI content in blog post
6. **Metadata**: Include AI generation info

## Usage

### API Integration

```typescript
// Build manifest with AI drafting
const result = await manifestBuilder.buildDailyManifest(date, timezone);

// Generate AI draft
const manifestWithDraft = await manifestBuilder.generateAIDraft(result.manifest);

// Generate blog post with AI content
const blogResult = await blogGenerator.generateBlogPost(manifestWithDraft);
```

### API Endpoint

```bash
POST /api/content/manifest
{
  "date": "2024-01-15",
  "timezone": "UTC",
  "generate_ai_draft": true
}
```

### Manual Testing

```bash
# Run AI drafting tests
npx tsx test-ai-drafting.ts
```

## Configuration

### AI Model Settings
- **Model**: `@cf/google/gemma-3-12b-it`
- **Temperature**: `0.3` (deterministic)
- **Top P**: `0.9` (focused sampling)
- **Seed**: `42` (fixed for reproducibility)
- **Max Tokens**: `2000`

### Content Limits
- **Intro/Outro**: Max 500 characters
- **Section Paragraphs**: Max 500 characters each
- **Sanitization**: Removes special characters, normalizes whitespace

## Data Structures

### AIDraft Interface
```typescript
interface AIDraft {
  intro: string;
  sections: Array<{
    paragraph: string;
  }>;
  outro: string;
}
```

### AIGenerationMetadata Interface
```typescript
interface AIGenerationMetadata {
  model: string;
  params: {
    temperature: number;
    top_p: number;
    seed: number;
  };
  prompt_hash: string;
  generated_at: ISODateTimeString;
}
```

### Enhanced Manifest
```typescript
interface Manifest {
  // ... existing fields ...
  draft?: AIDraft;
  gen?: AIGenerationMetadata;
}
```

## Prompt Engineering

### Structure
The AI prompt includes:
- **Context**: Professional developer writing daily recap
- **Style Guide**: Technical, no hype, preserve technical terms
- **Manifest Data**: Title, summary, category, tags
- **Section Details**: Title, bullets, repo, PR links, entities
- **Output Format**: Structured JSON with intro, sections, outro

### Example Prompt
```
You are a professional developer writing a daily development recap blog post. Generate engaging, concise content based on the following sections.

Style: Professional, technical, developer-focused. Preserve technical terms and names. No hype or marketing language.

Structure:
1. Write a brief intro paragraph (2-3 sentences) that sets up the day's development work
2. For each section, write a paragraph (3-4 sentences) that expands on the bullets and context
3. Write a brief outro paragraph (2-3 sentences) that wraps up the day's work

Manifest:
Title: Daily Dev Recap: Content Pipeline Improvements
Summary: Today we focused on improving the content pipeline and implementing new AI features.
Category: development
Tags: development, ai, pipeline

Sections:
Section 1: Manifest Builder Optimization
- Bullets: Improved memory management for large datasets; Faster processing times with better algorithms
- Repo: test/repo
- PR Links: https://github.com/test/repo/pull/123
- Entities: manifest, optimization, performance

Generate the content in this exact JSON format:
{
  "intro": "intro paragraph here",
  "sections": [
    {"paragraph": "section 1 paragraph here"},
    {"paragraph": "section 2 paragraph here"}
  ],
  "outro": "outro paragraph here"
}
```

## Error Handling

### AI Generation Failures
- **Network Issues**: Fallback to basic content generation
- **Invalid Response**: Parse partial content, generate fallback
- **Model Errors**: Use predefined fallback content
- **Graceful Degradation**: Continue pipeline with original content

### Content Validation
- **JSON Parsing**: Extract structured content from AI response
- **Section Count**: Ensure correct number of sections
- **Content Sanitization**: Remove invalid characters, limit length
- **Fallback Generation**: Create basic content when AI fails

## Testing

### Unit Tests
- **AIDrafterService**: Mock AI responses, test idempotency
- **Integration**: End-to-end manifest → AI draft → blog post
- **Error Handling**: Test fallback mechanisms
- **Content Validation**: Test sanitization and limits

### Test Coverage
- ✅ AI content generation
- ✅ Idempotency and hashing
- ✅ Fallback mechanisms
- ✅ Blog post integration
- ✅ Front matter metadata

## Monitoring

### Logging
- **AI Calls**: Model, parameters, response length
- **Generation Success**: Content hash, prompt hash
- **Fallback Usage**: When AI fails, fallback triggered
- **Performance**: Generation time, token usage

### Metrics
- **Success Rate**: Percentage of successful AI generations
- **Fallback Rate**: Percentage of fallback usage
- **Content Quality**: Average word count, readability scores
- **Performance**: Average generation time

## Future Enhancements

### Planned Features
- **Multiple Models**: Support for different AI models
- **Content Templates**: Customizable prompt templates
- **Quality Scoring**: AI-generated content quality assessment
- **Batch Processing**: Generate drafts for multiple manifests
- **User Preferences**: Customizable style and tone

### Potential Improvements
- **Context Enhancement**: Include more GitHub context
- **Style Variants**: Different writing styles (technical, casual, etc.)
- **Content Optimization**: SEO optimization for AI content
- **Collaborative Editing**: Human-AI collaborative drafting

## Security Considerations

### Content Safety
- **Input Validation**: Sanitize all inputs to AI prompts
- **Output Validation**: Validate AI-generated content
- **PII Handling**: No PII in prompts or generated content
- **Content Filtering**: Basic profanity/off-topic filtering

### Access Control
- **Authentication**: HMAC authentication for API endpoints
- **Rate Limiting**: Prevent abuse of AI generation
- **Cost Management**: Monitor AI usage and costs
- **Audit Trail**: Log all AI generation requests

## Deployment

### Environment Variables
- **AI Binding**: Workers AI binding configured in wrangler.toml
- **Model Access**: Ensure Gemma model is available
- **Rate Limits**: Configure appropriate rate limits
- **Monitoring**: Set up logging and metrics

### Production Checklist
- ✅ AI model access verified
- ✅ Rate limits configured
- ✅ Error handling tested
- ✅ Fallback mechanisms working
- ✅ Monitoring and logging enabled
- ✅ Security measures in place

## Troubleshooting

### Common Issues

#### AI Generation Fails
- **Check Model Access**: Verify Gemma model is available
- **Check Rate Limits**: Ensure not hitting API limits
- **Check Network**: Verify AI service connectivity
- **Check Logs**: Review error messages and fallback usage

#### Content Quality Issues
- **Review Prompts**: Check prompt engineering
- **Adjust Parameters**: Modify temperature, top_p settings
- **Validate Input**: Ensure manifest data quality
- **Test Fallbacks**: Verify fallback content generation

#### Performance Issues
- **Monitor Response Times**: Check AI generation latency
- **Optimize Prompts**: Reduce prompt length if needed
- **Cache Results**: Implement caching for repeated requests
- **Batch Processing**: Consider batch operations

### Debug Commands
```bash
# Test AI drafting functionality
npx tsx test-ai-drafting.ts

# Check type safety
npm run type-check

# Run all tests
npm run test:all
```
