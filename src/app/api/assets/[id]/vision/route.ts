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
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  if (!detail.frames.length) {
    return NextResponse.json({ error: "Extract candidate frames before running visual analysis." }, { status: 409 });
  }

  if (!hasGeminiApiKey()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured. Add it to .env.local before visual analysis." },
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
        const message = error instanceof Error ? error.message : "Frame visual analysis failed.";
        warnings.push({ frameId: frame.id, timestampSec: frame.timestampSec, error: message });
        analyzedFrames.push(updateFrameAnalysis(frame.id, fallbackAnalysis(message)));
      }
    }

    const asset =
      analyzedFrames.length > 0
        ? updateAssetStatus(detail.asset.id, "visual_understood")
        : markAssetFailed(detail.asset.id, "No frames could be analyzed.");

    return NextResponse.json({
      asset,
      frames: analyzedFrames,
      warnings,
    });
  } catch (error) {
    const message =
      error instanceof GeminiVisionError || error instanceof Error
        ? error.message
        : "Visual analysis failed.";
    const asset = markAssetFailed(detail.asset.id, message);

    return NextResponse.json({ asset, error: message }, { status: 500 });
  }
}

function fallbackAnalysis(message: string): FrameVisualAnalysis {
  return {
    summary: "Visual analysis did not return usable content for this frame.",
    visibleText: [],
    visualType: "other",
    informationDensity: 0,
    retentionReason: `Skipped by visual analyzer: ${message}`,
    onlyInVisual: [],
  };
}
