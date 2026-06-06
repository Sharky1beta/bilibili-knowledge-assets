# Knowledge Clip Studio

Knowledge Clip Studio is a 24-hour full-stack demo that turns a public Bilibili long-video URL into a reusable knowledge asset. The asset stores metadata, timestamped transcript segments, information-driven key frames, visual-only facts, structured knowledge items, and generated outputs.

The core proof is simple:

- Process a Bilibili video once.
- Reuse the saved asset to generate multiple outputs without reprocessing video.
- Combine several saved assets for cross-video synthesis with citations.

## Requirements

- Node.js 20+ recommended.
- npm.
- ffmpeg available on `PATH`.
- Public network access to Bilibili APIs:
  - `https://api.bilibili.com/x/web-interface/view`
  - `https://api.bilibili.com/x/player/playurl`
  - `https://api.bilibili.com/x/player/v2`
  - `https://comment.bilibili.com/{cid}.xml`
- Gemini API key for visual understanding, ASR, knowledge building, and high-quality output generation.

Create `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
```

Optional model overrides:

```bash
GEMINI_VISION_MODEL=gemini-2.5-flash
GEMINI_KNOWLEDGE_MODEL=gemini-2.5-flash
GEMINI_OUTPUT_MODEL=gemini-2.5-flash
```

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Validation commands:

```bash
npm run lint
npm run build
```

## Recommended Demo Assets

The local demo database may contain work-in-progress assets from debugging. For the final recording, prefer these stable assets:

1. `asset_3af991af-7b3d-450f-969f-6c80116132d1`
   - Title: `【乘风2026】唐艺昕 范玮琪 江语晨 孙怡 四公舞台《胆小鬼》`
   - BVID: `BV1C47y65E1R`
   - Status: `ready`
   - Evidence: 12 frames, 22 transcript segments, 10 knowledge items.

2. `asset_b05b1957-4c52-44be-a52b-419114819822`
   - Title: `字幕君交流场所`
   - BVID: `BV1xx411c7mD`
   - Status: `ready`
   - Evidence: 8 frames, 12 transcript segments, 8 knowledge items.

3. `asset_demo_visual`
   - Seed visual-only demo asset.
   - Useful as a stable third asset for multi-video synthesis.

Avoid selecting assets that are only `created`, `metadata_fetched`, or `frames_extracted` when recording the polished demo.

## Demo Route

### 1. Same Asset, Two Outputs

1. Open `/generate`.
2. Select `【乘风2026】...《胆小鬼》`.
3. Generate `Illustrated Summary`.
4. Switch to `Evidence Cards`.
5. Generate again with the same asset.
6. Point out the green reuse proof panel:
   - no video reprocessing,
   - stored metadata reused,
   - stored frames reused,
   - stored transcript segments reused,
   - stored knowledge items reused.

### 2. Multi-Asset Synthesis

1. Open `/generate`.
2. Select:
   - `【乘风2026】...《胆小鬼》`
   - `字幕君交流场所`
   - `Demo: visual-only facts in a technical video`
3. Choose `Multi-Video Synthesis`.
4. Use a focus prompt such as:

```text
Compare argument layer, visual-only evidence, and transcript evidence across videos.
```

5. Show:
   - source coverage,
   - layered evidence,
   - comparison matrix,
   - unique evidence per asset,
   - citations.

### 3. Reuse by Duplicate URL

1. Go to `/`.
2. Submit an already processed Bilibili URL, for example:

```text
https://www.bilibili.com/video/BV1C47y65E1R
```

3. The app redirects to the existing asset and shows:

```text
This Bilibili source already exists. Reusing the saved asset without reprocessing.
```

## Processing Pipeline

### 1. Asset Identity and Reuse

The app parses BV/av input and fetches Bilibili metadata. Before inserting a new asset, it checks existing rows by:

- parsed `bvid` or `aid`,
- then metadata identity: `bvid + cid` or `aid + cid`.

If the same source already exists, the app returns the existing `assetId` with `reused: true` and does not create a duplicate row.

### 2. Information-Driven Frame Selection

The system does not rely on fixed interval screenshots as the primary strategy.

Candidate frame sources:

- `scene_change`: ffmpeg scene detection with `select='gt(scene,0.32)',showinfo`.
- `danmaku_hotspot`: Bilibili danmaku heat peaks from 10-second buckets.
- `mixed_signal`: scene change and danmaku heat both point to the same moment.
- `coverage_fallback`: a small number of fallback points only when signals are sparse.

Danmaku heat is based on comment count plus high-signal words such as `高能`, `名场面`, `666`, and `破防`.

After candidates are extracted, Gemini vision scores each frame and returns:

- visual summary,
- visible text,
- visual type,
- information density,
- retention reason,
- visual-only facts.

The asset page shows candidate source, candidate signal reason, timestamp, frame image, visible text, information density, and visual-only facts.

### 3. Transcript / Subtitle / ASR Layer

Priority:

1. Fetch official Bilibili subtitles through `x/player/v2`.
2. If no official subtitles exist, extract full audio to `public/assets/{assetId}/audio-full.mp3`.
3. Run Gemini ASR from saved full audio in 60-second chunks.

Stored artifacts:

- `audio-full.mp3`
- `official-subtitles.json`
- `transcript-manifest.json`
- SQLite `segments` with `startSec`, `endSec`, `text`, and `summary`.

ASR is a demo-level fallback. For long videos it may be slow or costly, so the recommended order is official subtitles first, then ASR only when needed.

### 4. Knowledge Asset

The build step combines:

- metadata,
- visual frame analysis,
- transcript segments,
- source frame IDs,
- source segment IDs.

It writes reusable structured rows to `knowledge_items`, including:

- `fact`
- `claim`
- `visual_fact`
- `action_item`
- `term`
- `timeline`

Every knowledge item keeps source citations when available.

### 5. Output Generation

Output modes:

- `Illustrated Summary`
- `Evidence Cards`
- `Multi-Video Synthesis`

Generation uses stored memory only. It does not re-run Bilibili metadata fetch, playurl, ffmpeg frame extraction, audio extraction, ASR, or visual analysis.

The output preview displays a reuse proof panel with counts for:

- metadata,
- frames,
- transcript segments,
- knowledge items.

Multi-video synthesis uses lightweight structured retrieval rather than a vector database. For each selected asset it builds a compact retrieval pack:

- metadata,
- argument layer,
- visual layer,
- transcript layer.

The generated result includes:

- source coverage,
- common themes,
- argument / visual / transcript layered evidence,
- comparison matrix,
- unique evidence,
- open questions.

## Data Model

SQLite tables:

- `assets`: source identity, metadata, status, errors.
- `frames`: screenshots, timestamp, candidate source, candidate reason, visual analysis, visual-only facts.
- `segments`: timestamped subtitle or ASR transcript text.
- `knowledge_items`: reusable structured facts with frame/segment citations.
- `outputs`: saved generation results by mode, asset IDs, prompt, and content JSON.

Files under `public/assets/{assetId}`:

- frame screenshots,
- `audio-full.mp3`,
- ASR audio chunks,
- subtitle snapshots,
- transcript manifest.

## Failure Handling

- Missing Gemini API key:
  - visual analysis, ASR, and high-quality generation return clear errors or deterministic fallbacks.
  - Fix: add `GEMINI_API_KEY` to `.env.local` and restart `npm run dev`.

- Missing ffmpeg:
  - frame/audio extraction fails.
  - Fix: install ffmpeg and ensure it is on `PATH`.

- Bilibili playurl or stream failure:
  - asset keeps metadata and shows the error.
  - Possible causes: private video, region limit, expired stream URL, anti-hotlinking.

- No official subtitles:
  - use full audio + ASR fallback.

- ASR chunk failure:
  - failed chunks are written as placeholder segments instead of failing the whole asset.

- Gemini generation failure:
  - output falls back to deterministic rendering from saved frames, segments, and knowledge items.

## Current Scope and Tradeoffs

This is a 24-hour exam demo, so the implementation favors a complete explainable loop over production infrastructure.

Chosen:

- SQLite instead of managed Postgres/vector DB.
- Local file artifacts instead of cloud storage.
- Structured retrieval instead of production hybrid RAG.
- ffmpeg scene detection + danmaku heat + Gemini scoring instead of a full video understanding pipeline.
- Synchronous route handlers instead of a durable background job queue.

Known limitations:

- Long-running extraction/ASR requests are synchronous.
- Transcript replacement is overwrite-based; official subtitle and ASR versions are not versioned.
- No manual correction UI for frame facts or transcript segments.
- No ask-box UI yet; output modes demonstrate reuse/generation instead.
- No Docker setup in this version.

## Discarded Plans

1. Full vector database RAG.
   - Discarded because setup and tuning would distract from the required full-stack demo loop.

2. Downloading and storing full source video files.
   - Discarded to reduce storage, legal, and runtime cost. The app stores frames, full audio when needed, and structured evidence instead.

3. A full annotation workbench.
   - Discarded because manual editing/versioning is useful but not required to prove video asset reuse and visual evidence extraction.

## AI Collaboration Review

AI assistance was used to accelerate implementation, debugging, and design review. The most useful collaboration points were:

- translating the open-ended exam prompt into milestones,
- identifying gap areas against the rubric,
- debugging browser translation DOM errors,
- improving candidate frame selection beyond fixed intervals,
- designing the transcript/audio/ASR fallback path,
- strengthening multi-video synthesis into layered structured retrieval,
- writing delivery documentation and demo proof points.

Human decisions kept the scope constrained:

- no production auth,
- no vector DB,
- no Docker unless time remains,
- no new ask-box before README and demo proof are complete.

## One-Week Follow-Up Plan

If given one more week:

1. Move long-running extraction and ASR to a background job queue with progress polling and retry.
2. Add a correction UI for frames, transcript segments, and knowledge items.
3. Add hybrid search or vector retrieval over frames, transcript, and knowledge rows.
4. Add an ask/query interface over one or more assets.
5. Add seed/reset scripts and a clean demo database.
6. Add export to Markdown or DOCX for generated outputs.
7. Add better long-video chunking policy and ASR cost controls.

## Suggested Recording Checklist

- Show duplicate URL reuse.
- Show candidate frame source on an asset detail page.
- Show transcript/source media panel.
- Generate Illustrated Summary from one ready asset.
- Generate Evidence Cards from the same ready asset.
- Generate Multi-Video Synthesis from 2 real assets plus the seed asset.
- Show the reuse proof panel after each generation.
