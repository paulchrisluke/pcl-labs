# PCL Labs - Audio Processing & Web Development

A comprehensive web application with Nuxt.js frontend and Python audio processing API, featuring Twitch clip processing and Cloudflare R2 storage integration.

## 🚀 Features

- **Nuxt.js 3 Frontend** - Modern, responsive web application
- **Python Audio Processor API** - Serverless function for processing Twitch clips
- **Cloudflare R2 Storage** - Scalable object storage for processed audio/video files
- **Twitch Integration** - Download and process Twitch clips
- **Automated Testing** - R2-based testing with real data
- **Vercel Deployment** - Full-stack deployment with serverless functions

## 📁 Project Structure

```
pcl-labs/
├── app/                    # Nuxt.js app components
├── components/             # Vue.js components
├── content/                # Markdown content (blog, portfolio)
├── pages/                  # Nuxt.js pages
├── server/
│   └── api/
│       └── audio_processor.py  # Python API for audio processing
├── clip-recap-pipeline/    # Cloudflare Workers pipeline
├── vercel.json            # Vercel deployment configuration
└── test_audio_processor.py # R2-based testing script
```

## 🛠️ Setup

### Prerequisites

- Node.js 18+ 
- Python 3.8+
- Vercel CLI
- Cloudflare account (for R2 storage)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd pcl-labs
```

2. **Install frontend dependencies:**
```bash
npm install
# or
yarn install
```

3. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

4. **Install Vercel CLI:**
```bash
npm i -g vercel
```

## 🚀 Development

### Frontend Development

Start the Nuxt.js development server:

```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000`

### API Development

The Python API is deployed as a serverless function on Vercel. For local development:

1. **Test the deployed API:**
```bash
curl https://pcl-labs-cgjr4doid-pcl-labs.vercel.app/api/audio_processor
```

2. **Run the R2-based test script:**
```bash
python3 test_audio_processor.py
```

## 🎵 Audio Processor API

### Endpoints

- **`GET /api/audio_processor`** - Health check and status
- **`GET /api/audio_processor/latest`** - Get latest clip from R2 storage
- **`GET /api/audio_processor/clips`** - List all clips in R2 storage
- **`POST /api/audio_processor`** - Process Twitch clips

### Example Usage

```bash
# Health check
curl https://pcl-labs-cgjr4doid-pcl-labs.vercel.app/api/audio_processor

# Get latest clip
curl https://pcl-labs-cgjr4doid-pcl-labs.vercel.app/api/audio_processor/latest

# Process clips
curl -X POST https://pcl-labs-cgjr4doid-pcl-labs.vercel.app/api/audio_processor \
  -H "Content-Type: application/json" \
  -d '{"clip_ids": ["your-clip-id"], "background": false}'
```

## ☁️ Cloudflare R2 Storage

### Configuration

Set the following environment variables in Vercel:

```bash
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_API_TOKEN=your_api_token
R2_BUCKET=your_bucket_name
```

### Features

- **Automatic upload** of processed clips to R2
- **Metadata storage** with clip information
- **Public URL generation** for uploaded files
- **Latest clip retrieval** for testing

## 🧪 Testing

### R2-Based Testing

The test script automatically uses your R2 storage for realistic testing:

```bash
python3 test_audio_processor.py
```

**Test Features:**
- ✅ Health check validation
- ✅ R2 configuration verification
- ✅ Latest clip retrieval
- ✅ Real clip processing
- ✅ Detailed result reporting

### Manual Testing

```bash
# Test health endpoint
curl https://pcl-labs-cgjr4doid-pcl-labs.vercel.app/api/audio_processor

# Test latest clip endpoint
curl https://pcl-labs-cgjr4doid-pcl-labs.vercel.app/api/audio_processor/latest

# Test clips listing
curl https://pcl-labs-cgjr4doid-pcl-labs.vercel.app/api/audio_processor/clips
```

## 🚀 Deployment

### Vercel Deployment

1. **Deploy to production:**
```bash
vercel --prod
```

2. **Deploy to preview:**
```bash
vercel
```

### Environment Variables

Configure these in your Vercel project settings:

**Required for R2 Storage:**
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID` 
- `CLOUDFLARE_API_TOKEN`
- `R2_BUCKET`

**Optional:**
- `NODE_ENV=production`

## 📝 Content Management

### Adding Blog Posts

1. Create a Markdown file in `content/blog/[category]/`
2. Add frontmatter with metadata
3. Write content using Markdown

### Adding Portfolio Items

1. Create a Markdown file in `content/portfolio/[category]/`
2. Add frontmatter with project details
3. Include images in `public/img/`

### Example Frontmatter

```yaml
---
title: Your Content Title
description: Brief description
date: 2024-01-01
tags: [tag1, tag2]
---
```

## 🔧 Configuration

### Vercel Configuration

The `vercel.json` file configures:
- **Build settings** for Nuxt.js and Python
- **API routes** for serverless functions
- **SPA fallback** for client-side routing

### Nuxt Configuration

Key settings in `nuxt.config.ts`:
- Content module configuration
- Build optimization
- Environment variables

## 🐛 Troubleshooting

### Common Issues

1. **R2 Storage Not Configured**
   - Verify environment variables are set in Vercel
   - Check API token permissions (R2 Storage:Edit)

2. **API Function Invocation Failed**
   - Ensure requirements.txt is in the root directory
   - Check Python dependencies are compatible

3. **Clip Processing Errors**
   - Verify Twitch clip IDs are valid
   - Check network connectivity for downloads

### Debug Commands

```bash
# Check API health
curl https://pcl-labs-cgjr4doid-pcl-labs.vercel.app/api/audio_processor

# View deployment logs
vercel logs

# Test local development
npm run dev
```

## 📄 License

This project is proprietary and confidential.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For questions or issues:
- Check the troubleshooting section
- Review API documentation
- Contact the development team
