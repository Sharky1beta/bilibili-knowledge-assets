import { NextResponse } from "next/server";
import { transcribeAudioWithGemini } from "@/lib/ai/transcript";
import { fetchBilibiliPlayUrl, fetchBilibiliSubtitleSegments } from "@/lib/bilibili/client";
import { getAssetDetail, markAssetFailed, replaceAssetSegments, updateAssetStatus } from "@/lib/db/assets";
import { extractAudioSample, mediaSampleLimitSeconds } from "@/lib/media/ffmpeg";

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
  if (!asset.cid || (!asset.bvid && !asset.aid)) {
    return NextResponse.json(
      { error: "Fetch metadata before extracting transcript. This asset has no cid/bvid/aid yet." },
      { status: 409 },
    );
  }

  try {
    const subtitleSegments = await fetchBilibiliSubtitleSegments(asset);

    if (subtitleSegments.length) {
      const segments = replaceAssetSegments(asset.id, subtitleSegments);
      const updatedAsset = advanceTranscriptStatus(asset.id, asset.status);
      return NextResponse.json({
        asset: updatedAsset,
        segments,
        source: "bilibili_subtitle",
      });
    }

    const playUrl = await fetchBilibiliPlayUrl(asset);
    const audio = await extractAudioSample({
      assetId: asset.id,
      playUrl,
      durationSec: asset.duration,
    });
    const transcriptSegments = await transcribeAudioWithGemini({
      asset,
      audioPath: audio.absolutePath,
      mimeType: audio.mimeType,
      durationSec: audio.durationSec,
    });
    const segments = replaceAssetSegments(asset.id, transcriptSegments);
    const updatedAsset = advanceTranscriptStatus(asset.id, asset.status);

    return NextResponse.json({
      asset: updatedAsset,
      segments,
      source: "gemini_audio",
      limits: {
        mediaSampleLimitSeconds,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcript extraction failed.";
    const failedAsset = markAssetFailed(asset.id, message);

    return NextResponse.json({ asset: failedAsset, error: message }, { status: 500 });
  }
}

function advanceTranscriptStatus(assetId: string, currentStatus: string) {
  if (currentStatus === "asset_built" || currentStatus === "ready") {
    return getAssetDetail(assetId)!.asset;
  }

  return updateAssetStatus(assetId, "transcript_ready");
}
