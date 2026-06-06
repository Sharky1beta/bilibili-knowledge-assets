import fs from "node:fs/promises";
import path from "node:path";
import type { TranscriptSegmentInput } from "@/lib/ai/transcript";

export type AudioArtifactInfo = {
  publicPath: string;
  bytes: number;
};

export type TranscriptManifest = {
  source: "bilibili_subtitle" | "gemini_audio_full";
  segmentCount: number;
  createdAt: string;
  chunks?: number;
  note?: string;
};

export async function getAudioArtifactInfo(assetId: string): Promise<AudioArtifactInfo | null> {
  const audioPath = path.join(assetDir(assetId), "audio-full.mp3");
  const stat = await fs.stat(audioPath).catch(() => null);

  if (!stat?.isFile()) {
    return null;
  }

  return {
    publicPath: `/assets/${assetId}/audio-full.mp3`,
    bytes: stat.size,
  };
}

export async function writeOfficialSubtitleSnapshot(assetId: string, segments: TranscriptSegmentInput[]) {
  const directory = assetDir(assetId);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "official-subtitles.json"),
    JSON.stringify({ body: segments }, null, 2),
    "utf8",
  );
}

export async function writeTranscriptManifest(assetId: string, manifest: Omit<TranscriptManifest, "createdAt">) {
  const directory = assetDir(assetId);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "transcript-manifest.json"),
    JSON.stringify({ ...manifest, createdAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

export async function readTranscriptManifest(assetId: string): Promise<TranscriptManifest | null> {
  const manifestPath = path.join(assetDir(assetId), "transcript-manifest.json");
  const text = await fs.readFile(manifestPath, "utf8").catch(() => null);

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as TranscriptManifest;
  } catch {
    return null;
  }
}

function assetDir(assetId: string) {
  return path.join(process.cwd(), "public", "assets", assetId);
}
