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
    return NextResponse.json({ error: "Select at least one asset." }, { status: 400 });
  }

  if (!mode || !modes.has(mode)) {
    return NextResponse.json({ error: "Unsupported output mode." }, { status: 400 });
  }

  const details = assetIds.map(getAssetDetail);
  if (details.some((detail) => !detail)) {
    return NextResponse.json({ error: "One or more assets were not found." }, { status: 404 });
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
      message: "No video reprocessing was performed. This run reused stored metadata, frames, transcript segments, and knowledge items.",
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
