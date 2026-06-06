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
    return NextResponse.json({ error: "资产不存在。" }, { status: 404 });
  }

  const { asset } = detail;
  if (!asset.cid || (!asset.bvid && !asset.aid)) {
    return NextResponse.json(
      { error: "请先获取元数据。当前资产还没有 cid/bvid/aid，无法抓字幕。" },
      { status: 409 },
    );
  }

  try {
    const segmentsFromSubtitles = await fetchBilibiliSubtitleSegments(asset);

    if (!segmentsFromSubtitles.length) {
      return NextResponse.json(
        {
          asset,
          error: "没有找到 B 站官方字幕。请先提取音频，再执行音频 ASR。",
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
        ? `已将 B 站官方字幕过滤到关键帧前后 ${transcriptWindowRadiusSec} 秒窗口。`
        : "已抓取 B 站官方字幕，并规范化为带时间戳片段。",
    });
    const updatedAsset = advanceTranscriptStatus(asset.id, asset.status);

    return NextResponse.json({
      asset: updatedAsset,
      segments,
      source: "bilibili_subtitle",
      windows: windows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "字幕提取失败。";
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
