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
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your Cloudflare credentials
```

### Environment Variables

Required environment variables:
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `CLOUDFLARE_ZONE_ID` - Cloudflare zone ID
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with R2 permissions
- `R2_BUCKET` - R2 bucket name (default: clip-recap-assets)

Optional:
- `MAX_CLIP_DURATION` - Maximum clip duration before chunking (default: 300s)
- `AUDIO_SAMPLE_RATE` - Audio sample rate (default: 16000)
- `AUDIO_CHANNELS` - Number of audio channels (default: 1)
- `PYTHON_ENV` - Environment (development, production, test)
- `DEBUG` - Enable debug mode (true/false)
- `ALLOW_INSECURE` - Disable SSL verification for development (true/false)

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
│   └── api.py             # FastAPI endpoints
├── main.py                # Server entry point
├── requirements.txt       # Python dependencies
├── vercel.json           # Vercel configuration
├── test_audio_processor.py # Test suite
└── README.md             # This file
```

## R2 Storage Layout

The service stores files in R2 with this structure:

```
r2://clip-recap-assets/
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
