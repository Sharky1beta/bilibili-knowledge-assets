import { NextResponse } from "next/server";
import { analyzeFrameWithGemini, GeminiVisionError, hasGeminiApiKey } from "@/lib/ai/gemini";
import { getAssetDetail, markAssetFailed, updateAssetStatus, updateFrameAnalysis } from "@/lib/db/assets";
import type { FrameVisualAnalysis } from "@/lib/ai/gemini";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = getAssetDetail(id);

  if (!detail) {
    return NextResponse.json({ error: "资产不存在。" }, { status: 404 });
  }

  if (!detail.frames.length) {
    return NextResponse.json({ error: "请先抽取候选关键帧，再进行视觉分析。" }, { status: 409 });
  }

  if (!hasGeminiApiKey()) {
    return NextResponse.json(
      { error: "还没有配置 GEMINI_API_KEY。请先写入 .env.local，再进行视觉分析。" },
      { status: 409 },
    );
  }

  try {
    const analyzedFrames = [];
    const warnings: Array<{ frameId: string; timestampSec: number; error: string }> = [];

    for (const frame of detail.frames) {
      try {
        const analysis = await analyzeFrameWithGemini(frame);
        analyzedFrames.push(updateFrameAnalysis(frame.id, analysis));
      } catch (error) {
        const message = error instanceof Error ? error.message : "单帧视觉分析失败。";
        warnings.push({ frameId: frame.id, timestampSec: frame.timestampSec, error: message });
        analyzedFrames.push(updateFrameAnalysis(frame.id, fallbackAnalysis(message)));
      }
    }

    const asset =
      analyzedFrames.length > 0
        ? updateAssetStatus(detail.asset.id, "visual_understood")
        : markAssetFailed(detail.asset.id, "没有帧可以完成分析。");

    return NextResponse.json({
      asset,
      frames: analyzedFrames,
      warnings,
    });
  } catch (error) {
    const message =
      error instanceof GeminiVisionError || error instanceof Error
        ? error.message
        : "视觉分析失败。";
    const asset = markAssetFailed(detail.asset.id, message);

    return NextResponse.json({ asset, error: message }, { status: 500 });
  }
}

function fallbackAnalysis(message: string): FrameVisualAnalysis {
  return {
    summary: "视觉分析没有为这一帧返回可用内容。",
    visibleText: [],
    visualType: "other",
    informationDensity: 0,
    retentionReason: `视觉分析跳过：${message}`,
    onlyInVisual: [],
  };
}
