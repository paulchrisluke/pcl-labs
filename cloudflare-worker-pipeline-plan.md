# Daily Clips → Blog (Cloudflare Workers AI + Workflows + GitHub + Discord)

**Goal:** Turn daily Twitch clips into an MDX recap PR for review, with semantic search, an LLM judge gate, and Discord notifications. Runs on **Cloudflare Workers + Workflows** with **Workers AI** models. No servers.

> This file is the project brief/spec you can paste into a repo for Cursor. It lays out architecture, env, links, and build steps. It's code-light and implementation-ready.

---

## High-level flow

1. **Cron (daily, Asia/Bangkok)** kicks a Workflow run.
2. **Fetch clips** from the last 24h for the broadcaster.
3. **Transcribe** each (Workers AI → Whisper). If a clip is unusually long, chunk it.
4. **Score/select** the best 5–12 moments (dev-stream tuned rules).
5. **Draft**: intro + one section per clip (title, bullets, paragraph, embed, optional VOD timestamp).
6. **Embed & index**: create embeddings, upsert to Vectorize for semantic search.
7. **Author MDX** (front‑matter + sections), open a **GitHub PR** in the content repo.
8. **Judge**: second LLM scores the draft (coherence, correctness, dev-signal, flow, length, safety). Publishes a **GitHub Check**.
9. **Notify**: send **Discord** message with PR link + judge score.
10. **(Optional) Auto-post** after manual merge/build.

```
[ Cron ] -> [ Workflows Orchestrator ]
   |-> [Twitch Clips] -> [Whisper ASR] -> [Rank/Select] -> [LLM Draft]
   |-> [Embeddings] -> [Vectorize]
   |-> [MDX file] -> [GitHub PR + Check]
   |-> [Discord webhook notify]
   |-> [R2: transcripts/assets]
```

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
* **Content repo** (your site): MDX posts live here. Example: `content/blog/development/YYYY-MM-DD-daily-dev-recap.mdx`

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
  * `CONTENT_REPO_STAGING_BRANCH=staging` *(PRs will target staging by default; you can change this knob)*
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

**Trigger:** Cron daily at `09:00 Asia/Bangkok`.

**Steps:**

1. **List Clips** (Twitch Helix `GET /helix/clips?broadcaster_id=...&started_at=...&ended_at=...`)
   * Keep: `id`, `title`, `url`, `duration`, `created_at`, `view_count`, `broadcaster_id`.
   * Paginate using `pagination.cursor` until exhaustion; respect Helix rate limits and add retries with jitter.
   * Use UTC for `started_at`/`ended_at` boundaries; widen by ±2m to avoid edge losses.
   * De-dupe by near-time window + similar titles.
2. **Transcribe** each clip with Whisper
   * If `duration > 90s`, chunk (Cloudflare tutorial pattern). Save transcript JSON to R2.
3. **Score & select** (dev-stream rules)

   * Boost: "tests pass/green", commit/merge language, issue/PR refs, "fixed/finally/works", "rebase resolved", endpoint 200/log success.
   * Optional visual cues/OCR: "Build succeeded", test counts. (Can be later).
   * Enforce variety & per-hour cap. Keep top 5–12.
4. **Draft** post

   * Compose: front‑matter (title/date/tags/clip\_count/repos), intro, then per‑clip section: H2 title, 2–3 bullets, 3–5 sentence paragraph, Twitch clip embed, optional VOD `?t=` link.
   * Also emit social blurbs (X/Bluesky/Threads/Mastodon/LinkedIn) with canonical blog URL placeholder.
5. **Embeddings** → Vectorize

   * Upsert embeddings for each **clip transcript** and each **section** (store references to VOD/clip IDs).
6. **Create PR** in content repo

   * Branch: `auto/daily-recap-YYYY-MM-DD`
   * Path: `content/blog/development/YYYY-MM-DD-daily-dev-recap.mdx`
   * URL: Will be accessible at `/blog/development/YYYY-MM-DD-daily-dev-recap`
   * PR body: include clips table + scores + Judge summary placeholder.
7. **Judge** (LLM check)

   * Run rubric (below). Create a **GitHub Check Run** on the PR head SHA with JSON payload & pass/fail.
   * Label PR: `needs-review` or `needs-polish` if below threshold.
8. **Discord notify**

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

**Transcript** (R2 object)

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

**Section** (for MDX)

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

* **Primary**: MDX site (content repo PR). After merge, your site host deploys.
* **Social blurbs** (optional now, add later): X/Bluesky/Threads/Mastodon/LinkedIn with a teaser + blog link.

---

## Twitch specifics

* Enable Clips on channel; your extension/mods create short clips daily.
* **API**: `Get Clips` for the last 24h window. Optionally use **Stream Markers** during live to enrich context/timestamps.
* We avoid full‑VOD pulling in this phase; link to VOD with `?t=` when a clip provides a reliable offset.

---

## Implementation milestones (suggested)

**M0 — Skeleton (Day 0)**

* Scaffold from **Workflows starter**.
* Add Cron trigger @ 09:00 ICT.
* Stub steps and environment bindings.

**M1 — Clips → Transcripts**

* OAuth client creds for Twitch; fetch last‑24h clips.
* Call Workers AI Whisper; store transcripts in R2. Handle chunking for >90s.

**M2 — Rank & Draft**

* Implement scoring (keywords + basic heuristics); select 5–12.
* Draft intro + sections; emit MDX string.

**M3 — PR & Discord**

* GitHub App: create branch, add MDX, open PR; post a **Check Run** placeholder.
* Discord webhook: send PR URL + summary.

**M4 — Judge**

* LLM judge with rubric; update Check Run with pass/fail and details.
* Label PR accordingly.

**M5 — Vectorize**

* Generate embeddings for transcripts + sections; upsert to Vectorize.
* Add simple search endpoint (optional).

**M6 — Polish**

* Add social blurbs generation (store in PR body).
* Add repo/PR links auto-detection from transcript (optional OCR/regex on terminal text).

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
* Judge must reject sections that include secrets/PII; add a safety axis in rubric.

---

## Local dev & testing

* Use **Miniflare** to trigger `scheduled()` locally and simulate the daily run.
* Add a dry‑run flag that creates a PR draft and posts Discord to a test channel.
* Include a fixture of 3–5 known clips/transcripts for deterministic tests.

---

## Open questions (fill in before build)

* Provide the **Discord review channel ID** once created so postings can start.
* Confirm the desired **PR target branch** (defaulting to `staging` per env) and that MDX lives at `content/blog/development/`.
* (Optional) Any additional repos to track for PR links (besides `pcl-labs`).
* **Blog structure confirmed**: 
  - Route: `pages/blog/[...slug].vue` (catch-all for nested paths)
  - Content: `content/blog/development/YYYY-MM-DD-daily-dev-recap.mdx`
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

* A daily Workflow run opens a PR with an MDX recap containing: intro + 5–12 sections (each embedding a clip), plus a Judge Check Run that passes. A Discord message posts the PR link for review.

> After merge, your site deploys the post. Social cross‑posting can be added as a follow‑up wave.

---

## Blog Integration with Existing Structure

### Content Path & Naming Convention
* **Generated posts**: `content/blog/development/YYYY-MM-DD-daily-dev-recap.mdx`
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
1. **Generate**: Create MDX file with proper front-matter matching existing structure
2. **PR**: Open pull request to `staging` branch
3. **Review**: Manual review + AI judge scoring
4. **Merge**: After approval, merge to staging
5. **Deploy**: Vercel automatically builds and deploys the new post
6. **Index**: Post appears in blog listing and search results

### Route Implementation Details
* **File**: `pages/blog/[...slug].vue` - Catch-all route for nested blog paths
* **Path handling**: `const contentPath = route.path.replace(/^\//, '')` removes leading slash
* **Content query**: `queryContent(contentPath).findOne()` fetches the correct content
* **404 handling**: Proper error handling for missing posts with `createError({ statusCode: 404 })`
* **SEO**: Comprehensive Open Graph and Twitter meta tags with fallbacks
