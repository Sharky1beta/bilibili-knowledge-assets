import { NextResponse } from "next/server";
import { fetchBilibiliPlayUrl } from "@/lib/bilibili/client";
import { getAssetDetail, markAssetFailed, updateAssetStatus } from "@/lib/db/assets";
import { extractFullAudio } from "@/lib/media/ffmpeg";

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
      { error: "Fetch metadata before extracting audio. This asset has no cid/bvid/aid yet." },
      { status: 409 },
    );
  }

  try {
    const playUrl = await fetchBilibiliPlayUrl(asset);
    const audio = await extractFullAudio({
      assetId: asset.id,
      playUrl,
      durationSec: asset.duration,
    });
    const updatedAsset = advanceMediaStatus(asset.id, asset.status);

    return NextResponse.json({
      asset: updatedAsset,
      audio,
      source: "bilibili_playurl",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Full audio extraction failed.";
    const failedAsset = markAssetFailed(asset.id, message);

    return NextResponse.json({ asset: failedAsset, error: message }, { status: 500 });
  }
}

function advanceMediaStatus(assetId: string, currentStatus: string) {
  if (
    currentStatus === "created" ||
    currentStatus === "metadata_fetched" ||
    currentStatus === "video_resolved"
  ) {
    return updateAssetStatus(assetId, "media_downloaded");
  }

  return getAssetDetail(assetId)!.asset;
}
