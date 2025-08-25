# Twitch Clip Recap Pipeline

Automated daily blog post generation from Twitch clips using Cloudflare Workers AI, Workflows, and GitHub integration.

## Overview

This pipeline automatically:
1. Fetches Twitch clips from the last 24 hours
2. Transcribes clips using Workers AI Whisper
3. Scores and selects the best moments
4. Generates a blog post with Markdown content
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
Use these exact redirect URIs in your Twitch Developer Application (one per line, must match the redirect_uri used in code):

- Production: https://clip-recap-pipeline.paulchrisluke.workers.dev/oauth/callback
- Staging: https://clip-recap-pipeline-staging.paulchrisluke.workers.dev/oauth/callback
- Local Dev: http://localhost:8787/oauth/callback

Note: If your code uses a different callback path, replace `/oauth/callback` above accordingly and keep the same paths in wrangler.toml [routes] and the `redirect_uri` in the OAuth code.

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
wrangler secret put TWITCH_BROADCASTER_LOGIN

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

### Wrangler Configuration

The project uses separate wrangler configuration files for different environments:

- `wrangler.toml` - Main configuration with environment-specific sections
- `wrangler.production.toml` - Production-specific configuration
- `wrangler.staging.toml` - Staging-specific configuration

Each environment file contains its own top-level `[triggers]` section for cron schedules.

## Testing

### GitHub Service Test

Test the GitHub service integration:

```bash
# Set up GitHub tokens (one or more of these)
export GITHUB_TOKEN="your_global_token"  # Fallback for all repos
export GITHUB_TOKEN_PAULCHRISLUKE="your_token_for_pcl_labs"
export GITHUB_TOKEN_BLAWBY="your_token_for_blawby_repos"

# Run the test
npm test
```

The test will:
1. Fetch activity from configured repositories
2. Aggregate commit, PR, issue, and release counts
3. Display a summary of daily activity
4. Show top contributors across all repos

### Token Configuration

Configure tokens in `src/config/repos.json`:
- Each repository has a `tokenKey` that maps to an environment variable
- Use `GITHUB_TOKEN` as a global fallback for all repos
- Set repo-specific tokens to override the global token for specific repositories

## Configuration

### Cron Schedule

The pipeline runs daily at 09:00 ICT (UTC+7). Modify in the appropriate environment file:

**Production** (`wrangler.production.toml`):
```toml
[triggers]
crons = [
  "0 2 * * *",  # Daily at 02:00 UTC (= 09:00 ICT) - main pipeline
  "0 * * * *"   # Every hour - token validation
]
```

**Staging** (`wrangler.staging.toml`):
```toml
[triggers]
crons = [
  "0 2 * * *",  # Daily at 02:00 UTC (09:00 ICT) - main pipeline
  "0 * * * *"   # Every hour - token validation
]
```

### Clip Selection

Adjust clip scoring and selection in `src/services/content.ts`:

- **CLIP_BUDGET**: 5-12 clips per day
- **Score weights**: Dev-focused keywords and patterns
- **Variety enforcement**: Per-hour caps and diversity

## API Endpoints

- `GET /health` - Health check
- `POST /webhook/github` - GitHub webhook handler
  - Verifies `X-Hub-Signature-256` with `GITHUB_WEBHOOK_SECRET`
  - Rejects non-POST methods with 405
  - Includes replay protection (timestamp tolerance + idempotency key)
- `GET /` - Pipeline status
## Content Structure

Generated posts follow the existing blog structure:

- **Path**: `content/blog/development/YYYY-MM-DD-daily-dev-recap.md`
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
