# Audio Processor Service

This service handles downloading Twitch clips, extracting audio, and uploading to R2 storage for transcription.

## Features

- Download Twitch clips using yt-dlp
- Extract audio using FFmpeg (MP4 → WAV 16kHz mono)
- Upload to Cloudflare R2 storage
- Support for long clips (chunking)
- FastAPI REST API
- Background processing

## Setup

### Prerequisites

- Python 3.8+
- FFmpeg installed and in PATH
- Cloudflare R2 bucket and credentials

### Installation

1. Install dependencies:
```bash
# Install pip-tools for dependency management
pip install pip-tools

# Install dependencies with reproducible hashes
pip-sync requirements.txt
```

### Dependency Management

This project uses a two-file workflow with pip-tools for reproducible builds:

- **`requirements.in`** - Top-level dependencies with version constraints
- **`requirements.txt`** - Fully pinned dependencies with hashes (auto-generated)

#### Updating Dependencies

1. Edit `requirements.in` with desired version constraints
2. Regenerate `requirements.txt`:
```bash
pip-compile --generate-hashes requirements.in
```

3. Install updated dependencies:
```bash
pip-sync requirements.txt
```

#### Security Benefits

- **Reproducible builds** - Exact same versions across environments
- **Hash verification** - Prevents supply chain attacks
- **Security updates** - Easy to update vulnerable packages
- **CI/CD friendly** - Use `pip-sync` in deployment scripts

### Environment Variables

Required environment variables:
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with R2 permissions
- `R2_BUCKET` - R2 bucket name (default: clip-recap-pipeline)
- `HMAC_SHARED_SECRET` - Shared secret for HMAC authentication with Cloudflare Workers

Optional:
- `MAX_CLIP_DURATION` - Maximum clip duration before chunking (default: 300s)
- `AUDIO_SAMPLE_RATE` - Audio sample rate (default: 16000)
- `AUDIO_CHANNELS` - Number of audio channels (default: 1)
- `PYTHON_ENV` - Environment (development, production, test)
- `DEBUG` - Enable debug mode (true/false)
- `ALLOW_INSECURE` - Disable SSL verification for development (true/false)
- `REDIS_URL` - Redis connection URL for distributed rate limiting (see Redis Configuration section)

## Redis Configuration

### Rate Limiting

This service uses distributed rate limiting to prevent abuse across multiple application instances. The rate limiting system requires a shared cache (Redis) in production environments.

### Development Mode

In development mode (`PYTHON_ENV=development`), the system will:
- Use Redis if `REDIS_URL` is provided
- Fall back to in-memory cache if Redis is unavailable or not configured
- Log warnings about in-memory cache limitations

### Production Mode

In production mode, Redis is **REQUIRED**:
- `REDIS_URL` environment variable must be set
- Application will fail to start if Redis is not available
- Ensures proper rate limiting across multiple instances

### Redis Setup Options

#### 1. Local Redis (Development)
```bash
# Install Redis locally
# macOS: brew install redis
# Ubuntu: sudo apt-get install redis-server

# Start Redis
redis-server

# Set environment variable
export REDIS_URL="redis://localhost:6379/0"
```

#### 2. Redis Cloud (Production)
1. Create account at [Redis Cloud](https://redis.com/try-free/)
2. Create a database
3. Get connection details and set:
```bash
export REDIS_URL="redis://username:password@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345/0"
```

#### 3. Upstash Redis (Production)
1. Create account at [Upstash](https://upstash.com/)
2. Create a Redis database
3. Get connection details and set:
```bash
export REDIS_URL="redis://username:password@us1-capable-rat-12345.upstash.io:12345/0"
```

#### 4. Railway Redis (Production)
1. Create account at [Railway](https://railway.app/)
2. Add Redis service to your project
3. Get connection URL from environment variables

### Rate Limiting Configuration

The rate limiting system is configured with these defaults:
- **Requests per window**: 10 requests
- **Window duration**: 60 seconds
- **Cache key prefix**: `rate_limit:`

These can be modified in `src/security.py` if needed.

### Health Monitoring

The `/health` endpoint includes cache health information:
```json
{
  "status": "healthy",
  "ffmpeg_available": true,
  "r2_configured": true,
  "cache_healthy": true,
  "cache_type": "RedisCache"
}
```

### Troubleshooting

#### Redis Connection Issues
- Check `REDIS_URL` format and credentials
- Verify Redis server is running and accessible
- Check firewall/network connectivity
- Review application logs for connection errors

#### Rate Limiting Not Working
- Ensure Redis is properly configured in production
- Check cache health via `/health` endpoint
- Review rate limiting logs in application output
- Verify multiple instances can access the same Redis instance

## HMAC Authentication

This service integrates with the Cloudflare Workers pipeline using HMAC-SHA256 authentication. The `HMAC_SHARED_SECRET` environment variable must be set to the same value as the Cloudflare Workers pipeline.

### Authentication Flow

1. **Cloudflare Workers** generate HMAC signatures for API requests
2. **Python Server** validates signatures using the shared secret
3. **Secure Communication** between services without exposing credentials

### Required Headers

When calling this service from Cloudflare Workers, include these headers:
- `X-Request-Signature: hex:<64-character-hex-string>` - HMAC-SHA256 signature
- `X-Request-Timestamp: <unix_timestamp>` - Current Unix timestamp
- `X-Request-Nonce: <random_string>` - Random alphanumeric string (16-64 characters)

### Signature Generation

The signature is computed using HMAC-SHA256 over: `body + timestamp + nonce`

```bash
# Example signature generation
signature=$(echo -n "$request_body$timestamp$nonce" | openssl dgst -sha256 -hmac "$HMAC_SHARED_SECRET" -binary | xxd -p -c 64)
```

### Security Notes

- **Secret Management**: The `HMAC_SHARED_SECRET` must be kept secure and never committed to version control
- **Environment Sync**: Ensure the secret is identical across Cloudflare Workers and Python server environments
- **Secret Rotation**: Rotate the secret periodically and update both services simultaneously
- **Access Control**: Limit access to the secret to only authorized personnel and services

### Production Security Guards

The server includes startup guards to prevent security misconfigurations:

- **DISABLE_AUTH Protection**: Prevents `DISABLE_AUTH=true` in production environments
- **Environment Detection**: Checks multiple environment variables (`NODE_ENV`, `PYTHON_ENV`, `FLASK_ENV`, `VERCEL_ENV`)
- **Startup Failure**: Raises `ValueError` and stops server startup if authentication is disabled in production
- **Development Only**: `DISABLE_AUTH=true` is only allowed in development environments

## Usage

### Command Line

Process clips directly:
```bash
python -m src.download_extract CLIP_ID1 CLIP_ID2
```

### API Server

Start the server:
```bash
python main.py
```

Or with uvicorn:
```bash
uvicorn src.api:app --host 0.0.0.0 --port 8000
```

### API Endpoints

- `GET /health` - Health check
- `POST /process-clips` - Process clips (sync or async)
- `GET /clip-status/{clip_id}` - Check clip processing status
- `GET /list-processed-clips` - List processed clips
- `DELETE /cleanup/{clip_id}` - Clean up clip files

### Input Validation

The API validates clip IDs using a conservative regex pattern `^[A-Za-z0-9_-]+$`:
- **Allowed characters**: Alphanumeric (A-Z, a-z, 0-9), hyphens (-), underscores (_)
- **Maximum clips per request**: 10
- **Validation errors**: Returns HTTP 400 with detailed error messages naming offending IDs

**Example validation errors:**
- Empty list: `"No clip IDs provided"`
- Too many clips: `"Maximum 10 clips per request"`
- Invalid characters: `"Invalid clip ID(s): clip@123 (contains invalid characters)"`

### Example API Usage

```bash
# Process clips synchronously
curl -X POST "http://localhost:8000/process-clips" \
  -H "Content-Type: application/json" \
  -d '{"clip_ids": ["ProudRoundCaracal123"], "background": false}'

# Check clip status
curl "http://localhost:8000/clip-status/ProudRoundCaracal123"

# List processed clips
curl "http://localhost:8000/list-processed-clips?limit=10"
```

## Testing

Run the test suite:
```bash
python test_audio_processor.py
```

Run validation tests:
```bash
python -m pytest test_api_validation.py -v
```

Run validation demo:
```bash
python test_validation_demo.py
```

## Deployment

### Vercel

This service is configured for Vercel deployment:

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard

### Local Development

For local development with the Cloudflare Worker:

1. Start the audio processor:
```bash
python main.py
```

2. The Cloudflare Worker can call the audio processor API to process clips

## File Structure

```
server/
├── src/
│   ├── r2.py              # R2 storage utilities
│   ├── ffmpeg_utils.py    # FFmpeg audio processing
│   ├── download_extract.py # Main audio processor
│   ├── cache.py           # Distributed cache interface (Redis/in-memory)
│   ├── security.py        # Security middleware with rate limiting
│   └── api.py             # FastAPI endpoints
├── main.py                # Server entry point
├── requirements.in        # Top-level dependencies
├── requirements.txt       # Pinned dependencies with hashes
├── vercel.json           # Vercel configuration
├── test_audio_processor.py # Integration test suite
├── test_api_validation.py # Unit tests for clip ID validation
├── test_validation_demo.py # Validation demonstration script
└── README.md             # This file
```

## R2 Storage Layout

The service stores files in R2 with this structure:

```
r2://clip-recap-pipeline/
├── clips/{clip_id}.mp4           # Original video files
├── audio/{clip_id}.wav           # Extracted audio (16kHz mono)
├── audio/{clip_id}/chunk_000.wav # Chunked audio for long clips
├── transcripts/{clip_id}.json    # Whisper transcription (from worker)
├── transcripts/{clip_id}.txt     # Plain text transcript
├── transcripts/{clip_id}.vtt     # VTT format transcript
└── transcripts/{clip_id}.ok      # Processing marker
```

## Integration with Cloudflare Worker

The Cloudflare Worker calls this service to:

1. Process clips (download + extract audio)
2. Check processing status
3. Trigger transcription when audio is ready

The worker handles:
- Whisper transcription using Workers AI
- Transcript storage and processing
- Pipeline orchestration
