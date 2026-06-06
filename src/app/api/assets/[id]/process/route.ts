import { NextResponse } from "next/server";
import { fetchBilibiliPlayUrl } from "@/lib/bilibili/client";
import { getAssetDetail, markAssetFailed, replaceAssetFrames, updateAssetStatus } from "@/lib/db/assets";
import { extractCandidateFrames, maxCandidateFrames, mediaSampleLimitSeconds } from "@/lib/media/ffmpeg";

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
      { error: "Fetch metadata before processing media. This asset has no cid/bvid/aid yet." },
      { status: 409 },
    );
  }

  try {
    updateAssetStatus(asset.id, "video_resolved");
    const playUrl = await fetchBilibiliPlayUrl(asset);

    updateAssetStatus(asset.id, "media_downloaded");
    const extractedFrames = await extractCandidateFrames({
      assetId: asset.id,
      playUrl,
      durationSec: asset.duration,
    });

    const frames = replaceAssetFrames(asset.id, extractedFrames);
    const updatedAsset = updateAssetStatus(asset.id, "frames_extracted");

    return NextResponse.json({
      asset: updatedAsset,
      frames,
      limits: {
        mediaSampleLimitSeconds,
        maxCandidateFrames,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process video media.";
    const failedAsset = markAssetFailed(asset.id, message);

    return NextResponse.json({ asset: failedAsset, error: message }, { status: 500 });
  }
}
