import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { transcribeAudioWithGemini } from "@/lib/ai/transcript";
import { getAssetDetail, replaceAssetSegments, updateAssetStatus } from "@/lib/db/assets";
import { writeTranscriptManifest } from "@/lib/media/artifacts";
import { extractAudioChunk, mediaSampleLimitSeconds } from "@/lib/media/ffmpeg";
import type { TranscriptSegmentInput } from "@/lib/ai/transcript";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = getAssetDetail(id);

  if (!detail) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const { asset } = detail;
  const audioPath = path.join(process.cwd(), "public", "assets", asset.id, "audio-full.mp3");
  const exists = await fs.stat(audioPath).then((stat) => stat.isFile()).catch(() => false);

  if (!exists) {
    return NextResponse.json(
      { error: "Extract full audio before running ASR transcription." },
      { status: 409 },
    );
  }

  try {
    const durationSec = Math.max(1, Math.floor(asset.duration ?? mediaSampleLimitSeconds));
    const chunkDurationSec = 60;
    const chunks = buildAudioChunks(durationSec, chunkDurationSec);
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
        const message = error instanceof Error ? error.message : "ASR chunk failed.";
        transcriptSegments.push({
          startSec: chunk.startSec,
          endSec: chunk.startSec + chunk.durationSec,
          text: "[ASR unavailable for this audio chunk]",
          summary: message,
        });
      }
    }

    const segments = replaceAssetSegments(asset.id, transcriptSegments);
    await writeTranscriptManifest(asset.id, {
      source: "gemini_audio_full",
      segmentCount: segments.length,
      chunks: chunks.length,
      note: "Generated from the saved full audio file because official subtitles were unavailable or skipped.",
    });
    const updatedAsset = advanceTranscriptStatus(asset.id, asset.status);

    return NextResponse.json({
      asset: updatedAsset,
      segments,
      source: "gemini_audio_full",
      chunks: chunks.length,
      limits: {
        chunkDurationSec,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ASR transcription failed.";

    return NextResponse.json({ asset, error: message }, { status: 500 });
  }
}

function buildAudioChunks(durationSec: number, chunkDurationSec: number) {
  const chunks = [];
  for (let startSec = 0, index = 0; startSec < durationSec; startSec += chunkDurationSec, index += 1) {
    chunks.push({
      index,
      startSec,
      durationSec: Math.min(chunkDurationSec, durationSec - startSec),
    });
  }

  return chunks;
}

function advanceTranscriptStatus(assetId: string, currentStatus: string) {
  if (currentStatus === "asset_built" || currentStatus === "ready") {
    return getAssetDetail(assetId)!.asset;
  }

  return updateAssetStatus(assetId, "transcript_ready");
}
