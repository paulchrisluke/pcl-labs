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
- **API Status**: `https://clip-recap-pipeline.paulchrisluke.workers.dev/`

### Development
- **Local**: `http://localhost:8787` (wrangler dev default)
- **Health Check**: `http://localhost:8787/health`
- **API Status**: `http://localhost:8787/`

### Twitch OAuth Redirect URLs
Use these exact redirect URIs in your Twitch Developer Application (one per line; must exactly match the redirect_uri used in code). Twitch requires HTTPS for production; http://localhost is allowed for local development.

- Production: https://clip-recap-pipeline.paulchrisluke.workers.dev/oauth/callback
- Local Dev: http://localhost:8787/oauth/callback

Note: If your code uses a different callback path, replace `/oauth/callback` above accordingly and keep it consistent between your OAuth code and deployment.
- For workers.dev: no [routes] are needed; ensure your Worker handles the path (e.g., /oauth/callback).
- For custom domains: ensure your wrangler.toml [routes] send the callback path to this Worker.
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

# GitHub App (Required)
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_INSTALLATION_ID
wrangler secret put GITHUB_PRIVATE_KEY
wrangler secret put GITHUB_WEBHOOK_SECRET

# GitHub Personal Access Tokens (Optional - fallback for testing)
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_TOKEN_PAULCHRISLUKE
wrangler secret put GITHUB_TOKEN_BLAWBY

# Discord Bot
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_REVIEW_CHANNEL_ID
```

### Environment Variables

Set these variables in your `wrangler.toml` file under the `[vars]` section:

```toml
[vars]
CONTENT_REPO_OWNER = "your-org"
CONTENT_REPO_NAME = "your-content-repo"
CONTENT_REPO_MAIN_BRANCH = "main"
```

**Tip**: Only credentials, private keys, and sensitive tokens should be stored as secrets. Repository metadata like owner, name, and branch names are safe to store as plain-text variables.

### Development

```bash
# Install dependencies
npm install

# Start development server (uses random port - check terminal output)
npm run dev

# Start development server with helpful info
npm run dev:info

# Deploy to production
npm run deploy
```

### Local Development Notes

⚠️ **Important**: Local development has limitations:
- **Random port**: The dev server uses a random port (e.g., `http://localhost:54987`), not always 8787
- **No secrets**: Local dev cannot access `wrangler secret` values - integrations will fail
- **Use production for testing**: Run `npm run test:all` to test against the deployed worker

### Wrangler Configuration

The project uses separate wrangler configuration files for different environments:

- `wrangler.toml` - Main configuration with environment-specific sections
- `wrangler.production.toml` - Production-specific configuration

Each environment file contains its own top-level `[triggers]` section for cron schedules.

#### Required Resource Bindings

**Important**: The following resource bindings must be configured in each environment's wrangler configuration file. Deployments may succeed without these bindings, but runtime operations will fail.

```toml
# AI binding for AI model access
[ai]
binding = "AI"

# Vectorize index for embeddings storage
[[vectorize]]
binding = "VECTOR_INDEX"
index_name = "clips-embeddings"

# R2 bucket for clip storage
[[r2_buckets]]
binding = "CLIPS_BUCKET"
bucket_name = "clip-recap"

# KV namespace for state management
[[kv_namespaces]]
binding = "STATE_KV"
id = "your-kv-namespace-id-here"  # Replace with actual KV namespace ID per environment
```

**Environment-Specific Configuration**:
- Add equivalent binding blocks to `wrangler.staging.toml` and `wrangler.production.toml`
- Replace placeholder IDs and names with actual resource identifiers for each environment
- KV namespace IDs must be unique per environment and created via Cloudflare dashboard or CLI

### Testing

```bash
# Test against production worker (recommended)
npm run test:all

# Test against local dev server (will fail due to missing secrets)
npm run test:local

# Test with custom worker URL
WORKER_URL=http://localhost:54987 npm run test:all

# Individual test files
npx tsx test-health.ts      # Health check endpoint
npx tsx test-twitch.ts      # Twitch credentials and API
npx tsx test-github.ts      # GitHub credentials and API
npx tsx test-pipeline.ts    # Daily pipeline functionality
npx tsx test-audio-pipeline.ts  # Audio processing pipeline integration (uses stored clips)
```

**Test Coverage:**
- **Health Check** (`test-health.ts`): Worker status and uptime
- **Twitch Integration** (`test-twitch.ts`): Credentials, token validation, clip fetching
- **GitHub Integration** (`test-github.ts`): Credentials, repository access, API connectivity
- **Pipeline Functionality** (`test-pipeline.ts`): Clip storage, retrieval, validation, and database operations
- **Audio Processing** (`test-audio-pipeline.ts`): Audio processing pipeline integration using actual stored clips from R2

**Test Results:**
All tests validate the complete pipeline workflow:
1. ✅ Health endpoint responds correctly
2. ✅ Twitch API credentials and clip fetching work
3. ✅ GitHub API credentials and repository access work
4. ✅ Clip storage and retrieval from R2 database work
5. ✅ Data validation and sanitization work

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



## API Endpoints

### Core Endpoints
- `GET /` - API status page with endpoint documentation
- `GET /health` - Health check endpoint

### Twitch Integration
- `GET /validate-twitch` - Validate Twitch API credentials and connection
- `GET /api/twitch/clips` - Fetch recent Twitch clips from the last 24 hours
- `POST /api/twitch/clips` - Store clips data to R2 storage
- `GET /api/twitch/clips/stored` - List all stored clips from R2 storage
### GitHub Integration
- `GET /validate-github` - Validate GitHub API credentials and repository access
- `GET /api/github/activity` - Get daily GitHub activity and repository statistics
- `POST /webhook/github` - GitHub webhook handler
  - Verifies `X-Hub-Signature-256` (HMAC SHA-256) with `GITHUB_WEBHOOK_SECRET`
  - Rejects non-POST methods with 405
  - Uses the raw request body (no JSON parsing before HMAC) and constant-time comparison to validate signatures. Expect header format `sha256=<hex>`.
  - Responds 401/403 on invalid or missing signature; 2xx on success (202 if work is queued).
  - Includes replay protection (idempotency via `X-GitHub-Delivery` UUID with a configurable TTL; signature verification prevents payload tampering).
  - Offloads long-running or non-critical work to async tasks/queues to ensure responses meet GitHub's webhook timeout.

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
