# Daily Clips → Blog (Cloudflare Workers AI + Workflows + GitHub + Discord)

**Goal:** Turn daily Twitch clips into a Markdown recap PR for review, with semantic search, an LLM judge gate, and Discord notifications. Runs on **Cloudflare Workers + Workflows** with **Workers AI** models. No servers.

---

## Current Implementation Status ✅

**COMPLETED:**

* ✅ **M0 — Skeleton**: Scaffolded from Workflows starter with Cron triggers
* ✅ **M1 — Clips → Transcripts**: Twitch OAuth, clip fetching, Workers AI Whisper integration
* ✅ **M2 — Rank & Draft**: Scoring system, clip selection, blog post generation
* ✅ **M3 — PR & Discord**: GitHub App integration, PR creation, Discord notifications
* ✅ **M4 — Judge**: LLM judge with rubric, Check Run integration
* ✅ **M5 — Vectorize**: Embeddings generation and Vectorize integration
* ✅ **M6 — Polish**: Social blurbs, repo/PR link detection

**CURRENT STATE:**

* ✅ **Production Worker**: Deployed at `https://clip-recap-pipeline.paulchrisluke.workers.dev`
* ✅ **Cron Triggers**: Daily pipeline (02:00 UTC) + hourly token validation
* ✅ **Service Integration**: Twitch, GitHub, Discord, Workers AI, Vectorize, R2 all configured
* ✅ **Health Checks**: `/health`, `/validate-twitch`, `/validate-github` endpoints working
* ✅ **Test Suite**: Complete test coverage (health, Twitch, GitHub, pipeline functionality)
* ✅ **Core Pipeline**: Complete daily workflow from clips → storage → scoring → blog → PR → judge → Discord
* ✅ **Database Operations**: Clip storage and retrieval from R2 working correctly
* ✅ **Pipeline Testing**: Full end-to-end pipeline validation with 10 clips stored

**ACTUAL IMPLEMENTATION DETAILS:**

### Video Download & Storage API (Separate Implementation)
* ✅ **Python API**: Deployed on Vercel at `https://pcl-labs-cgjr4doid-pcl-labs.vercel.app/api/audio_processor`
* ✅ **R2 Storage Integration**: Direct upload to Cloudflare R2 with metadata
* ✅ **Twitch Clip Processing**: Download and store MP4 video files (no audio extraction yet)
* ✅ **Testing Framework**: R2-based testing with real data instead of hardcoded IDs
* ✅ **Endpoints**: Health check, latest clip retrieval, clips listing, processing
* ✅ **yt-dlp Integration**: Working video downloads from Twitch clip URLs

### Test Results
* ✅ **Health Check**: API responding correctly with R2 configuration status
* ✅ **R2 Integration**: Successfully configured and tested
* ✅ **Clip Processing**: Working with proper error handling for invalid clip IDs
* ✅ **Storage Operations**: R2 upload/download working correctly
* ✅ **Error Handling**: Proper validation and error responses

---

## High-level flow (ACTUAL)

1. **Cron (daily, 02:00 UTC)** kicks a Workflow run.
2. **Fetch clips** from the last 24h for the broadcaster.
3. **Store clip metadata** in R2 with proper structure.
4. **Score/select** the best 6–12 moments (dev‑stream tuned rules).
5. **Draft**: intro + one section per clip (title, bullets, paragraph, embed, optional VOD timestamp).
6. **Embed & index**: create embeddings, upsert to Vectorize for semantic search.
7. **Author Markdown** (front‑matter + sections), open a **GitHub PR** in the content repo.
8. **Judge**: second LLM scores the draft (coherence, correctness, dev‑signal, flow, length, safety). Publishes a **GitHub Check**.
9. **Notify**: send **Discord bot channel post** with PR link + judge score.

```
[ Cron ] -> [ Workflows Orchestrator ]
   |-> [Twitch Clips] -> [R2 Storage] -> [Rank/Select] -> [LLM Draft]
   |-> [Embeddings] -> [Vectorize]
   |-> [Markdown file] -> [GitHub PR + Check]
   |-> [Discord bot channel post]
   |-> [R2: clips/metadata/assets]
```

**Note**: Audio processing is handled by a separate Python API on Vercel, not integrated into the main Cloudflare Workers pipeline.

---

## M7 — Audio Processing Integration (NEXT MILESTONE)

**Goal:** Add audio extraction and transcription to the existing video download API, then integrate with the main Cloudflare Workers pipeline.

### Current Status ✅

* ✅ **Python API Built**: Video download and storage API with R2 integration
* ✅ **Vercel Deployment**: API deployed and tested at `https://pcl-labs-cgjr4doid-pcl-labs.vercel.app`
* ✅ **R2 Storage**: Working integration with proper metadata storage
* ✅ **Testing Framework**: R2-based testing with real data
* ✅ **API Endpoints**: Health check, latest clip, clips listing, processing
* ✅ **Video Downloads**: yt-dlp integration working for Twitch clip downloads

### Missing Components ❌

* ❌ **Audio Extraction**: No FFmpeg.wasm or audio processing
* ❌ **Whisper Transcription**: No Workers AI integration
* ❌ **Transcript Storage**: No transcript data structures
* ❌ **Audio Processing Pipeline**: No audio → text conversion

### Audio Processing Tasks 🔄

1. **Audio Extraction**: Add FFmpeg.wasm to extract audio from downloaded MP4 files
2. **Whisper Integration**: Add Workers AI Whisper transcription to the Python API
3. **Transcript Storage**: Create transcript data structures and R2 storage
4. **Audio Processing Pipeline**: Implement audio → text conversion workflow
5. **API Enhancement**: Add transcription endpoints to existing API

### Integration Tasks 🔄

6. **API Integration**: Call enhanced Python API from Cloudflare Workers pipeline
7. **Workflow Updates**: Modify daily workflow to use Python API for audio processing
8. **Error Handling**: Robust error handling between Workers and Python API
9. **Data Flow**: Ensure proper data flow from Workers → Python API → R2 → Workers
10. **Testing**: End-to-end testing of integrated pipeline

### Technical Approach

* **Audio Extraction**: Use FFmpeg.wasm to convert MP4 to WAV/MP3 for Whisper
* **Whisper Model**: `@cf/openai/whisper-large-v3-turbo` for high-quality transcription
* **Chunking**: Handle clips longer than 90 seconds by chunking audio
* **Storage**: Store transcripts as JSON with segments and metadata
* **API Calls**: Use fetch() from Workers to call Python API endpoints
* **Data Exchange**: JSON payloads for clip processing requests
* **Error Handling**: Retry logic and fallback mechanisms
* **Storage Coordination**: Ensure R2 access from both Workers and Python API
* **Monitoring**: Health checks and logging across both systems

---

## M8 — Schema & Manifest Architecture (FUTURE MILESTONE)

### Recommended Approach (TL;DR)

* **GitHub Markdown is the canonical post.**
* **R2 holds the "manifest + artifacts"** for each post‑day (transcripts, scores, section metadata, run logs).
* **Vectorize** indexes the text (clips + sections + post) for semantic search.
* Everything shares a stable **`post_id`** (YYYY‑MM‑DD) and **`clip_id`**s.

### R2 Layout (keys) - ACTUAL IMPLEMENTATION

```
r2://recaps/
  manifests/YYYY/MM/POST_ID.json              # source-of-truth metadata for the day
  drafts/YYYY/MM/POST_ID.md                   # optional staging copy of the Markdown
  clips/CLIP_ID/meta.json                     # clip metadata from Twitch
  clips/CLIP_ID/video.mp4                     # downloaded video file (Python API) ✅ IMPLEMENTED
  clips/CLIP_ID/audio.wav                     # extracted audio file (Python API) ❌ NOT IMPLEMENTED
  transcripts/CLIP_ID.json                    # ASR output (segments, redacted) ❌ NOT IMPLEMENTED
  assets/POST_ID/cover.jpg                    # images/thumbnails
  runs/DATE/run-<timestamp>.json              # workflow logs/metrics
```

### Manifest Schema (R2) — JSON (authoritative for automation)

Use this to drive PR creation, the judge check, Discord posts, and backfills.

```json
{
  "schema_version": "1.0.0",
  "post_id": "2025-08-25",
  "date_utc": "2025-08-25T02:00:00Z",
  "tz": "Asia/Bangkok",
  "title": "Daily Devlog — 2025-08-25: Deadlock Fix Lands, Tests Green",
  "headline": "Daily Devlog — 2025-08-25: Deadlock Fix Lands, Tests Green",
  "summary": "Deadlock fix lands; tests green; cart perf +12%.",
  "description": "Daily development recap from 2025-08-25 featuring 7 key moments including deadlock fix and test improvements.",
  "category": "development",
  "articleSection": "development",
  "tags": ["Development", "Live Coding", "Twitch", "Daily Recap"],
  "keywords": "development, live coding, twitch, daily recap, deadlock, tests, PCL-Labs",
  "repos": ["paulchrisluke/pcl-labs"],
  "clip_ids": ["ProudRoundCaracal123"],
  "sections": [
    {
      "section_id": "01FZ...ULID",
      "clip_id": "ProudRoundCaracal123",
      "title": "Fix: async deadlock — tests green",
      "bullets": [
        "Root cause: lock ordering in cart service",
        "Reworked await path",
        "All tests pass locally"
      ],
      "paragraph": "After chasing a sporadic deadlock...",
      "score": 87,
      "repo": "paulchrisluke/pcl-labs",
      "pr_links": ["https://github.com/paulchrisluke/pcl-labs/pull/42"],
      "clip_url": "https://clips.twitch.tv/...",
      "vod_jump": "https://www.twitch.tv/videos/123456789?t=1h24m32s",
      "start_s": 5050,
      "end_s": 5110,
      "entities": ["CheckoutService", "locks.py"]
    }
  ],
  "canonical_vod": "https://www.twitch.tv/videos/123456789",
  "md_path": "content/blog/development/2025-08-25-daily-dev-recap.md",
  "target_branch": "main",
  "status": "draft",
  "judge": {
    "overall": null,
    "per_axis": null,
    "version": "v1"
  },
  "social_blurbs": {
    "bluesky": "Deadlock slain. Tests green. +12% cart perf. Recap:",
    "threads": "Devlog: deadlock fix, tests pass, perf win →"
  },
  "runs": { "latest": "2025-08-25T02:10:14Z" }
}
```

### Markdown Front‑matter (GitHub) — Minimal & LLM‑Friendly

**Decision:** Generate JSON‑LD at render time (Nuxt Content layout) rather than stuffing full Schema.org blocks into front‑matter. Keep front‑matter minimal and LLM‑friendly.

```yaml
---
post_id: "2025-08-25"
title: "Daily Devlog — 2025-08-25: Deadlock Fix Lands, Tests Green"
date: "2025-08-25T02:00:00Z"
timezone: "Asia/Bangkok"
summary: "Daily development recap from 2025-08-25 featuring 7 key moments including deadlock fix and test improvements."
tags: ["Development", "Live Coding", "Twitch", "Daily Recap"]
repos: ["paulchrisluke/pcl-labs"]
clip_count: 7
canonical_vod: "https://www.twitch.tv/videos/123456789"
entities: ["CheckoutService", "locks.py", "deadlock", "tests"]
canonical: "https://paulchrisluke.com/blog/development/2025-08-25-daily-dev-recap"
og_image: "https://res.cloudinary.com/pcl-labs/image/upload/v[timestamp]/PCL-Labs/daily-recap-2025-08-25.webp"
source_manifest: "r2://recaps/manifests/2025/08/2025-08-25.json"
draft: false
---
```

### Vectorize Indexing (semantic search)

Index three granularities:

1. **clip** — text = clip transcript; `meta = {clip_id, date, repo, vod_id, url}`
2. **section** — text = section title + bullets + paragraph; `meta = {post_id, section_id, clip_id, pr_links[], repo}`
3. **post** — text = intro + section summaries; `meta = {post_id, date, tags[], repos[]}`

**Embeddings:** `@cf/baai/bge-m3` (cost‑effective, multilingual). Dimension = 1024. Detect dynamically by generating a sample embedding during index setup.

---

## Schema.org Validation Requirements (render‑time JSON‑LD)

**Required Article properties:** `@type`, `@context`, `headline`, `name`, `description`, `datePublished`, `dateModified`, `author`, `publisher` (+logo)

**Required VideoObject properties (for Twitch clips):** `@type`, `name`, `description`, `uploadDate`, `duration`, `contentUrl`, `embedUrl`, `thumbnailUrl`

**SEO Validation Rules:** Title 50–60 chars; meta description 150–160 chars; absolute canonical; complete Open Graph & Twitter Card.

---

## Implementation Tasks for M7

### Audio Processing Implementation
1. **Add FFmpeg.wasm dependency** to requirements.txt for audio extraction
2. **Create audio extraction service** using FFmpeg.wasm to convert MP4 to WAV/MP3
3. **Add Whisper transcription service** with chunking support using Workers AI
4. **Update R2 storage schema** to include audio files and transcripts
5. **Modify clip processing** to include audio extraction and transcription
6. **Add transcription endpoints** to the Python API
7. **Add audio processing tests** to test suite

### Integration Tasks
8. **API Integration**: Call enhanced Python API from Cloudflare Workers pipeline
9. **Workflow Updates**: Modify daily workflow to use Python API for audio processing
10. **Error Handling**: Implement robust error handling between Workers and Python API
11. **Data Flow**: Ensure proper data flow from Workers → Python API → R2 → Workers
12. **Testing**: End-to-end testing of integrated pipeline

### Manifest & Schema Updates
6. **Define JSON Schema** for manifest validation → `/schema/manifest.schema.json`
7. **Update R2 bucket structure** with `recaps/` prefix and audio/video paths
8. **Modify pipeline** to write manifest **before** PR creation
9. **Update PR generation** to render Markdown from manifest
10. **Add validation** for unique `post_id` and manifest integrity
11. **Add Schema.org validation** at render time
12. **Update Vectorize indexing** with new metadata structure
13. **Create validation tests** (schema + SEO + safety/PII)

---

## Environment & bindings

### Cloudflare account

* **Workers + Workflows** enabled
* **Workers AI** binding
* **Vectorize** index created
* **R2** bucket created
* **AI Gateway** (optional)

### Secrets (Wrangler vars)

**✅ Currently Configured:**
* `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BROADCASTER_ID`
* `GITHUB_TOKEN`, `GITHUB_TOKEN_PAULCHRISLUKE`, `GITHUB_TOKEN_BLAWBY`

**❌ Still Needed for Full Pipeline:**
* `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_PRIVATE_KEY` (for PR creation)
* `DISCORD_BOT_TOKEN`, `DISCORD_REVIEW_CHANNEL_ID` (for notifications)
* `CONTENT_REPO_OWNER=paulchrisluke`, `CONTENT_REPO_NAME=pcl-labs`, `CONTENT_REPO_MAIN_BRANCH=main` (environment variables)

**Python API Environment Variables (Vercel):**
* `CLOUDFLARE_ACCOUNT_ID`
* `CLOUDFLARE_ZONE_ID`
* `CLOUDFLARE_API_TOKEN`
* `R2_BUCKET`

**Optional (AI Gateway):**
* `GOOGLE_AI_STUDIO_API_KEY`, `AI_GATEWAY_ID`, `AI_GATEWAY_URL`

### Bindings (wrangler.toml)

* `ai` — Workers AI
* `VECTORIZE` — Vectorize index binding
* `R2_BUCKET` — R2 bucket for transcripts/assets
* `WORKFLOW` — Workflows binding
* `ENV` — JSON for feature flags (e.g., judge thresholds)

---

## Model choices (Workers AI)

* **ASR**: `@cf/openai/whisper-large-v3-turbo`
* **Drafting LLM**: **Gemma (Instruct)** — latest available in catalog
* **Embeddings**: `@cf/baai/bge-m3` (≈1024 dims)
* **Judge LLM**: **Gemma (Instruct, small/faster)**

---

## Daily Workflow (orchestration spec)

**Trigger:** `0 2 * * *` (02:00 UTC / 09:00 Bangkok)

**Steps:**

1. **List Clips** (`GET /helix/clips`)
2. **Store Metadata** (clip metadata to R2)
3. **Score & select** (dev‑stream heuristics)
4. **Draft** post (front‑matter + sections + embeds)
5. **Embeddings → Vectorize** (clip + section + post)
6. **Create PR** (branch: `auto/daily-recap-YYYY-MM-DD`; path: `content/blog/development/YYYY-MM-DD-daily-dev-recap.md`; target: `main`)
7. **Judge** (GitHub Check Run)
8. **Discord** (bot channel post)

**Note**: Audio processing is handled separately by the Python API on Vercel.

---

## Data shapes (contracts)

**Clip (input)**

```json
{
  "clip_id": "ProudRoundCaracal123",
  "title": "Tests finally green after deadlock fix",
  "url": "https://clips.twitch.tv/...",
  "duration_s": 52,
  "created_at": "2025-08-23T14:05:33Z",
  "view_count": 37,
  "vod_id": "123456789",
  "vod_offset_s": 5072
}
```

**Transcript** (R2 object — redacted)

```json
{
  "clip_id": "...",
  "lang": "en",
  "segments": [
    { "start_s": 0.2, "end_s": 6.8, "text": "okay rerun the tests..." },
    { "start_s": 6.9, "end_s": 14.2, "text": "nice they pass" }
  ]
}
```

**Section** (for Markdown)

```json
{
  "clip_id": "...",
  "h2": "Fix: async deadlock — tests green",
  "bullets": ["Root cause: await in hot path", "Reworked lock ordering", "All tests green"],
  "paragraph": "After chasing a sporadic deadlock...",
  "clip_url": "https://clips.twitch.tv/...",
  "vod_jump": "https://www.twitch.tv/videos/123456789?t=1h24m32s",
  "repo": "org/repo",
  "pr_links": ["https://github.com/org/repo/pull/42"]
}
```

**Judge result** (Check Run summary)

```json
{
  "overall": 86,
  "per_axis": { "coherence": 18, "correctness": 22, "dev_signal": 17, "narrative_flow": 14, "length": 8, "safety": 7 },
  "per_axis_percentages": { "coherence": 90.0, "correctness": 88.0, "dev_signal": 85.0, "narrative_flow": 93.3, "length": 80.0, "safety": 70.0 },
  "reasons": ["Tight summary, grounded in transcript"],
  "action": "approve"
}
```

---

## Judge rubric (approval gate)

* **Coherence (0–20)** — Each section stands alone; no context gaps.
* **Technical correctness (0–25)** — Matches transcript/clip; no hallucinated APIs or wrong test names.
* **Dev signal (0–20)** — Clear milestone; includes files/modules/issues if available.
* **Narrative flow (0–15)** — Setup → attempt → result → why it matters.
* **Length/clarity (0–10)** — Precise; no fluff.
* **Safety/compliance (0–10)** — No secrets/PII; safe content.

**Pass if:** overall ≥ **80** and no axis < **60**. Else label `needs-polish` and notify.

---

## Posting targets (first wave)

* **Primary**: Markdown site (content repo PR). After merge, your site host deploys.
* **Optional later**: Cross‑post to X/Bluesky/Threads/Mastodon/LinkedIn.

---

## Twitch specifics

* Enable Clips; mods can create clips daily.
* **Helix API**: `Get Clips` for last 24h. Optionally use **Stream Markers** for richer timestamps.
* Avoid full‑VOD pulls in this phase; link to VOD with `?t=` when the clip offset is reliable.

---

## Configuration knobs

* **CLIP_BUDGET**: 6–12/day
* **WINDOW**: 60–120s (scoring windows)
* **SCORE_WEIGHTS**: tests pass +5; feat/fix/revert +4; build flip +3; merge resolved +3; entities +2; excitement +2; novelty +1; idle −2
* **JUDGE_THRESHOLD**: overall ≥ 80, axis ≥ 60
* **EMBED_MODEL**: `@cf/baai/bge-m3`

---

## Security & privacy

* Keep all secrets in Wrangler secrets.
* Route AI calls via **AI Gateway** for logging, rate limit, retries, fallbacks (optional).
* Do **not** store raw audio publicly; use R2 with tight access policies.
* **Redact PII before persisting to R2 and before embeddings.**
* Denylist patterns: API keys/tokens, emails, public IPs, DB DSNs, JWTs, SSH keys, `KEY=VALUE` envs.

---

## Local dev & testing

* **Miniflare** to trigger `scheduled()` locally and simulate daily runs.
* **Dry‑run mode**: creates PR **draft** and posts Discord to a test channel.
* **Fixtures**: 3–5 known clips/transcripts for deterministic tests.

---

## Open questions (fill before build)

* Provide **`DISCORD_REVIEW_CHANNEL_ID`** (numeric) for channel posts.
* Confirm Markdown lives at `content/blog/development/`.
* (Optional) Additional repos to track for PR links (besides `pcl-labs`).

---

## Starter repos & official docs

* **Cloudflare Workflows starter**: [https://github.com/cloudflare/workflows-starter](https://github.com/cloudflare/workflows-starter)
* **Workflows docs**: [https://developers.cloudflare.com/workflows/](https://developers.cloudflare.com/workflows/)
* **Workers templates**: [https://github.com/cloudflare/templates](https://github.com/cloudflare/templates)
* **Workers AI (overview & models)**: [https://developers.cloudflare.com/workers-ai/](https://developers.cloudflare.com/workers-ai/)
* **Model catalog**: [https://developers.cloudflare.com/workers-ai/models/](https://developers.cloudflare.com/workers-ai/models/)
* **Whisper large‑v3‑turbo**: [https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/)
* **ASR chunking tutorial**: [https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-workers-ai-whisper-with-chunking/](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-workers-ai-whisper-with-chunking/)
* **AI Gateway**: [https://developers.cloudflare.com/ai-gateway/](https://developers.cloudflare.com/ai-gateway/)
* **Vectorize**: [https://developers.cloudflare.com/vectorize/](https://developers.cloudflare.com/vectorize/)
* **R2**: [https://developers.cloudflare.com/r2/](https://developers.cloudflare.com/r2/)
* **Cron Triggers**: [https://developers.cloudflare.com/workers/configuration/cron-triggers/](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
* **Miniflare scheduled testing**: [https://developers.cloudflare.com/workers/testing/miniflare/core/scheduled/](https://developers.cloudflare.com/workers/testing/miniflare/core/scheduled/)
* **Twitch Helix API** (Clips/Markers/Videos/Scopes):

  * Get Clips: [https://dev.twitch.tv/docs/api/clips](https://dev.twitch.tv/docs/api/clips)
  * Markers: [https://dev.twitch.tv/docs/api/markers/](https://dev.twitch.tv/docs/api/markers/)
  * Videos: [https://dev.twitch.tv/docs/api/videos](https://dev.twitch.tv/docs/api/videos)
  * Scopes: [https://dev.twitch.tv/docs/authentication/scopes/](https://dev.twitch.tv/docs/authentication/scopes/)
* **GitHub** (PR, Contents, Checks, App auth):

  * Contents: [https://docs.github.com/en/rest/repos/contents](https://docs.github.com/en/rest/repos/contents)
  * Pull Requests: [https://docs.github.com/en/rest/pulls](https://docs.github.com/en/rest/pulls)
  * Checks API: [https://docs.github.com/rest/checks/runs](https://docs.github.com/rest/checks/runs)
  * GitHub App auth: [https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app)
* **Discord (bot channel posts)**: [https://discord.com/developers/docs/resources/channel#message-object](https://discord.com/developers/docs/resources/channel#message-object)

---

## 🎯 M7 "Definition of Done" (Cursor's Checklist)

### Audio Processing Integration
* ✅ Python API integration working from Cloudflare Workers
* ✅ Workflow updates to use Python API for audio processing
* ✅ Error handling between Workers and Python API
* ✅ Data flow from Workers → Python API → R2 → Workers
* ✅ End-to-end testing of integrated pipeline

### Manifest & Schema Updates
* ✅ Manifest JSON Schema committed and validated in CI
* ✅ R2 layout created and helper functions implemented (put/get manifest, put transcripts, list day)
* ✅ Front‑matter generator maps manifest → Markdown front‑matter (minimal set above)
* ✅ Renderer builds Markdown body from manifest sections
* ✅ PR builder uses manifest + renderer; targets `main`; idempotent if PR exists
* ✅ Judge check runs post‑PR and updates GitHub Checks; labels `needs-review` / `needs-polish`
* ✅ Discord notifier posts to `DISCORD_REVIEW_CHANNEL_ID`
* ✅ Vectorize upserts for `clip`, `section`, `post` with agreed metadata
* ✅ Dry‑run mode and fixtures for local tests (Twitch/GitHub off)
* ✅ Cron remains at `02:00 UTC` (09:00 Bangkok)

---

## Seed issues for Cursor (create in infra repo)

### Audio Processing Integration
1. **API Integration**: Add Python API calls to Cloudflare Workers pipeline
2. **Workflow Updates**: Modify daily workflow to use Python API for audio processing
3. **Error Handling**: Implement robust error handling between Workers and Python API
4. **Data Flow**: Ensure proper data flow from Workers → Python API → R2 → Workers
5. **Testing**: End-to-end testing of integrated pipeline

### Manifest & Schema Updates
6. **Schema**: Add `/schema/manifest.schema.json` + AJV validator + CI step
7. **R2 Helpers**: `putManifest/getManifest/listDay` + `putTranscript` (redacted) + audio/video storage
8. **Renderer**: manifest → Markdown (front‑matter + sections)
9. **PR Builder**: create/update branch `auto/daily-recap-YYYY-MM-DD`, open PR to `staging`, add labels
10. **Judge Check**: run rubric (Gemma‑instruct), create GitHub Check Run, gate on thresholds
11. **Vectorize Upserts**: embed + upsert `clip|section|post` metadata
12. **Discord Notify**: post embed to `DISCORD_REVIEW_CHANNEL_ID`; retry & error surfacing
13. **Dry‑run & Fixtures**: local e2e without external APIs
14. **SEO Validator**: title/meta/canonical rules; warn in PR if out of bounds
15. **PII Redactor**: regex + tests; enforce pre‑R2 and pre‑embeddings
