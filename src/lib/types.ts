export type AssetStatus =
  | "created"
  | "metadata_fetched"
  | "video_resolved"
  | "media_downloaded"
  | "frames_extracted"
  | "visual_understood"
  | "transcript_ready"
  | "asset_built"
  | "ready"
  | "failed";

export type Asset = {
  id: string;
  aid: number | null;
  bvid: string | null;
  cid: number | null;
  url: string;
  title: string;
  description: string | null;
  ownerName: string | null;
  duration: number | null;
  coverUrl: string | null;
  tags: string[];
  pageCount: number | null;
  status: AssetStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Segment = {
  id: string;
  assetId: string;
  startSec: number;
  endSec: number;
  text: string;
  summary: string | null;
};

export type Frame = {
  id: string;
  assetId: string;
  timestampSec: number;
  imagePath: string;
  summary: string;
  visibleText: string[];
  visualType: string;
  informationDensity: number;
  retentionReason: string;
  onlyInVisual: string[];
};

export type KnowledgeItem = {
  id: string;
  assetId: string;
  type: string;
  content: string;
  sourceSegmentIds: string[];
  sourceFrameIds: string[];
};

export type OutputMode =
  | "illustrated_summary"
  | "evidence_cards"
  | "multi_video_synthesis";

export type GeneratedOutput = {
  id: string;
  mode: OutputMode;
  assetIds: string[];
  prompt: string;
  content: unknown;
  createdAt: string;
};
