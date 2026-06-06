import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import type { Asset, Frame, GeneratedOutput, KnowledgeItem, OutputMode, Segment } from "@/lib/types";

type AssetRow = {
  id: string;
  bvid: string | null;
  url: string;
  title: string;
  description: string | null;
  owner_name: string | null;
  duration: number | null;
  cover_url: string | null;
  status: Asset["status"];
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type SegmentRow = {
  id: string;
  asset_id: string;
  start_sec: number;
  end_sec: number;
  text: string;
  summary: string | null;
};

type FrameRow = {
  id: string;
  asset_id: string;
  timestamp_sec: number;
  image_path: string;
  summary: string;
  visible_text_json: string;
  visual_type: string;
  information_density: number;
  retention_reason: string;
  only_in_visual_json: string;
};

type KnowledgeRow = {
  id: string;
  asset_id: string;
  type: string;
  content: string;
  source_segment_ids_json: string;
  source_frame_ids_json: string;
};

type OutputRow = {
  id: string;
  mode: OutputMode;
  asset_ids_json: string;
  prompt: string;
  content_json: string;
  created_at: string;
};

export type AssetDetail = {
  asset: Asset;
  segments: Segment[];
  frames: Frame[];
  knowledgeItems: KnowledgeItem[];
};

export function listAssets(): Asset[] {
  const rows = getDb()
    .prepare("SELECT * FROM assets ORDER BY updated_at DESC")
    .all() as AssetRow[];

  return rows.map(mapAsset);
}

export function getAssetDetail(id: string): AssetDetail | null {
  const assetRow = getDb().prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!assetRow) {
    return null;
  }

  const segmentRows = getDb()
    .prepare("SELECT * FROM segments WHERE asset_id = ? ORDER BY start_sec ASC")
    .all(id) as SegmentRow[];
  const frameRows = getDb()
    .prepare("SELECT * FROM frames WHERE asset_id = ? ORDER BY timestamp_sec ASC")
    .all(id) as FrameRow[];
  const knowledgeRows = getDb()
    .prepare("SELECT * FROM knowledge_items WHERE asset_id = ? ORDER BY type ASC")
    .all(id) as KnowledgeRow[];

  return {
    asset: mapAsset(assetRow),
    segments: segmentRows.map(mapSegment),
    frames: frameRows.map(mapFrame),
    knowledgeItems: knowledgeRows.map(mapKnowledgeItem),
  };
}

export function createAsset(url: string): Asset {
  const now = new Date().toISOString();
  const id = `asset_${randomUUID()}`;
  const bvid = extractBvid(url);
  const title = bvid ? `Pending Bilibili asset ${bvid}` : "Pending Bilibili asset";

  getDb()
    .prepare(
      `INSERT INTO assets (
        id, bvid, url, title, description, owner_name, duration, cover_url,
        status, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, bvid, url, title, null, null, null, null, "created", null, now, now);

  return getAssetDetail(id)!.asset;
}

export function createDemoAsset() {
  const existing = getDb()
    .prepare("SELECT id FROM assets WHERE id = ?")
    .get("asset_demo_visual") as { id: string } | undefined;

  if (existing) {
    return;
  }

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO assets (
        id, bvid, url, title, description, owner_name, duration, cover_url,
        status, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "asset_demo_visual",
      "BV1demo",
      "https://www.bilibili.com/video/BV1demo",
      "Demo: visual-only facts in a technical video",
      "Seed asset used to verify the reusable asset workflow before video processing is wired.",
      "Knowledge Clip Studio",
      968,
      null,
      "ready",
      null,
      now,
      now,
    );

  const segments = [
    ["seg_demo_1", 12, 74, "The speaker introduces the system goal: turn long videos into reusable knowledge assets.", "System goal and audience pain."],
    ["seg_demo_2", 75, 188, "The narration discusses summary generation, but the slide contains a separate latency table.", "Audio mentions summaries while visual evidence contains metrics."],
    ["seg_demo_3", 189, 320, "The speaker explains why citations matter for downstream reuse.", "Source traceability and reuse."],
  ];

  const insertSegment = getDb().prepare(
    "INSERT INTO segments (id, asset_id, start_sec, end_sec, text, summary) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const segment of segments) {
    insertSegment.run(segment[0], "asset_demo_visual", segment[1], segment[2], segment[3], segment[4]);
  }

  const frames = [
    {
      id: "frame_demo_1",
      timestamp: 92,
      image: "/demo/frame-latency.svg",
      summary: "A slide shows a latency table comparing metadata, OCR, and visual reasoning stages.",
      visibleText: ["metadata 0.8s", "OCR 3.1s", "vision reasoning 8.4s", "cache hit < 100ms"],
      visualType: "table",
      density: 0.92,
      reason: "Dense table with numbers that are not spoken aloud.",
      onlyVisual: ["Cache hits should return in under 100ms.", "Vision reasoning is the slowest stage at 8.4s."],
    },
    {
      id: "frame_demo_2",
      timestamp: 214,
      image: "/demo/frame-architecture.svg",
      summary: "A workflow diagram connects Bilibili URL, frame extraction, Gemini vision, SQLite memory, and generation.",
      visibleText: ["URL", "frames", "visual JSON", "SQLite memory", "outputs"],
      visualType: "diagram",
      density: 0.87,
      reason: "Architecture diagram carries source-to-output relationships.",
      onlyVisual: ["Frame evidence and text segments are both written into memory before generation."],
    },
  ];

  const insertFrame = getDb().prepare(
    `INSERT INTO frames (
      id, asset_id, timestamp_sec, image_path, summary, visible_text_json,
      visual_type, information_density, retention_reason, only_in_visual_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const frame of frames) {
    insertFrame.run(
      frame.id,
      "asset_demo_visual",
      frame.timestamp,
      frame.image,
      frame.summary,
      JSON.stringify(frame.visibleText),
      frame.visualType,
      frame.density,
      frame.reason,
      JSON.stringify(frame.onlyVisual),
    );
  }

  const knowledge = [
    ["know_demo_1", "fact", "A reusable video asset must preserve both transcript evidence and visual evidence.", ["seg_demo_3"], ["frame_demo_2"]],
    ["know_demo_2", "visual_fact", "The slide reports cache-hit reuse as under 100ms, which is only visible in the frame.", [], ["frame_demo_1"]],
  ];

  const insertKnowledge = getDb().prepare(
    `INSERT INTO knowledge_items (
      id, asset_id, type, content, source_segment_ids_json, source_frame_ids_json
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const item of knowledge) {
    insertKnowledge.run(item[0], "asset_demo_visual", item[1], item[2], JSON.stringify(item[3]), JSON.stringify(item[4]));
  }
}

export function saveGeneratedOutput(mode: OutputMode, assetIds: string[], prompt: string, content: unknown): GeneratedOutput {
  const id = `output_${randomUUID()}`;
  const createdAt = new Date().toISOString();

  getDb()
    .prepare(
      "INSERT INTO outputs (id, mode, asset_ids_json, prompt, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, mode, JSON.stringify(assetIds), prompt, JSON.stringify(content), createdAt);

  return {
    id,
    mode,
    assetIds,
    prompt,
    content,
    createdAt,
  };
}

function extractBvid(input: string) {
  const match = input.match(/BV[a-zA-Z0-9]+/);
  return match?.[0] ?? null;
}

function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    bvid: row.bvid,
    url: row.url,
    title: row.title,
    description: row.description,
    ownerName: row.owner_name,
    duration: row.duration,
    coverUrl: row.cover_url,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSegment(row: SegmentRow): Segment {
  return {
    id: row.id,
    assetId: row.asset_id,
    startSec: row.start_sec,
    endSec: row.end_sec,
    text: row.text,
    summary: row.summary,
  };
}

function mapFrame(row: FrameRow): Frame {
  return {
    id: row.id,
    assetId: row.asset_id,
    timestampSec: row.timestamp_sec,
    imagePath: row.image_path,
    summary: row.summary,
    visibleText: JSON.parse(row.visible_text_json) as string[],
    visualType: row.visual_type,
    informationDensity: row.information_density,
    retentionReason: row.retention_reason,
    onlyInVisual: JSON.parse(row.only_in_visual_json) as string[],
  };
}

function mapKnowledgeItem(row: KnowledgeRow): KnowledgeItem {
  return {
    id: row.id,
    assetId: row.asset_id,
    type: row.type,
    content: row.content,
    sourceSegmentIds: JSON.parse(row.source_segment_ids_json) as string[],
    sourceFrameIds: JSON.parse(row.source_frame_ids_json) as string[],
  };
}

function mapOutput(row: OutputRow): GeneratedOutput {
  return {
    id: row.id,
    mode: row.mode,
    assetIds: JSON.parse(row.asset_ids_json) as string[],
    prompt: row.prompt,
    content: JSON.parse(row.content_json) as unknown,
    createdAt: row.created_at,
  };
}

void mapOutput;
