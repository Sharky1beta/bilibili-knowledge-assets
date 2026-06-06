import { NextResponse } from "next/server";
import {
  BilibiliSubtitleTrackUnavailableError,
  fetchBilibiliSubtitleSegments,
  fetchBilibiliSubtitleSegmentsFromUrl,
} from "@/lib/bilibili/client";
import { getAssetDetail, markAssetFailed, replaceAssetSegments, updateAssetStatus } from "@/lib/db/assets";
import { writeOfficialSubtitleSnapshot, writeTranscriptManifest } from "@/lib/media/artifacts";
import { buildFrameTranscriptWindows, filterSegmentsToWindows, transcriptWindowRadiusSec } from "@/lib/media/transcript-windows";

export async function POST(
  request: Request,
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
    const body = (await request.json().catch(() => null)) as { subtitleUrl?: string } | null;
    const manualSubtitleUrl = body?.subtitleUrl?.trim();
    const referer = asset.bvid ? `https://www.bilibili.com/video/${asset.bvid}` : asset.url;
    const segmentsFromSubtitles = manualSubtitleUrl
      ? await fetchBilibiliSubtitleSegmentsFromUrl(manualSubtitleUrl, referer)
      : await fetchBilibiliSubtitleSegments(asset);

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
        ? `已将${manualSubtitleUrl ? "手动导入的" : ""} B 站官方字幕过滤到关键帧前后 ${transcriptWindowRadiusSec} 秒窗口。`
        : `已${manualSubtitleUrl ? "手动导入" : "抓取"} B 站官方字幕，并规范化为带时间戳片段。`,
    });
    const updatedAsset = advanceTranscriptStatus(asset.id, asset.status);

    return NextResponse.json({
      asset: updatedAsset,
      segments,
      source: "bilibili_subtitle",
      windows: windows.length,
      importedFromUrl: Boolean(manualSubtitleUrl),
    });
  } catch (error) {
    if (error instanceof BilibiliSubtitleTrackUnavailableError) {
      return NextResponse.json(
        {
          asset,
          error:
            "检测到 B 站官方字幕轨道，但当前匿名接口没有返回字幕文件地址。可以在 .env.local 配置 BILIBILI_COOKIE 后重试；否则请提取音频并执行音频 ASR。",
          source: "bilibili_subtitle",
          subtitleTracks: error.tracks.map((track) => ({
            id: track.id,
            idStr: track.id_str,
            language: track.lan_doc || track.lan || "未知语言",
            hasUrl: Boolean(track.subtitle_url || track.subtitle_url_v2),
          })),
        },
        { status: 409 },
      );
    }

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
