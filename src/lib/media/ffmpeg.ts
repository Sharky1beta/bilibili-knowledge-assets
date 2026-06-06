import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { BilibiliPlayUrl } from "@/lib/bilibili/client";

export const mediaSampleLimitSeconds = 8 * 60;
export const maxCandidateFrames = 12;

export type ExtractedFrame = {
  timestampSec: number;
  absolutePath: string;
  publicPath: string;
};

export async function extractCandidateFrames(options: {
  assetId: string;
  playUrl: BilibiliPlayUrl;
  durationSec: number | null;
}): Promise<ExtractedFrame[]> {
  const assetDir = path.join(process.cwd(), "public", "assets", options.assetId);
  await fs.mkdir(assetDir, { recursive: true });
  await clearExistingFrames(assetDir);

  const sampleDuration = Math.min(options.durationSec ?? mediaSampleLimitSeconds, mediaSampleLimitSeconds);
  const timestamps = buildCandidateTimestamps(sampleDuration);
  const frames: ExtractedFrame[] = [];

  for (const timestampSec of timestamps) {
    const filename = `frame-${String(Math.round(timestampSec)).padStart(5, "0")}.jpg`;
    const absolutePath = path.join(assetDir, filename);

    await extractSingleFrame({
      urls: options.playUrl.urls,
      referer: options.playUrl.referer,
      userAgent: options.playUrl.userAgent,
      timestampSec,
      outputPath: absolutePath,
    });

    frames.push({
      timestampSec,
      absolutePath,
      publicPath: `/assets/${options.assetId}/${filename}`,
    });
  }

  return frames;
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

function buildCandidateTimestamps(durationSec: number) {
  const safeDuration = Math.max(1, Math.floor(durationSec));
  const count = Math.min(maxCandidateFrames, Math.max(3, Math.ceil(safeDuration / 60)));
  const gap = safeDuration / (count + 1);
  const timestamps = Array.from({ length: count }, (_, index) => Math.max(1, Math.round(gap * (index + 1))));

  return Array.from(new Set(timestamps));
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
