import { NextResponse } from "next/server";
import { generateOutputContent } from "@/lib/ai/outputs";
import { getAssetDetail, markBuiltAssetsReady, saveGeneratedOutput } from "@/lib/db/assets";
import type { OutputMode } from "@/lib/types";

const modes = new Set<OutputMode>(["illustrated_summary", "evidence_cards", "multi_video_synthesis"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    assetIds?: string[];
    mode?: OutputMode;
    prompt?: string;
  } | null;

  const assetIds = body?.assetIds ?? [];
  const mode = body?.mode;
  const prompt = body?.prompt?.trim() ?? "";

  if (!assetIds.length) {
    return NextResponse.json({ error: "请至少选择一个资产。" }, { status: 400 });
  }

  if (!mode || !modes.has(mode)) {
    return NextResponse.json({ error: "不支持的生成模式。" }, { status: 400 });
  }

  const details = assetIds.map(getAssetDetail);
  if (details.some((detail) => !detail)) {
    return NextResponse.json({ error: "有资产不存在。" }, { status: 404 });
  }

  const validDetails = details.filter(Boolean) as NonNullable<ReturnType<typeof getAssetDetail>>[];
  const { content, usedFallback, warning } = await generateOutputContent(mode, validDetails, prompt);
  const output = saveGeneratedOutput(mode, assetIds, prompt, content);
  const assets = markBuiltAssetsReady(assetIds);

  return NextResponse.json({
    outputId: output.id,
    content,
    usedFallback,
    warning,
    assets,
    reuseProof: {
      message: "本次没有重新处理视频，只复用了已保存的元数据、关键帧、字幕/转写片段和知识条目。",
      assets: validDetails.map((detail) => ({
        assetId: detail.asset.id,
        title: detail.asset.title,
        status: detail.asset.status,
        metadata: Boolean(detail.asset.bvid || detail.asset.aid || detail.asset.cid),
        frames: detail.frames.length,
        transcriptSegments: detail.segments.length,
        knowledgeItems: detail.knowledgeItems.length,
      })),
    },
  });
}
