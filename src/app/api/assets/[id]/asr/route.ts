import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { transcribeAudioWithGemini } from "@/lib/ai/transcript";
import { getAssetDetail, replaceAssetSegments, updateAssetStatus } from "@/lib/db/assets";
import { writeTranscriptManifest } from "@/lib/media/artifacts";
import { extractAudioChunk, fallbackMediaDurationSeconds } from "@/lib/media/ffmpeg";
import { buildFrameTranscriptWindows, transcriptWindowRadiusSec } from "@/lib/media/transcript-windows";
import type { TranscriptSegmentInput } from "@/lib/ai/transcript";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = getAssetDetail(id);

  if (!detail) {
    return NextResponse.json({ error: "资产不存在。" }, { status: 404 });
  }

  const { asset } = detail;
  const audioPath = path.join(process.cwd(), "public", "assets", asset.id, "audio-full.mp3");
  const exists = await fs.stat(audioPath).then((stat) => stat.isFile()).catch(() => false);

  if (!exists) {
    return NextResponse.json(
      { error: "请先提取完整音频，再执行 ASR 转写。" },
      { status: 409 },
    );
  }

  if (!detail.frames.length) {
    return NextResponse.json(
      { error: "请先抽取关键帧。这个 Demo 只保留关键帧附近的转写窗口。" },
      { status: 409 },
    );
  }

  try {
    const durationSec = Math.max(1, Math.floor(asset.duration ?? fallbackMediaDurationSeconds));
    const chunks = buildFrameTranscriptWindows({
      frames: detail.frames,
      durationSec,
      radiusSec: transcriptWindowRadiusSec,
    }).map((window, index) => ({
      index,
      startSec: window.startSec,
      durationSec: window.endSec - window.startSec,
    }));
    const transcriptSegments: TranscriptSegmentInput[] = [];

    for (const chunk of chunks) {
      try {
        const audioChunk = await extractAudioChunk({
          assetId: asset.id,
          inputPath: audioPath,
          startSec: chunk.startSec,
          durationSec: chunk.durationSec,
          index: chunk.index,
        });
        const chunkSegments = await transcribeAudioWithGemini({
          asset,
          audioPath: audioChunk.absolutePath,
          mimeType: audioChunk.mimeType,
          durationSec: audioChunk.durationSec,
          offsetSec: chunk.startSec,
        });
        transcriptSegments.push(...chunkSegments);
      } catch (error) {
        const message = error instanceof Error ? error.message : "ASR 音频窗口转写失败。";
        transcriptSegments.push({
          startSec: chunk.startSec,
          endSec: chunk.startSec + chunk.durationSec,
          text: "[当前音频窗口无法 ASR]",
          summary: message,
        });
      }
    }

    const segments = replaceAssetSegments(asset.id, transcriptSegments);
    await writeTranscriptManifest(asset.id, {
      source: "gemini_audio_full",
      segmentCount: segments.length,
      chunks: chunks.length,
      note: `仅根据关键帧前后 ${transcriptWindowRadiusSec} 秒的已保存音频窗口生成，不保存完整视频时间线转写。`,
    });
    const updatedAsset = advanceTranscriptStatus(asset.id, asset.status);

    return NextResponse.json({
      asset: updatedAsset,
      segments,
      source: "gemini_audio_full",
      chunks: chunks.length,
      limits: {
        transcriptWindowRadiusSec,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ASR 转写失败。";

    return NextResponse.json({ asset, error: message }, { status: 500 });
  }
}

function advanceTranscriptStatus(assetId: string, currentStatus: string) {
  if (currentStatus === "asset_built" || currentStatus === "ready") {
    return getAssetDetail(assetId)!.asset;
  }

  return updateAssetStatus(assetId, "transcript_ready");
}
