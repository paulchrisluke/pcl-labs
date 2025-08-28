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

# Worker Configuration (Optional)
wrangler secret put WORKER_ORIGIN  # Origin header for API requests, defaults to production worker URL
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
npx tsx test-github-events.ts  # GitHub event storage and temporal matching (M8)
```

**Test Coverage:**
- **Health Check** (`test-health.ts`): Worker status and uptime
- **Twitch Integration** (`test-twitch.ts`): Credentials, token validation, clip fetching
- **GitHub Integration** (`test-github.ts`): Credentials, repository access, API connectivity
- **Pipeline Functionality** (`test-pipeline.ts`): Clip storage, retrieval, validation, and database operations
- **Audio Processing** (`test-audio-pipeline.ts`): Audio processing pipeline integration using actual stored clips from R2
- **GitHub Events** (`test-github-events.ts`): Event storage, temporal matching, and clip enhancement (M8)

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

### Authentication

All API endpoints require authentication using HMAC SHA-256 signatures with the `HMAC_SHARED_SECRET` environment variable.

**Required Headers:**
- `X-Request-Signature: <hex_signature>` (64-character hex string, preferred) or `X-Request-Signature: <base64_signature>`
- `X-Request-Timestamp: <unix_timestamp>` (Unix timestamp in seconds)
- `X-Request-Nonce: <alphanumeric_nonce>` (16-64 alphanumeric characters)
- `Content-Type: application/json` (for POST requests)
- `Authorization: Bearer <signature>` (optional, alternative to X-Request-Signature)

**HMAC Signature Generation:**
The signature is computed over the payload: `body + timestamp + nonce`

**Hex Signature (Preferred):**
```bash
# Create hex signature from payload
echo -n "$request_body$timestamp$nonce" | openssl dgst -sha256 -hmac "$HMAC_SHARED_SECRET"
```

**Base64 Signature (Alternative):**
```bash
# Create base64 signature from payload
echo -n "$request_body$timestamp$nonce" | openssl dgst -sha256 -hmac "$HMAC_SHARED_SECRET" -binary | base64
```

**Example:**
```bash
# For a GET request with timestamp 1640995200 and nonce abc123def456
echo -n "1640995200abc123def456" | openssl dgst -sha256 -hmac "your-secret"
# Result: a1b2c3d4e5f6...

# For a POST request with JSON body
echo -n '{"key":"value"}1640995200abc123def456' | openssl dgst -sha256 -hmac "your-secret"
# Result: a1b2c3d4e5f6...
```

### Error Codes

| Code | Description |
|------|-------------|
| `400` | Bad Request - Invalid request format or missing required fields |
| `401` | Unauthorized - Missing or invalid authentication |
| `403` | Forbidden - Valid authentication but insufficient permissions |
| `404` | Not Found - Resource not found |
| `405` | Method Not Allowed - HTTP method not supported for endpoint |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error - Server-side error |

### Core Endpoints

#### `GET /`
API status page with endpoint documentation.

**Authentication:** None required

**Response:**
```json
{
  "status": "ok",
  "service": "clip-recap-pipeline",
  "version": "1.0.0",
  "endpoints": [
    "/health",
    "/validate-twitch",
    "/api/twitch/clips",
    "/api/github/activity",
    "/api/github-events/list"
  ]
}
```

**Example:**
```bash
curl -X GET "https://clip-recap-pipeline.paulchrisluke.workers.dev/"
```

#### `GET /health`
Health check endpoint.

**Authentication:** None required

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "clip-recap-pipeline",
  "version": "1.0.0",
  "uptime": "1h 23m 45s"
}
```

**Example:**
```bash
curl -X GET "https://clip-recap-pipeline.paulchrisluke.workers.dev/health"
```

### Twitch Integration

#### `GET /validate-twitch`
Validate Twitch API credentials and connection.

**Authentication:** Required

**Response:**
```json
{
  "valid": true,
  "broadcaster_id": "123456789",
  "broadcaster_login": "username",
  "token_expires_in": 3600
}
```

**Example:**
```bash
timestamp=$(date +%s)
nonce=$(openssl rand -hex 16)
signature=$(echo -n "$timestamp$nonce" | openssl dgst -sha256 -hmac "your-secret")

curl -X GET "https://clip-recap-pipeline.paulchrisluke.workers.dev/validate-twitch" \
  -H "X-Request-Signature: $signature" \
  -H "X-Request-Timestamp: $timestamp" \
  -H "X-Request-Nonce: $nonce"
```

#### `GET /api/twitch/clips`
Fetch recent Twitch clips from the last 24 hours.

**Authentication:** Required

**Query Parameters:**
- `hours` (optional): Number of hours to look back (default: 24)

**Response:**
```json
{
  "clips": [
    {
      "id": "clip_id",
      "url": "https://clips.twitch.tv/clip_id",
      "title": "Clip Title",
      "broadcaster_name": "username",
      "created_at": "2024-01-01T00:00:00.000Z",
      "duration": 30,
      "view_count": 1000
    }
  ],
  "total": 1,
  "fetched_at": "2024-01-01T00:00:00.000Z"
}
```

**Example:**
```bash
timestamp=$(date +%s)
nonce=$(openssl rand -hex 16)
signature=$(echo -n "$timestamp$nonce" | openssl dgst -sha256 -hmac "your-secret")

curl -X GET "https://clip-recap-pipeline.paulchrisluke.workers.dev/api/twitch/clips?hours=24" \
  -H "X-Request-Signature: $signature" \
  -H "X-Request-Timestamp: $timestamp" \
  -H "X-Request-Nonce: $nonce"
```

#### `POST /api/twitch/clips`
Store clips data to R2 storage.

**Authentication:** Required

**Request Body:**
```json
{
  "clips": [
    {
      "id": "clip_id",
      "url": "https://clips.twitch.tv/clip_id",
      "title": "Clip Title",
      "broadcaster_name": "username",
      "created_at": "2024-01-01T00:00:00.000Z",
      "duration": 30,
      "view_count": 1000
    }
  ]
}
```

**Response:**
```json
{
  "stored": 1,
  "failed": 0,
  "errors": []
}
```

**Example:**
```bash
timestamp=$(date +%s)
nonce=$(openssl rand -hex 16)
body='{"clips":[{"id":"test","url":"https://clips.twitch.tv/test","title":"Test","broadcaster_name":"test","created_at":"2024-01-01T00:00:00.000Z","duration":30,"view_count":1000}]}'
signature=$(echo -n "$body$timestamp$nonce" | openssl dgst -sha256 -hmac "your-secret")

curl -X POST "https://clip-recap-pipeline.paulchrisluke.workers.dev/api/twitch/clips" \
  -H "X-Request-Signature: $signature" \
  -H "Content-Type: application/json" \
  -H "X-Request-Timestamp: $timestamp" \
  -H "X-Request-Nonce: $nonce" \
  -d "$body"
```

#### `GET /api/twitch/clips/stored`
List all stored clips from R2 storage.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional): Maximum number of clips to return (default: 100)
- `offset` (optional): Number of clips to skip (default: 0)

**Response:**
```json
{
  "clips": [
    {
      "id": "clip_id",
      "url": "https://clips.twitch.tv/clip_id",
      "title": "Clip Title",
      "broadcaster_name": "username",
      "created_at": "2024-01-01T00:00:00.000Z",
      "duration": 30,
      "view_count": 1000,
      "stored_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

**Example:**
```bash
timestamp=$(date +%s)
nonce=$(openssl rand -hex 16)
signature=$(echo -n "$timestamp$nonce" | openssl dgst -sha256 -hmac "your-secret")

curl -X GET "https://clip-recap-pipeline.paulchrisluke.workers.dev/api/twitch/clips/stored?limit=50&offset=0" \
  -H "X-Request-Signature: $signature" \
  -H "X-Request-Timestamp: $timestamp" \
  -H "X-Request-Nonce: $nonce"
```

### GitHub Integration

#### `GET /validate-github`
Validate GitHub API credentials and repository access.

**Authentication:** Required

**Response:**
```json
{
  "valid": true,
  "app_id": "12345",
  "installation_id": "67890",
  "repositories": [
    "org/repo1",
    "org/repo2"
  ]
}
```

**Example:**
```bash
timestamp=$(date +%s)
nonce=$(openssl rand -hex 16)
signature=$(echo -n "$timestamp$nonce" | openssl dgst -sha256 -hmac "your-secret")

curl -X GET "https://clip-recap-pipeline.paulchrisluke.workers.dev/validate-github" \
  -H "X-Request-Signature: $signature" \
  -H "X-Request-Timestamp: $timestamp" \
  -H "X-Request-Nonce: $nonce"
```

#### `GET /api/github/activity`
Get daily GitHub activity and repository statistics.

**Authentication:** Required

**Query Parameters:**
- `repository` (required): Repository in format `org/repo` (URL-encode slashes as `%2F`)
- `days` (optional): Number of days to look back (default: 1)

**Response:**
```json
{
  "repository": "org/repo",
  "period": "2024-01-01",
  "activity": {
    "commits": 5,
    "pull_requests": 2,
    "issues": 3,
    "releases": 1
  },
  "recent_commits": [
    {
      "sha": "abc123",
      "message": "feat: add new feature",
      "author": "username",
      "date": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Example:**
```bash
timestamp=$(date +%s)
nonce=$(openssl rand -hex 16)
signature=$(echo -n "$timestamp$nonce" | openssl dgst -sha256 -hmac "your-secret")

# Note: URL-encode the repository name (org/repo becomes org%2Frepo)
curl -X GET "https://clip-recap-pipeline.paulchrisluke.workers.dev/api/github/activity?repository=org%2Frepo&days=7" \
  -H "X-Request-Signature: $signature" \
  -H "X-Request-Timestamp: $timestamp" \
  -H "X-Request-Nonce: $nonce"
```

#### `POST /webhook/github`
GitHub webhook handler.

**Authentication:** GitHub webhook signature verification

**Required Headers:**
- `X-Hub-Signature-256: sha256=<hex_signature>`
- `X-GitHub-Delivery: <uuid>`
- `X-GitHub-Event: <event_type>`

**Request Body:** Raw GitHub webhook payload

**Response:**
```json
{
  "status": "accepted",
  "event_id": "uuid",
  "event_type": "pull_request",
  "processed": true
}
```

**Example:**
```bash
# GitHub automatically sends webhooks with proper signatures
# This endpoint is called by GitHub, not by external clients
```

### GitHub Event Storage (M8 - GitHub Integration)

#### `POST /api/github-events/test`
Test GitHub event storage functionality.

**Authentication:** Required

**Request Body:**
```json
{
  "event_type": "pull_request",
  "repository": "org/repo",
  "payload": {
    "action": "opened",
    "pull_request": {
      "number": 123,
      "title": "Test PR",
      "html_url": "https://github.com/org/repo/pull/123"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "event_id": "test-uuid",
  "stored_at": "2024-01-01T00:00:00.000Z"
}
```

**Example:**
```bash
timestamp=$(date +%s)
nonce=$(openssl rand -hex 16)
body='{"event_type":"pull_request","repository":"org/repo","payload":{"action":"opened","pull_request":{"number":123,"title":"Test PR","html_url":"https://github.com/org/repo/pull/123"}}}'
signature=$(echo -n "$body$timestamp$nonce" | openssl dgst -sha256 -hmac "your-secret")

curl -X POST "https://clip-recap-pipeline.paulchrisluke.workers.dev/api/github-events/test" \
  -H "X-Request-Signature: $signature" \
  -H "Content-Type: application/json" \
  -H "X-Request-Timestamp: $timestamp" \
  -H "X-Request-Nonce: $nonce" \
  -d "$body"
```

#### `GET /api/github-events/list`
List stored GitHub events.

**Authentication:** Required

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 1)
- `repository` (optional): Filter by specific repository (URL-encode slashes as `%2F`)
- `event_type` (optional): Filter by event type (e.g., `pull_request`, `push`, `issues`)
- `limit` (optional): Maximum number of events to return (default: 100)

**Response:**
```json
{
  "events": [
    {
      "id": "event-uuid",
      "event_type": "pull_request",
      "repository": "org/repo",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "action": "opened",
      "processed": false
    }
  ],
  "total": 1,
  "filters": {
    "days": 1,
    "repository": "org/repo",
    "event_type": "pull_request"
  }
}
```

**Example:**
```bash
timestamp=$(date +%s)
nonce=$(openssl rand -hex 16)
signature=$(echo -n "$timestamp$nonce" | openssl dgst -sha256 -hmac "your-secret")

# List all pull request events from the last 7 days for a specific repository
curl -X GET "https://clip-recap-pipeline.paulchrisluke.workers.dev/api/github-events/list?days=7&repository=org%2Frepo&event_type=pull_request&limit=50" \
  -H "X-Request-Signature: $signature" \
  -H "X-Request-Timestamp: $timestamp" \
  -H "X-Request-Nonce: $nonce"
```

#### `POST /api/github-events/enhance-clip`
Enhance a clip with GitHub context based on temporal matching.

**Authentication:** Required

**Request Body:**
```json
{
  "clip": {
    "id": "clip_id",
    "created_at": "2024-01-01T00:00:00.000Z",
    "title": "Clip Title",
    "url": "https://clips.twitch.tv/clip_id"
  },
  "repository": "org/repo",
  "time_window_hours": 2
}
```

**Response:**
```json
{
  "clip": {
    "id": "clip_id",
    "created_at": "2024-01-01T00:00:00.000Z",
    "title": "Clip Title",
    "url": "https://clips.twitch.tv/clip_id",
    "github_context": {
      "linked_prs": [
        {
          "number": 123,
          "title": "Feature PR",
          "url": "https://github.com/org/repo/pull/123",
          "merged_at": "2024-01-01T00:30:00.000Z",
          "confidence": "high",
          "match_reason": "temporal_proximity"
        }
      ],
      "linked_commits": [
        {
          "sha": "abc123",
          "message": "feat: add new feature",
          "url": "https://github.com/org/repo/commit/abc123",
          "timestamp": "2024-01-01T00:15:00.000Z"
        }
      ],
      "linked_issues": []
    }
  },
  "matched_events": 2,
  "time_window_hours": 2
}
```

**Example:**
```bash
timestamp=$(date +%s)
nonce=$(openssl rand -hex 16)
body='{"clip":{"id":"clip_id","created_at":"2024-01-01T00:00:00.000Z","title":"Clip Title","url":"https://clips.twitch.tv/clip_id"},"repository":"org/repo","time_window_hours":2}'
signature=$(echo -n "$body$timestamp$nonce" | openssl dgst -sha256 -hmac "your-secret")

curl -X POST "https://clip-recap-pipeline.paulchrisluke.workers.dev/api/github-events/enhance-clip" \
  -H "X-Request-Signature: $signature" \
  -H "Content-Type: application/json" \
  -H "X-Request-Timestamp: $timestamp" \
  -H "X-Request-Nonce: $nonce" \
  -d "$body"
```

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
# Test webhook fix
