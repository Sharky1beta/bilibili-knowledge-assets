import type { Asset, AssetStatus } from "@/lib/types";

export type PipelineAction =
  | "process"
  | "vision"
  | "audio"
  | "subtitles"
  | "asr"
  | "build";

export const pipelineSteps: AssetStatus[] = [
  "created",
  "metadata_fetched",
  "video_resolved",
  "media_downloaded",
  "frames_extracted",
  "visual_understood",
  "transcript_ready",
  "asset_built",
  "ready",
];

const statusOrder = new Map(pipelineSteps.map((status, index) => [status, index]));

export function actionDisabledReason(options: {
  asset: Asset;
  action: PipelineAction;
  hasFrames: boolean;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasKnowledge: boolean;
}) {
  const { asset, action, hasFrames, hasAudio, hasKnowledge } = options;

  if (!asset.cid || (!asset.bvid && !asset.aid)) {
    return "Metadata is missing. Create the asset from a valid public Bilibili URL before running this step.";
  }

  if (action === "process") {
    return null;
  }

  if (action === "audio") {
    return null;
  }

  if (action === "subtitles") {
    if (!hasFrames) {
      return "Extract key frames first. The demo keeps only subtitle segments around selected frames.";
    }
    return null;
  }

  if (action === "vision" && !hasFrames) {
    return "Extract frames first so Gemini vision has screenshots to analyze.";
  }

  if (asset.status === "failed" && (action === "vision" || action === "build")) {
    return "Recover the failed prerequisite first, then retry this step.";
  }

  if (action === "asr" && !hasAudio) {
    return "Extract full audio first; ASR works from the saved audio-full.mp3 artifact.";
  }

  if (action === "asr" && !hasFrames) {
    return "Extract key frames first. ASR only transcribes audio windows around selected frames.";
  }

  if (action === "build") {
    if (!hasFrames) {
      return "Extract frames first so the asset has visual evidence.";
    }
    if (statusRank(asset.status) < statusRank("visual_understood")) {
      return "Analyze vision first so the asset includes frame summaries, visible text, and visual-only facts.";
    }
    if (hasKnowledge && (asset.status === "asset_built" || asset.status === "ready")) {
      return "This asset is already built. Rebuild only if you changed frames, subtitles, or transcript evidence.";
    }
  }

  return null;
}

export function getNextPipelineStep(options: {
  asset: Asset;
  hasFrames: boolean;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasKnowledge: boolean;
}) {
  const { asset, hasFrames, hasAudio, hasTranscript, hasKnowledge } = options;

  if (asset.status === "failed") {
    return {
      title: "Recover failed asset",
      body: asset.errorMessage || "Inspect the error, then create the asset again or retry the missing prerequisite.",
    };
  }

  if (!asset.cid || (!asset.bvid && !asset.aid)) {
    return {
      title: "Fetch metadata",
      body: "Start from a public Bilibili URL so the asset can store aid, bvid, cid, duration, owner, and tags.",
    };
  }

  if (!hasFrames) {
    return {
      title: "Next: Extract information-driven frames",
      body: "Run scene-change and danmaku-hotspot candidate extraction before visual analysis.",
    };
  }

  if (statusRank(asset.status) < statusRank("visual_understood")) {
    return {
      title: "Next: Analyze vision",
      body: "Ask Gemini vision to score frame information density, visible text, and visual-only facts.",
    };
  }

  if (!hasAudio) {
    return {
      title: "Optional: Extract full audio",
      body: "Save audio-full.mp3 before ASR. Official subtitles can be fetched without this step.",
    };
  }

  if (!hasTranscript) {
    return {
      title: "Next: Add transcript layer",
      body: "Try official Bilibili subtitles first. If none exist, run ASR from the saved full audio.",
    };
  }

  if (!hasKnowledge || statusRank(asset.status) < statusRank("asset_built")) {
    return {
      title: "Next: Build reusable asset",
      body: "Merge metadata, visual facts, transcript segments, and citations into structured knowledge items.",
    };
  }

  return {
    title: "Ready for generation",
    body: "Use Generate to reuse this asset for summaries, evidence cards, or multi-video synthesis without reprocessing.",
  };
}

export function recoveryAdvice(errorMessage: string | null) {
  const message = (errorMessage ?? "").toLowerCase();

  if (message.includes("gemini") || message.includes("api key")) {
    return "Check .env.local for GEMINI_API_KEY, then restart the dev server and retry visual analysis or generation.";
  }

  if (message.includes("ffmpeg")) {
    return "Install ffmpeg and make sure it is available on PATH, then retry frame or audio extraction.";
  }

  if (message.includes("playurl") || message.includes("stream") || message.includes("region")) {
    return "Confirm the video is public, reachable in this region, and not blocked by Bilibili anti-hotlinking.";
  }

  if (message.includes("metadata") || message.includes("bvid") || message.includes("cid")) {
    return "Create the asset again from a valid Bilibili BV/av URL so metadata can populate cid and source identity.";
  }

  return null;
}

function statusRank(status: AssetStatus) {
  return statusOrder.get(status) ?? -1;
}
