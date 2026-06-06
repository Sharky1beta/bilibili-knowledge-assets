import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { BilibiliPlayUrl } from "@/lib/bilibili/client";

export const fallbackMediaDurationSeconds = 8 * 60;
export const maxCandidateFrames = 12;

export type ExtractedFrame = {
  timestampSec: number;
  absolutePath: string;
  publicPath: string;
  candidateSource: CandidateFrameSource;
  candidateReason: string;
};

type CandidateFrameSource = "scene_change" | "danmaku_hotspot" | "mixed_signal" | "coverage_fallback";

type CandidateTimestamp = {
  timestampSec: number;
  source: CandidateFrameSource;
  reason: string;
  score: number;
};

export type ExtractedAudioSample = {
  absolutePath: string;
  publicPath: string;
  durationSec: number;
  mimeType: "audio/mpeg";
};

export async function extractCandidateFrames(options: {
  assetId: string;
  playUrl: BilibiliPlayUrl;
  durationSec: number | null;
  danmakuHotspots?: Array<{ timestampSec: number; heat: number; count: number }>;
}): Promise<ExtractedFrame[]> {
  const assetDir = path.join(process.cwd(), "public", "assets", options.assetId);
  await fs.mkdir(assetDir, { recursive: true });
  await clearExistingFrames(assetDir);

  const sampleDuration = Math.max(1, Math.floor(options.durationSec ?? fallbackMediaDurationSeconds));
  const sceneTimestamps = await detectSceneChangeTimestamps({
    playUrl: options.playUrl,
    durationSec: sampleDuration,
  });
  const timestamps = buildCandidateTimestamps({
    durationSec: sampleDuration,
    sceneTimestamps,
    danmakuHotspots: options.danmakuHotspots ?? [],
  });
  const frames: ExtractedFrame[] = [];

  for (const candidate of timestamps) {
    const filename = `frame-${String(Math.round(candidate.timestampSec)).padStart(5, "0")}.jpg`;
    const absolutePath = path.join(assetDir, filename);

    await extractSingleFrame({
      urls: options.playUrl.urls,
      referer: options.playUrl.referer,
      userAgent: options.playUrl.userAgent,
      timestampSec: candidate.timestampSec,
      outputPath: absolutePath,
    });

    frames.push({
      timestampSec: candidate.timestampSec,
      absolutePath,
      publicPath: `/assets/${options.assetId}/${filename}`,
      candidateSource: candidate.source,
      candidateReason: candidate.reason,
    });
  }

  return frames;
}

export async function extractAudioSample(options: {
  assetId: string;
  playUrl: BilibiliPlayUrl;
  durationSec: number | null;
}): Promise<ExtractedAudioSample> {
  const assetDir = path.join(process.cwd(), "public", "assets", options.assetId);
  await fs.mkdir(assetDir, { recursive: true });

  const sampleDuration = Math.max(1, Math.floor(options.durationSec ?? fallbackMediaDurationSeconds));
  const outputPath = path.join(assetDir, "audio-sample.mp3");
  const errors: string[] = [];

  for (const url of audioCandidateUrls(options.playUrl)) {
    try {
      await runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-headers",
        `Referer: ${options.playUrl.referer}\r\nUser-Agent: ${options.playUrl.userAgent}\r\n`,
        "-i",
        url,
        "-t",
        String(sampleDuration),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "48k",
        outputPath,
      ]);

      return {
        absolutePath: outputPath,
        publicPath: `/assets/${options.assetId}/audio-sample.mp3`,
        durationSec: sampleDuration,
        mimeType: "audio/mpeg",
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`All Bilibili stream mirrors failed during audio extraction. ${errors.at(-1) ?? ""}`);
}

export async function extractFullAudio(options: {
  assetId: string;
  playUrl: BilibiliPlayUrl;
  durationSec: number | null;
}): Promise<ExtractedAudioSample> {
  const assetDir = path.join(process.cwd(), "public", "assets", options.assetId);
  await fs.mkdir(assetDir, { recursive: true });

  const durationSec = Math.max(1, Math.floor(options.durationSec ?? fallbackMediaDurationSeconds));
  const outputPath = path.join(assetDir, "audio-full.mp3");
  const errors: string[] = [];

  for (const url of audioCandidateUrls(options.playUrl)) {
    try {
      await runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-headers",
        `Referer: ${options.playUrl.referer}\r\nUser-Agent: ${options.playUrl.userAgent}\r\n`,
        "-i",
        url,
        "-t",
        String(durationSec),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "48k",
        outputPath,
      ]);

      return {
        absolutePath: outputPath,
        publicPath: `/assets/${options.assetId}/audio-full.mp3`,
        durationSec,
        mimeType: "audio/mpeg",
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`All Bilibili stream mirrors failed during full audio extraction. ${errors.at(-1) ?? ""}`);
}

export async function extractAudioChunk(options: {
  assetId: string;
  inputPath: string;
  startSec: number;
  durationSec: number;
  index: number;
}): Promise<ExtractedAudioSample> {
  const assetDir = path.join(process.cwd(), "public", "assets", options.assetId);
  await fs.mkdir(assetDir, { recursive: true });

  const filename = `asr-chunk-${String(options.index).padStart(3, "0")}.mp3`;
  const outputPath = path.join(assetDir, filename);

  await runFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(options.startSec),
    "-i",
    options.inputPath,
    "-t",
    String(options.durationSec),
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "48k",
    outputPath,
  ]);

  return {
    absolutePath: outputPath,
    publicPath: `/assets/${options.assetId}/${filename}`,
    durationSec: options.durationSec,
    mimeType: "audio/mpeg",
  };
}

async function extractSingleFrame(options: {
  urls: string[];
  referer: string;
  userAgent: string;
  timestampSec: number;
  outputPath: string;
}) {
  const errors: string[] = [];

  for (const url of options.urls) {
    try {
      await runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-headers",
        `Referer: ${options.referer}\r\nUser-Agent: ${options.userAgent}\r\n`,
        "-i",
        url,
        "-ss",
        String(options.timestampSec),
        "-frames:v",
        "1",
        "-vf",
        "scale='min(960,iw)':-2",
        "-q:v",
        "3",
        options.outputPath,
      ]);
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`All Bilibili stream mirrors failed for ${options.timestampSec}s. ${errors.at(-1) ?? ""}`);
}

function audioCandidateUrls(playUrl: BilibiliPlayUrl) {
  return playUrl.audioUrls.length ? playUrl.audioUrls : playUrl.urls;
}

async function detectSceneChangeTimestamps(options: {
  playUrl: BilibiliPlayUrl;
  durationSec: number;
}): Promise<number[]> {
  const errors: string[] = [];

  for (const url of options.playUrl.urls.slice(0, 1)) {
    try {
      const output = await runFfmpegWithOutput([
        "-hide_banner",
        "-loglevel",
        "info",
        "-headers",
        `Referer: ${options.playUrl.referer}\r\nUser-Agent: ${options.playUrl.userAgent}\r\n`,
        "-i",
        url,
        "-t",
        String(options.durationSec),
        "-an",
        "-vf",
        "fps=1/2,select='gt(scene,0.32)',showinfo",
        "-f",
        "null",
        process.platform === "win32" ? "NUL" : "/dev/null",
      ], 45_000);
      const timestamps = parseShowinfoTimestamps(output);
      if (timestamps.length) {
        return timestamps;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  void errors;
  return [];
}

function parseShowinfoTimestamps(output: string) {
  const timestamps = new Set<number>();
  const regex = /pts_time:([0-9.]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(output))) {
    const timestampSec = Number(match[1]);
    if (Number.isFinite(timestampSec) && timestampSec > 0) {
      timestamps.add(Math.round(timestampSec));
    }
  }

  return Array.from(timestamps);
}

function buildCandidateTimestamps(options: {
  durationSec: number;
  sceneTimestamps: number[];
  danmakuHotspots: Array<{ timestampSec: number; heat: number; count: number }>;
}) {
  const safeDuration = Math.max(1, Math.floor(options.durationSec));
  const candidates: CandidateTimestamp[] = [];

  for (const [index, timestampSec] of options.sceneTimestamps.entries()) {
    if (timestampSec > safeDuration) {
      continue;
    }

    candidates.push({
      timestampSec,
      source: "scene_change",
      reason: "Scene-change candidate from ffmpeg; abrupt visual transitions often indicate a new slide, chart, shot, or whiteboard state.",
      score: 90 - index,
    });
  }

  for (const hotspot of options.danmakuHotspots) {
    if (hotspot.timestampSec > safeDuration) {
      continue;
    }

    candidates.push({
      timestampSec: hotspot.timestampSec,
      source: "danmaku_hotspot",
      reason: `Danmaku hotspot candidate; ${hotspot.count} comments clustered near this moment, suggesting audience-recognized key content.`,
      score: 80 + hotspot.heat,
    });
  }

  const fallbackCount = Math.min(4, Math.max(2, Math.ceil(safeDuration / 180)));
  const fallbackGap = safeDuration / (fallbackCount + 1);
  for (let index = 0; index < fallbackCount; index += 1) {
    candidates.push({
      timestampSec: Math.max(1, Math.round(fallbackGap * (index + 1))),
      source: "coverage_fallback",
      reason: "Coverage fallback candidate used only to avoid blind spots when scene/danmaku signals are sparse.",
      score: 20 - index,
    });
  }

  return selectTimelineDiverseCandidates(dedupeCandidates(candidates, 5), safeDuration)
    .sort((a, b) => a.timestampSec - b.timestampSec);
}

function dedupeCandidates(candidates: CandidateTimestamp[], minGapSec: number) {
  const selected: CandidateTimestamp[] = [];
  const ranked = candidates
    .filter((candidate) => Number.isFinite(candidate.timestampSec) && candidate.timestampSec > 0)
    .map((candidate) => ({ ...candidate, timestampSec: Math.round(candidate.timestampSec) }))
    .sort((a, b) => b.score - a.score);

  for (const candidate of ranked) {
    const existing = selected.find((item) => Math.abs(item.timestampSec - candidate.timestampSec) < minGapSec);
    if (existing) {
      if (existing.source !== candidate.source) {
        existing.source = "mixed_signal";
        existing.reason = `${existing.reason} Also matched: ${candidate.reason}`;
        existing.score = Math.max(existing.score, candidate.score) + 5;
      }
      continue;
    }

    selected.push(candidate);
  }

  return selected;
}

function selectTimelineDiverseCandidates(candidates: CandidateTimestamp[], durationSec: number) {
  const bucketSize = Math.max(1, durationSec / maxCandidateFrames);
  const buckets = new Map<number, CandidateTimestamp>();

  for (const candidate of candidates) {
    const bucket = Math.min(maxCandidateFrames - 1, Math.max(0, Math.floor(candidate.timestampSec / bucketSize)));
    const existing = buckets.get(bucket);
    if (!existing || candidate.score > existing.score) {
      buckets.set(bucket, candidate);
    }
  }

  const timelineCandidates = Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([, candidate]) => candidate);

  if (timelineCandidates.length >= maxCandidateFrames) {
    return timelineCandidates.slice(0, maxCandidateFrames);
  }

  const selectedKeys = new Set(timelineCandidates.map((candidate) => `${candidate.timestampSec}:${candidate.source}`));
  const fillers = candidates
    .filter((candidate) => !selectedKeys.has(`${candidate.timestampSec}:${candidate.source}`))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidateFrames - timelineCandidates.length);

  return [...timelineCandidates, ...fillers].slice(0, maxCandidateFrames);
}

async function clearExistingFrames(assetDir: string) {
  const entries = await fs.readdir(assetDir).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith("frame-") && entry.endsWith(".jpg"))
      .map((entry) => fs.unlink(path.join(assetDir, entry))),
  );
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

function runFfmpegWithOutput(args: string[], timeoutMs?: number) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = timeoutMs
      ? setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          child.kill("SIGKILL");
          reject(new Error(`ffmpeg timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : null;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }

      if (code === 0) {
        resolve(`${stdout}\n${stderr}`);
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}
