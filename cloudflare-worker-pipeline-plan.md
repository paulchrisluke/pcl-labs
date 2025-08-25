# Daily Clips → Blog (Cloudflare Workers AI + Workflows + GitHub + Discord)

**Goal:** Turn daily Twitch clips into a Markdown recap PR for review, with semantic search, an LLM judge gate, and Discord notifications. Runs on **Cloudflare Workers + Workflows** with **Workers AI** models. No servers.

> This file is the project brief/spec you can paste into a repo for Cursor. It lays out architecture, env, links, and build steps. It's code-light and implementation-ready.

---

## Current Implementation Status ✅

**COMPLETED:**
- ✅ **M0 — Skeleton**: Scaffolded from Workflows starter with Cron triggers
- ✅ **M1 — Clips → Transcripts**: Twitch OAuth, clip fetching, Workers AI Whisper integration
- ✅ **M2 — Rank & Draft**: Scoring system, clip selection, blog post generation
- ✅ **M3 — PR & Discord**: GitHub App integration, PR creation, Discord notifications
- ✅ **M4 — Judge**: LLM judge with rubric, Check Run integration
- ✅ **M5 — Vectorize**: Embeddings generation and Vectorize integration
- ✅ **M6 — Polish**: Social blurbs, repo/PR link detection

**CURRENT STATE:**
- ✅ **Production Worker**: Deployed at `https://clip-recap-pipeline.paulchrisluke.workers.dev`
- ✅ **Cron Triggers**: Daily pipeline (02:00 UTC) + hourly token validation
- ✅ **Service Integration**: Twitch, GitHub, Discord, Workers AI, Vectorize, R2 all configured
- ✅ **Health Checks**: `/health`, `/validate-twitch`, `/validate-github` endpoints working
- ✅ **Test Suite**: GitHub and Twitch credential validation tests passing
- ✅ **Core Pipeline**: Complete daily workflow from clips → transcripts → scoring → blog → PR → judge → Discord

**NEXT MILESTONE: M7 — Schema & Manifest Architecture**

---

## High-level flow

1. **Cron (daily, 09:00 Asia/Bangkok = 02:00 UTC)** kicks a Workflow run.
2. **Fetch clips** from the last 24h for the broadcaster.
3. **Transcribe** each (Workers AI → Whisper). If a clip is unusually long, chunk it.
4. **Score/select** the best 5–12 moments (dev-stream tuned rules).
5. **Draft**: intro + one section per clip (title, bullets, paragraph, embed, optional VOD timestamp).
6. **Embed & index**: create embeddings, upsert to Vectorize for semantic search.
7. **Author Markdown** (front‑matter + sections), open a **GitHub PR** in the content repo.
8. **Judge**: second LLM scores the draft (coherence, correctness, dev-signal, flow, length, safety). Publishes a **GitHub Check**.
9. **Notify**: send **Discord** message with PR link + judge score.
10. **(Optional) Auto-post** after manual merge/build.

```
[ Cron ] -> [ Workflows Orchestrator ]
   |-> [Twitch Clips] -> [Whisper ASR] -> [Rank/Select] -> [LLM Draft]
   |-> [Embeddings] -> [Vectorize]
   |-> [Markdown file] -> [GitHub PR + Check]
   |-> [Discord webhook notify]
   |-> [R2: transcripts/assets]
```

---

### M7 — Schema & Manifest Architecture (NEXT MILESTONE)

**Goal:** Define a robust data schema and R2 manifest structure to support automation, search, and content management.

#### Recommended Approach (TL;DR)

* **GitHub Markdown is the canonical post.**
* **R2 holds the "manifest + artifacts"** for each post-day (transcripts, scores, section metadata, run logs).
* **Vectorize** indexes the text (clips + sections + post) for semantic search.
* Everything shares a stable **`post_id`** (YYYY-MM-DD) and **`clip_id`**s.

#### R2 Layout (keys)

```
r2://recaps/
  manifests/YYYY/MM/POST_ID.json              # source-of-truth metadata for the day
  drafts/YYYY/MM/POST_ID.mdx                  # optional staging copy of the MDX
  transcripts/CLIP_ID.json                    # ASR output (segments)
  clips/CLIP_ID/meta.json                     # clip metadata from Twitch
  assets/POST_ID/cover.jpg                    # images/thumbnails
  runs/DATE/run-<timestamp>.json              # workflow logs/metrics
```

#### Manifest Schema (R2) — JSON (authoritative for automation)

Use this to drive PR creation, the judge check, Discord posts, and backfills.

```json
{
  "post_id": "2025-08-25",                // YYYY-MM-DD format
  "date_utc": "2025-08-25T02:00:00Z",
  "tz": "Asia/Bangkok",
  "title": "Daily Devlog — 2025-08-25",
  "headline": "Daily Devlog — 2025-08-25: Deadlock Fix Lands, Tests Green",
  "summary": "Deadlock fix lands; tests green; cart perf +12%.",
  "description": "Daily development recap from 2025-08-25 featuring 7 key moments including deadlock fix and test improvements.",
  "category": "development",              // matches content/blog/development/
  "articleSection": "development",        // Schema.org Article.articleSection
  "tags": ["Development", "Live Coding", "Twitch", "Daily Recap"],
  "keywords": "development, live coding, twitch, daily recap, deadlock, tests, PCL-Labs",
  "repos": ["paulchrisluke/pcl-labs"],
  "clip_ids": ["ProudRoundCaracal123","..."],
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
      "entities": ["CheckoutService","locks.py"]
    }
  ],
  "canonical_vod": "https://www.twitch.tv/videos/123456789",
  "mdx_path": "content/recaps/2025/08/2025-08-25.mdx",
  "target_branch": "staging",
  "status": "draft",                        // draft | pr_open | approved | merged | published
  "judge": {
    "overall": null,
    "per_axis": null,
    "version": "v1"
  },
  "social_blurbs": {
    "bluesky": "Deadlock slain. Tests green. +12% cart perf. Recap:",
    "threads": "Devlog: deadlock fix, tests pass, perf win →"
  }
}
```

#### MDX Front-matter (GitHub) — Minimal & LLM-Friendly

**Decision:** Generate JSON-LD at render time (Nuxt Content layout) rather than stuffing full Schema.org blocks into front-matter. Keep front-matter minimal and LLM-friendly.

```yaml
---
# Core content fields
post_id: "2025-08-25"                   # stable reference for search/links
title: "Daily Devlog — 2025-08-25: Deadlock Fix Lands, Tests Green"
date: "2025-08-25T02:00:00Z"            # UTC ISO8601
timezone: "Asia/Bangkok"
summary: "Daily development recap from 2025-08-25 featuring 7 key moments including deadlock fix and test improvements."
tags: ["Development", "Live Coding", "Twitch", "Daily Recap"]
repos: ["paulchrisluke/pcl-labs"]
clip_count: 7
canonical_vod: "https://www.twitch.tv/videos/123456789"
entities: ["CheckoutService", "locks.py", "deadlock", "tests"]

# SEO and routing
canonical: "https://paulchrisluke.com/blog/development/2025-08-25-daily-dev-recap"
og_image: "https://res.cloudinary.com/pcl-labs/image/upload/v[timestamp]/PCL-Labs/daily-recap-2025-08-25.webp"
source_manifest: "r2://recaps/manifests/2025/08/2025-08-25.json"

# Status
draft: false                             # or status: "review" | "published"
---
```
```

#### Vectorize Indexing (semantic search)

Index three granularities:

1. **clip** — text = clip transcript; `meta = {clip_id, date, repo, vod_id, url}`
2. **section** — text = section title + bullets + paragraph; `meta = {post_id, section_id, clip_id, pr_links[], repo}`
3. **post** — text = intro + section summaries; `meta = {post_id, date, tags[], repos[]}`

#### Schema.org Validation Requirements

**Required Schema.org Article properties:**
- `@type`: "Article"
- `@context`: "https://schema.org"
- `headline`: Article title (max 110 chars for Google)
- `name`: Same as headline
- `description`: Meta description (150-160 chars)
- `datePublished`: ISO 8601 date
- `dateModified`: ISO 8601 date
- `author`: Person object with name and url
- `publisher`: Organization object with name, url, and logo

**Required Schema.org VideoObject properties (for Twitch clips):**
- `@type`: "VideoObject"
- `name`: Video title
- `description`: Video description
- `uploadDate`: ISO 8601 date
- `duration`: ISO 8601 duration (PT4H30M)
- `contentUrl`: Direct video URL
- `embedUrl`: Embeddable URL
- `thumbnailUrl`: Video thumbnail

**SEO Validation Rules:**
- Title length: 50-60 characters
- Meta description: 150-160 characters
- Keywords: Include primary and secondary terms
- Canonical URL: Must be absolute
- Open Graph: Complete og:title, og:description, og:image
- Twitter Card: Complete twitter:card, twitter:title, twitter:description

#### Implementation Tasks for M7

1. **Define JSON Schema** for manifest validation
2. **Update R2 bucket structure** with `recaps/` prefix
3. **Modify pipeline** to write manifest before PR creation
4. **Update PR generation** to render MDX from manifest with Schema.org compliance
5. **Add validation** for unique `post_id` and manifest integrity
6. **Add Schema.org validation** to ensure all required properties are present
7. **Update Vectorize indexing** with new metadata structure
8. **Create validation tests** for Schema.org compliance and SEO requirements

---

## 🏗️ **Proper Implementation Order (CRITICAL)**

**Before generating any PRs, we need to build the foundation:**

### **Phase 1: Schema & Database Foundation** ⚠️ **DO THIS FIRST**
1. **Update TypeScript types** to match Schema.org Article/VideoObject
2. **Create JSON Schema validation** for manifest structure
3. **Update R2 bucket structure** with `recaps/` prefix and proper organization
4. **Build manifest storage/retrieval** functions with validation
5. **Create database migration** to ensure R2 structure is correct

### **Phase 2: Content Generation Engine** ⚠️ **BUILD BEFORE PRs**
1. **Update BlogPost interface** to include Schema.org fields
2. **Modify content generation** to create Schema.org compliant content
3. **Build manifest generation** from clips + transcripts
4. **Create MDX rendering** from manifest (not direct generation)
5. **Add validation pipeline** for Schema.org compliance

### **Phase 3: Testing & Validation** ⚠️ **VALIDATE BEFORE PRs**
1. **Create test fixtures** with sample clips/transcripts
2. **Build validation tests** for manifest schema
3. **Test MDX generation** with Schema.org compliance
4. **Validate SEO requirements** (title length, meta descriptions, etc.)
5. **Test R2 storage/retrieval** with proper error handling

### **Phase 4: PR Generation** ✅ **ONLY AFTER FOUNDATION**
1. **Update PR creation** to use manifest-driven approach
2. **Add Schema.org validation** to PR checks
3. **Test end-to-end pipeline** with validation
4. **Deploy and monitor** first few PRs

### **Phase 5: Production & Monitoring** 🚀 **FINAL PHASE**
1. **Enable daily pipeline** with validation
2. **Monitor validation failures** and adjust
3. **Optimize based on real data**

---

**Current Risk Assessment:**
- ❌ **Types don't match Schema.org** - Need to update `BlogPost` interface
- ❌ **No manifest validation** - PRs could fail Schema.org compliance
- ❌ **Direct MDX generation** - Should be manifest-driven
- ❌ **No test fixtures** - Can't validate before production
- ❌ **R2 structure undefined** - Storage could be inconsistent

---

## 📋 **Implementation Decisions & Questions for Cursor**

### **Content & Repo** ✅ **DECISIONS LOCKED**

1. **Final path/format:** `content/blog/development/YYYY-MM-DD-daily-dev-recap.md` (Markdown, not MDX)
2. **Slug builder:** `/blog/development/YYYY-MM-DD-daily-dev-recap` (date + `daily-dev-recap`)
3. **Branch target:** PRs open against `staging` → merge to `main`
4. **Front-matter fields (minimal):** `post_id, title, date (UTC), timezone, summary, tags[], repos[], clip_count, canonical_vod, canonical, entities[], og_image, source_manifest, draft(false)|status('review'|'published')`

### **R2 Manifest & Storage** ✅ **DECISIONS LOCKED**

5. **Manifest keyspace:** `recaps/manifests/YYYY/MM/POST_ID.json`
6. **Transcript storage:** **Redacted only** under `recaps/transcripts/CLIP_ID.json`
7. **Assets:** Cloudinary URLs in front-matter; **store thumbnails in R2** under `recaps/assets/POST_ID/...`
8. **JSON Schema:** Use manifest schema defined above; create `/schema/manifest.schema.json` and validator

### **Scoring & Selection** ✅ **DECISIONS LOCKED**

9. **Daily clip budget:** Default **6–12** clips per day
10. **Weights:** Keep current (tests pass +5, feat/fix/revert +4, build flip +3, merge resolved +3, entities +2, excitement +2, novelty +1, idle −2)

### **Judge Gate** ✅ **DECISIONS LOCKED**

11. **Thresholds:** Approve at **overall ≥ 80** and all axes ≥ 60
12. **Fail handling:** Label `needs-polish`, post weak axes to PR comment

### **Discord** ✅ **DECISIONS LOCKED**

13. **Channel-only:** `DISCORD_REVIEW_CHANNEL_ID` will be provided; bot perms = send/embed/attach/read history

### **Vectorize** ✅ **DECISIONS LOCKED**

14. **Namespaces & dims:** Single index with `type` in metadata (`clip`, `section`, `post`)
15. **Embeddings model:** Workers AI BGE variant (confirm dimension for index creation)

### **Idempotency & Ops** ✅ **DECISIONS LOCKED**

16. **Re-runs:** If day re-runs, append new `runs/<ts>.json` and keep latest pointer in manifest
17. **PR collisions:** If PR exists for `post_id`, update branch/commit instead of opening new one
18. **Retries:** Proceed if Twitch/GitHub hiccup and annotate PR with "partial day"

### **Security** ✅ **DECISIONS LOCKED**

19. **PII redaction:** Block API keys, JWTs, emails, IPs (public), DSNs, SSH keys, `KEY=VALUE` envs. Implement redaction **before** writing to R2 and **before** embeddings.

---

## 🎯 **M7 "Definition of Done" (Cursor's Checklist)**

* ✅ **Manifest JSON Schema** committed and validated in CI
* ✅ **R2 layout** created and helper functions implemented (put/get manifest, put transcripts, list day)
* ✅ **Front-matter generator** maps manifest → Markdown front-matter (minimal set above)
* ✅ **Renderer** builds Markdown body from manifest sections
* ✅ **PR builder** uses manifest + renderer; targets `staging`; idempotent if PR exists
* ✅ **Judge check** runs post-PR and updates GitHub Checks; labels `needs-review` / `needs-polish`
* ✅ **Discord notifier** posts to `DISCORD_REVIEW_CHANNEL_ID`
* ✅ **Vectorize upserts** for `clip`, `section`, `post` with agreed metadata
* ✅ **Dry-run** mode and fixtures for local tests (Twitch/GitHub off)
* ✅ **Cron** remains at `02:00 UTC` (09:00 Bangkok)

**Next Immediate Steps:**
1. Update `src/types/index.ts` with Schema.org compliant interfaces
2. Create JSON Schema for manifest validation
3. Build test fixtures with sample data
4. Update content generation to use manifest approach

---

## M7 — Schema & Manifest Architecture (NEXT MILESTONE)

**Goal:** Define a robust data schema and R2 manifest structure to support automation, search, and content management.

### Recommended Approach (TL;DR)

* **GitHub MDX is the canonical post.**
* **R2 holds the "manifest + artifacts"** for each post-day (transcripts, scores, section metadata, run logs).
* **Vectorize** indexes the text (clips + sections + post) for semantic search.
* Everything shares a stable **`post_id`** (YYYY-MM-DD) and **`clip_id`**s.

### R2 Layout (keys)

```
r2://recaps/
  manifests/YYYY/MM/POST_ID.json              # source-of-truth metadata for the day
  drafts/YYYY/MM/POST_ID.mdx                  # optional staging copy of the MDX
  transcripts/CLIP_ID.json                    # ASR output (segments)
  clips/CLIP_ID/meta.json                     # clip metadata from Twitch
  assets/POST_ID/cover.jpg                    # images/thumbnails
  runs/DATE/run-<timestamp>.json              # workflow logs/metrics
```

### Manifest Schema (R2) — JSON (authoritative for automation)

Use this to drive PR creation, the judge check, Discord posts, and backfills.

```json
{
  "post_id": "2025-08-25",                // YYYY-MM-DD format
  "date_utc": "2025-08-25T02:00:00Z",
  "tz": "Asia/Bangkok",
  "title": "Daily Devlog — 2025-08-25",
  "summary": "Deadlock fix lands; tests green; cart perf +12%.",
  "tags": ["devlog","twitch","recap"],
  "repos": ["paulchrisluke/pcl-labs"],
  "clip_ids": ["ProudRoundCaracal123","..."],
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
      "entities": ["CheckoutService","locks.py"]
    }
  ],
  "canonical_vod": "https://www.twitch.tv/videos/123456789",
  "mdx_path": "content/recaps/2025/08/2025-08-25.mdx",
  "target_branch": "staging",
  "status": "draft",                        // draft | pr_open | approved | merged | published
  "judge": {
    "overall": null,
    "per_axis": null,
    "version": "v1"
  },
  "social_blurbs": {
    "bluesky": "Deadlock slain. Tests green. +12% cart perf. Recap:",
    "threads": "Devlog: deadlock fix, tests pass, perf win →"
  }
}
```

### MDX Front-matter (GitHub) — LLM-friendly

Front-matter should be concise, stable, and easy to parse. Put the heavy stuff in the manifest JSON.

```yaml
---
post_id: "2025-08-25"
title: "Daily Devlog — 2025-08-25"
date: "2025-08-25T02:00:00Z"            # UTC ISO8601
timezone: "Asia/Bangkok"
summary: "Deadlock fix lands; tests green; cart perf +12%."
tags: ["devlog","twitch","recap"]
repos: ["paulchrisluke/pcl-labs"]
clip_count: 7
canonical_vod: "https://www.twitch.tv/videos/123456789"
entities: ["CheckoutService","locks.py","deadlock","tests"]
canonical_id: "post:2025-08-25"         # stable reference for search/links
status: "review"                         # review | published
og_image: "/images/recaps/2025-08-25/cover.jpg"
source_manifest: "r2://recaps/manifests/2025/08/2025-08-25.json"
---
```

### Vectorize Indexing (semantic search)

Index three granularities:

1. **clip** — text = clip transcript; `meta = {clip_id, date, repo, vod_id, url}`
2. **section** — text = section title + bullets + paragraph; `meta = {post_id, section_id, clip_id, pr_links[], repo}`
3. **post** — text = intro + section summaries; `meta = {post_id, date, tags[], repos[]}`

### Implementation Tasks for M7

1. **Define JSON Schema** for manifest validation
2. **Update R2 bucket structure** with `recaps/` prefix
3. **Modify pipeline** to write manifest before PR creation
4. **Update PR generation** to render MDX from manifest
5. **Add validation** for unique `post_id` and manifest integrity
6. **Update Vectorize indexing** with new metadata structure

---

## Starter repos & official docs

* **Cloudflare Workflows starter** (recommended base):

  * [https://github.com/cloudflare/workflows-starter](https://github.com/cloudflare/workflows-starter)
  * Workflows docs: [https://developers.cloudflare.com/workflows/](https://developers.cloudflare.com/workflows/)
  * CLI quick start: [https://developers.cloudflare.com/workflows/get-started/cli-quick-start/](https://developers.cloudflare.com/workflows/get-started/cli-quick-start/)
* **Workers templates collection**: [https://github.com/cloudflare/templates](https://github.com/cloudflare/templates)
* **Workers AI** (overview & models):

  * Overview: [https://developers.cloudflare.com/workers-ai/](https://developers.cloudflare.com/workers-ai/)
  * Model catalog: [https://developers.cloudflare.com/workers-ai/models/](https://developers.cloudflare.com/workers-ai/models/)
  * Whisper large‑v3‑turbo (ASR): [https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/)
  * ASR chunking tutorial: [https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-workers-ai-whisper-with-chunking/](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-workers-ai-whisper-with-chunking/)
  * Pricing: [https://developers.cloudflare.com/workers-ai/platform/pricing/](https://developers.cloudflare.com/workers-ai/platform/pricing/)
* **AI Gateway**: [https://developers.cloudflare.com/ai-gateway/](https://developers.cloudflare.com/ai-gateway/)
* **Vectorize** (vector DB): [https://developers.cloudflare.com/vectorize/](https://developers.cloudflare.com/vectorize/)
* **R2** (object storage): [https://developers.cloudflare.com/r2/](https://developers.cloudflare.com/r2/)
* **Cron Triggers**: [https://developers.cloudflare.com/workers/configuration/cron-triggers/](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
* **Miniflare scheduled testing**: [https://developers.cloudflare.com/workers/testing/miniflare/core/scheduled/](https://developers.cloudflare.com/workers/testing/miniflare/core/scheduled/)
* **Twitch Helix API** (Clips/Markers/Videos/Scopes):

  * Get Clips: [https://dev.twitch.tv/docs/api/clips](https://dev.twitch.tv/docs/api/clips)
  * Markers (create/get): [https://dev.twitch.tv/docs/api/markers/](https://dev.twitch.tv/docs/api/markers/)
  * Videos: [https://dev.twitch.tv/docs/api/videos](https://dev.twitch.tv/docs/api/videos)
  * Scopes: [https://dev.twitch.tv/docs/authentication/scopes/](https://dev.twitch.tv/docs/authentication/scopes/)
* **GitHub** (PR, Contents, Checks, App auth):

  * Create/Update file contents: [https://docs.github.com/en/rest/repos/contents](https://docs.github.com/en/rest/repos/contents)
  * Create PR: [https://docs.github.com/en/rest/pulls](https://docs.github.com/en/rest/pulls)
  * Checks API (check runs): [https://docs.github.com/rest/checks/runs](https://docs.github.com/rest/checks/runs)
  * GitHub App auth (JWT/installation token): [https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app)
* **Discord webhooks**: [https://discord.com/developers/docs/resources/webhook](https://discord.com/developers/docs/resources/webhook)

---

## Repos & roles

* **Infra repo** (Workers/Workflows/Bindings): `clip-recap-pipeline`
* **Content repo** (your site): Markdown posts live here. Example: `content/blog/development/YYYY-MM-DD-daily-dev-recap.md`

> CI: After you merge the PR, your site host (Pages/Vercel/Netlify) builds and deploys.

---

## Environment & bindings

### Cloudflare account

* **Workers + Workflows** enabled
* **Workers AI** binding
* **Vectorize** index created
* **R2** bucket created (optional but recommended)
* **AI Gateway** (optional but recommended)

### Secrets (Wrangler vars)

* `CF_ACCOUNT_ID`, `CF_API_TOKEN`
* `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
* `TWITCH_BROADCASTER_ID` (numeric)
* `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_PRIVATE_KEY` (PEM)
* `CONTENT_REPO_OWNER=paulchrisluke`, `CONTENT_REPO_NAME=pcl-labs`
* **Branches**:

  * `CONTENT_REPO_MAIN_BRANCH=main`

* **Discord (existing bot, channel delivery)**

  * `DISCORD_APPLICATION_ID=1399565650044649492`
  * `DISCORD_BOT_TOKEN`
  * `DISCORD_REVIEW_CHANNEL_ID` (numeric; required for posting)
  * `DELIVERY_MODE=channel`
* **If using Gemini via AI Gateway (optional — you chose Workers AI Gemma for now):** `GOOGLE_AI_STUDIO_API_KEY`, `AI_GATEWAY_ID`
* **Optional**: `AI_GATEWAY_URL`

### Bindings (wrangler.toml)

* `ai` — Workers AI
* `VECTORIZE` — Vectorize index binding
* `R2_BUCKET` — R2 bucket for transcripts/assets
* `WORKFLOW` — Workflows binding (or REST invocations)
* `ENV` — JSON string for feature flags (e.g., judge thresholds)

---

## Model choices (Workers AI)

* **ASR**: `@cf/openai/whisper-large-v3-turbo` (high accuracy, low cost per minute).
* **Drafting LLM**: **Gemma (Workers AI catalog)** — use the latest *Instruct* variant available in the catalog link below.
* **Embeddings**: a Workers‑supported text‑embedding model (e.g., BGE family) for Vectorize.
* **Judge LLM**: **Gemma (Workers AI)**, smaller/faster instruct variant for scoring.

> Model catalog (Gemma search): [https://developers.cloudflare.com/workers-ai/models/?search=gem](https://developers.cloudflare.com/workers-ai/models/?search=gem)

---

## Daily Workflow (orchestration spec)

**Trigger:** Cron daily at `0 2 * * *` (02:00 UTC, equivalent to 09:00 Asia/Bangkok). Cloudflare schedules are UTC.

**Steps:**

1. **List Clips** (Twitch Helix `GET /helix/clips?broadcaster_id=...&started_at=...&ended_at=...`)
   * Keep: `id`, `title`, `url`, `duration`, `created_at`, `view_count`, `broadcaster_id`.
   * Paginate using `pagination.cursor` until exhaustion; respect Helix rate limits and add retries with jitter.
   * Use UTC for `started_at`/`ended_at` boundaries with half-open interval `[started_at, ended_at)` to avoid double-counting across reruns; widen by ±2m to avoid edge losses.
   * De-dupe by near-time window + similar titles.
2. **Transcribe** each clip with Whisper
   * If `duration > 90s`, chunk (Cloudflare tutorial pattern).
3. **Redact PII** from transcripts
   * Apply PII redaction patterns before persisting to R2 (do not store raw transcripts).
   * Redact: API keys/tokens, email addresses, IP addresses, database connection strings, JWT tokens, SSH keys, environment variable values.
4. **Score & select** (dev-stream rules)

   * Boost: "tests pass/green", commit/merge language, issue/PR refs, "fixed/finally/works", "rebase resolved", endpoint 200/log success.
   * Optional visual cues/OCR: "Build succeeded", test counts. (Can be later).
   * Enforce variety & per-hour cap. Keep top 5–12.
4. **Store redacted transcripts** to R2
   * Save redacted transcript JSON to R2 after PII redaction is complete.
5. **Draft** post

   * Compose: front‑matter (title/date/tags/clip\_count/repos), intro, then per‑clip section: H2 title, 2–3 bullets, 3–5 sentence paragraph, Twitch clip embed, optional VOD `?t=` link.
   * Also emit social blurbs (X/Bluesky/Threads/Mastodon/LinkedIn) with canonical blog URL placeholder.
6. **Embeddings** → Vectorize

   * Upsert embeddings for each **redacted clip transcript** and each **section** (store references to VOD/clip IDs).
7. **Create PR** in content repo

   * Branch: `auto/daily-recap-YYYY-MM-DD`
   * Path: `content/blog/development/YYYY-MM-DD-daily-dev-recap.md`
   * URL: `/blog/development/YYYY-MM-DD-daily-dev-recap`
   * Note: Recaps are time-series content and intentionally include dates in the slug (exception to the "avoid dates in URLs" rule).
   * PR body: include clips table + scores + Judge summary placeholder.
8. **Judge** (LLM check)

   * Run rubric (below). Create a **GitHub Check Run** on the PR head SHA with JSON payload & pass/fail.
   * Label PR: `needs-review` or `needs-polish` if below threshold.
9. **Discord notify**

   * Send an embed: title, PR URL, judge score, top clip, clip count. Ping the right role.

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

**Transcript** (R2 object - redacted)

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
  "bullets": ["Root cause: await in hot path","Reworked lock ordering","All tests green"],
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
  "per_axis": {
    "coherence": 18,
    "correctness": 22,
    "dev_signal": 17,
    "narrative_flow": 14,
    "length": 8,
    "safety": 7
  },
  "per_axis_percentages": {
    "coherence": 90.0,
    "correctness": 88.0,
    "dev_signal": 85.0,
    "narrative_flow": 93.3,
    "length": 80.0,
    "safety": 70.0
  },
  "reasons": ["Tight summary, grounded in transcript"],
  "action": "approve"
}
```

---

## Judge rubric (approval gate)

* **Coherence (0–20):** Each section stands alone; no context gaps.
* **Technical correctness (0–25):** Matches transcript/clip; no hallucinated APIs or wrong test names.
* **Dev signal (0–20):** Clear milestone; includes files/modules/issues if available.
* **Narrative flow (0–15):** Setup → attempt → result → why it matters.
* **Length/clarity (0–10):** Precise; no fluff.
* **Safety/compliance (0–10):** No secrets/PII; safe content.

**Pass if:** overall ≥ **80** and no axis < **60**. Else label `needs-polish` and notify.

---

## Posting targets (first wave)

* **Primary**: Markdown site (content repo PR). After merge, your site host deploys.
* **Social blurbs** (optional now, add later): X/Bluesky/Threads/Mastodon/LinkedIn with a teaser + blog link.

---

## Twitch specifics

* Enable Clips on channel; your extension/mods create short clips daily.
* **API**: `Get Clips` for the last 24h window. Optionally use **Stream Markers** during live to enrich context/timestamps.
* We avoid full‑VOD pulling in this phase; link to VOD with `?t=` when a clip provides a reliable offset.

---

## Configuration knobs

* **CLIP\_BUDGET**: 5–12/day.
* **WINDOW**: 60–120s (for scoring windows).
* **SCORE\_WEIGHTS**: dev‑stream tuned (tests pass +5; commit/feat/fix +4; build flip +3; merge resolved +3; named entities +2; excitement +2; novelty +1; idle −2).
* **JUDGE\_THRESHOLD**: overall ≥ 80, axis ≥ 60.
* **EMBED\_MODEL**: BGE family (adjust dimension/index accordingly).

---

## Security & privacy

* Keep all secrets in Wrangler secrets.
* Run AI calls through **AI Gateway** for logging, rate limit, retries, fallbacks.
* Do not store raw audio in public; use R2 with tight access policies.
* **Redact PII before persisting to R2 (do not store raw transcripts)**.
* Judge must reject raw input that includes secrets/PII; add a safety axis in rubric.
* PII patterns to detect and redact:
  - API keys/tokens (regex patterns for common formats)
  - Email addresses
  - IP addresses (except localhost/private ranges)
  - Database connection strings
  - JWT tokens
  - SSH keys
  - Environment variable values (KEY=VALUE patterns)
---

## Local dev & testing

* Use **Miniflare** to trigger `scheduled()` locally and simulate the daily run.
* Add a dry‑run flag that creates a PR draft and posts Discord to a test channel.
* Include a fixture of 3–5 known clips/transcripts for deterministic tests.

---

## Open questions (fill in before build)

* Provide the **Discord review channel ID** once created so postings can start.
* Confirm that Markdown lives at `content/blog/development/`.
* (Optional) Any additional repos to track for PR links (besides `pcl-labs`).
* **Blog structure confirmed**: 
  - Route: `pages/blog/[...slug].vue` (catch-all for nested paths)
  - Content: `content/blog/development/YYYY-MM-DD-daily-dev-recap.md`
  - URL: `/blog/development/YYYY-MM-DD-daily-dev-recap`
  - Front-matter: Matches existing blog structure with all required fields

---

## Discord setup (existing bot → channel posts)

1. **Invite the bot to your server** (if not already):

   * OAuth2 URL format: `https://discord.com/oauth2/authorize?client_id=1399565650044649492&scope=bot%20applications.commands&permissions=274877975552`
   * Minimum permissions in the review channel: **View Channel**, **Send Messages**, **Embed Links**, **Attach Files**, **Read Message History**.
2. **Create the review channel** (e.g., `#recap-reviews`) and copy its **Channel ID** (Developer Mode → right‑click → *Copy ID*).
3. **Set env** in Wrangler: `DISCORD_BOT_TOKEN`, `DISCORD_REVIEW_CHANNEL_ID`, and `DELIVERY_MODE=channel`.

## Review + notification flow

* On PR open, create a **GitHub Check Run** (Judge score) and label `needs-review`/`needs-polish`.
* **Post to the review channel** using your bot and `DISCORD_REVIEW_CHANNEL_ID` with: PR URL, judge score, clip count, and top clip title.
* If channel posting fails (e.g., missing permission), queue a retry and surface an error summary in the PR as a comment.

## Done = when

* A daily Workflow run opens a PR with a Markdown recap containing: intro + 5–12 sections (each embedding a clip), plus a Judge Check Run that passes. A Discord message posts the PR link for review.

> After merge, your site deploys the post. Social cross‑posting can be added as a follow‑up wave.

---

## Blog Integration with Existing Structure

### Content Path & Naming Convention
* **Generated posts**: `content/blog/development/YYYY-MM-DD-daily-dev-recap.md`
* **Existing posts**: Organized by category (e.g., `content/blog/marketing/effective-ecommerce-conversion-strategies.md`)
* **Integration**: Generated posts will be in the development category alongside other categorized content

### Front-matter Compatibility
Generated posts must match the existing blog front-matter structure:

```yaml
---
title: "Daily Dev Recap: YYYY-MM-DD - [Top Achievement]"
category: "development"
tags: ['Development', 'Live Coding', 'Twitch', 'Daily Recap']
image: "https://res.cloudinary.com/pcl-labs/image/upload/v[timestamp]/PCL-Labs/daily-recap-[date].webp"
imageThumbnail: "https://res.cloudinary.com/pcl-labs/image/upload/v[timestamp]/PCL-Labs/daily-recap-thumbnail-[date].webp"
imageAlt: "Daily development recap from Twitch stream showing [key achievement]"
description: "Daily development recap from [date] featuring [number] key moments including [top achievement] and [other highlights]."
keywords: "development, live coding, twitch, daily recap, [specific tech], PCL-Labs"
date: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
canonical: "https://paulchrisluke.com/blog/development/YYYY-MM-DD-daily-dev-recap"
draft: false
cover: "https://res.cloudinary.com/pcl-labs/image/upload/v[timestamp]/PCL-Labs/daily-recap-[date].webp"
thumbnail: "https://res.cloudinary.com/pcl-labs/image/upload/v[timestamp]/PCL-Labs/daily-recap-thumbnail-[date].webp"
og:
  alt: "Daily development recap from Twitch stream showing [key achievement]"
schema:
  type: "BlogPosting"
---
```

### Blog Page Integration
* **Route structure**: `pages/blog/[...slug].vue` uses catch-all parameter to handle nested paths
* **URL patterns**: 
  - Generated posts: `/blog/development/YYYY-MM-DD-daily-dev-recap`
  - Existing posts: `/blog/[category]/[slug]` (e.g., `/blog/marketing/effective-ecommerce-conversion-strategies`)
* **Content handling**: Route automatically strips leading slash and queries content using `queryContent(contentPath)`
* **SEO**: Generated posts will inherit the same SEO optimization as existing posts with Open Graph and Twitter meta tags

### Content Organization
* **Existing posts**: Professional content (e-commerce, legal, marketing guides)
* **Generated posts**: Daily development recaps with Twitch clips
* **Coexistence**: Both types will be listed together in chronological order on the blog index
* **Categories**: 
  - `content/blog/development/` - Generated daily recaps
  - `content/blog/marketing/` - Marketing guides and strategies
  - `content/blog/ecommerce/` - E-commerce optimization content

### Image Generation
* **Requirement**: Generate Cloudinary URLs for `image`, `imageThumbnail`, and `imageAlt`
* **Format**: Follow existing pattern: `https://res.cloudinary.com/pcl-labs/image/upload/v[timestamp]/PCL-Labs/[filename].webp`
* **Content**: Screenshots or generated images representing the day's development highlights

### Tag Strategy
* **Consistent tags**: `['Development', 'Live Coding', 'Twitch', 'Daily Recap']` for all generated posts
* **Dynamic tags**: Add specific technology tags based on content (e.g., `['Nuxt', 'Vue', 'TypeScript']`)
* **SEO optimization**: Include relevant tech stack and development topics

### URL Structure
* **Generated**: `/blog/development/YYYY-MM-DD-daily-dev-recap` (clean, SEO-friendly)
* **Existing**: `/blog/[category]/[slug]` (e.g., `/blog/marketing/effective-ecommerce-conversion-strategies`)
* **Integration**: Both follow the same URL pattern and routing with category-based organization
* **Route handling**: Catch-all `[...slug].vue` route handles all nested paths automatically

### Content Quality Standards
* **Length**: 800-1500 words (matching existing blog standards)
* **Structure**: Intro + 5-12 sections with Twitch clip embeds
* **Tone**: Professional but conversational, matching existing blog voice
* **Technical accuracy**: Must be factually correct based on actual stream content

### Deployment Flow
1. **Generate**: Create Markdown file with proper front-matter matching existing structure
2. **PR**: Open pull request to `main` branch
3. **Review**: Manual review + AI judge scoring
4. **Merge**: After approval, merge to main
5. **Deploy**: Vercel automatically builds and deploys the new post
6. **Index**: Post appears in blog listing and search results

### Route Implementation Details
* **File**: `pages/blog/[...slug].vue` - Catch-all route for nested blog paths
* **Path handling**: `const contentPath = route.path.replace(/^\//, '')` removes leading slash
* **Content query**: `queryContent(contentPath).findOne()` fetches the correct content
* **404 handling**: Proper error handling for missing posts with `createError({ statusCode: 404 })`
* **SEO**: Comprehensive Open Graph and Twitter meta tags with fallbacks
