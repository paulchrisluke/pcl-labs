# Twitch Clip Recap Pipeline

Automated daily blog post generation from Twitch clips using Cloudflare Workers AI, Workflows, and GitHub integration.

## Overview

This pipeline automatically:
1. Fetches Twitch clips from the last 24 hours
2. Transcribes clips using Workers AI Whisper
3. Scores and selects the best moments
4. Generates a blog post with MDX content
5. Creates a GitHub PR for review
6. Judges content quality with AI
7. Sends Discord notifications

## Architecture

- **Cloudflare Workers**: Serverless execution
- **Workers AI**: Transcription and content generation
- **Vectorize**: Embeddings for semantic search
- **R2**: Storage for transcripts and assets
- **GitHub**: Content repository and PR management
- **Discord**: Notifications and review workflow

## Cloudflare Backend URLs

### Production
- **Worker**: `https://clip-recap-pipeline.paulchrisluke.workers.dev`
- **Health Check**: `https://clip-recap-pipeline.paulchrisluke.workers.dev/health`

### Staging
- **Worker**: `https://clip-recap-pipeline-staging.paulchrisluke.workers.dev`
- **Health Check**: `https://clip-recap-pipeline-staging.paulchrisluke.workers.dev/health`

### Development
- **Local**: `http://localhost:8787` (wrangler dev default)

### Twitch OAuth Redirect URLs
Use these URLs in your Twitch Developer Application:
```
https://clip-recap-pipeline.paulchrisluke.workers.dev,https://clip-recap-pipeline-staging.paulchrisluke.workers.dev,http://localhost:8787
```

## Setup

### Prerequisites

1. Cloudflare account with Workers, AI, Vectorize, and R2 enabled
2. Twitch Developer App credentials
3. GitHub App for repository access
4. Discord bot for notifications

### Environment Variables

Set these secrets using `wrangler secret put`:

```bash
# Twitch API
wrangler secret put TWITCH_CLIENT_ID
wrangler secret put TWITCH_CLIENT_SECRET
wrangler secret put TWITCH_BROADCASTER_ID

# GitHub App
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_INSTALLATION_ID
wrangler secret put GITHUB_PRIVATE_KEY
wrangler secret put GITHUB_WEBHOOK_SECRET

# Discord Bot
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_REVIEW_CHANNEL_ID

# Content Repository
wrangler secret put CONTENT_REPO_OWNER
wrangler secret put CONTENT_REPO_NAME
wrangler secret put CONTENT_REPO_MAIN_BRANCH
wrangler secret put CONTENT_REPO_STAGING_BRANCH
```

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy
```

## Configuration

### Cron Schedule

The pipeline runs daily at 09:00 ICT (Asia/Bangkok). Modify in `wrangler.toml`:

```toml
[triggers]
crons = ["0 9 * * *"]
```

### Clip Selection

Adjust clip scoring and selection in `src/services/content.ts`:

- **CLIP_BUDGET**: 5-12 clips per day
- **Score weights**: Dev-focused keywords and patterns
- **Variety enforcement**: Per-hour caps and diversity

## API Endpoints

- `GET /health` - Health check
- `POST /webhook/github` - GitHub webhook handler
- `GET /` - Pipeline status

## Content Structure

Generated posts follow the existing blog structure:

- **Path**: `content/blog/development/YYYY-MM-DD-daily-dev-recap.mdx`
- **URL**: `/blog/development/YYYY-MM-DD-daily-dev-recap`
- **Front-matter**: Matches existing blog posts
- **Content**: Intro + sections with Twitch clip embeds

## Monitoring

- **Logs**: View in Cloudflare Workers dashboard
- **Errors**: Sent to Discord review channel
- **Success**: GitHub PR with judge scores

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test with `npm run dev`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
