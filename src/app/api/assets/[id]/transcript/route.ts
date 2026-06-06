import { NextResponse } from "next/server";
import { fetchBilibiliSubtitleSegments } from "@/lib/bilibili/client";
import { getAssetDetail, markAssetFailed, replaceAssetSegments, updateAssetStatus } from "@/lib/db/assets";
import { writeOfficialSubtitleSnapshot, writeTranscriptManifest } from "@/lib/media/artifacts";
import { buildFrameTranscriptWindows, filterSegmentsToWindows, transcriptWindowRadiusSec } from "@/lib/media/transcript-windows";

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
    const segmentsFromSubtitles = await fetchBilibiliSubtitleSegments(asset);

    if (!segmentsFromSubtitles.length) {
      return NextResponse.json(
        {
          asset,
          error: "No official Bilibili subtitles were found. Extract full audio, then run ASR transcription.",
          source: "bilibili_subtitle",
        },
        { status: 404 },
      );
    }

    const windows = buildFrameTranscriptWindows({
      frames: detail.frames,
      durationSec: asset.duration,
    });
    const frameAlignedSegments = filterSegmentsToWindows(segmentsFromSubtitles, windows);
    const segments = replaceAssetSegments(asset.id, frameAlignedSegments);
    await writeOfficialSubtitleSnapshot(asset.id, frameAlignedSegments);
    await writeTranscriptManifest(asset.id, {
      source: "bilibili_subtitle",
      segmentCount: segments.length,
      note: windows.length
        ? `Official Bilibili subtitles were filtered to key-frame windows (+/- ${transcriptWindowRadiusSec}s).`
        : "Official Bilibili subtitle file was fetched and normalized into timestamped segments.",
    });
    const updatedAsset = advanceTranscriptStatus(asset.id, asset.status);

    return NextResponse.json({
      asset: updatedAsset,
      segments,
      source: "bilibili_subtitle",
      windows: windows.length,
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
