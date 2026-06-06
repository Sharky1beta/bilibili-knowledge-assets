import { NextResponse } from "next/server";
import { getAssetDetail, saveGeneratedOutput } from "@/lib/db/assets";
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

  const content = buildMockContent(
    mode,
    details.filter(Boolean) as NonNullable<ReturnType<typeof getAssetDetail>>[],
    prompt,
  );
  const output = saveGeneratedOutput(mode, assetIds, prompt, content);

  return NextResponse.json({ outputId: output.id, content });
}

function buildMockContent(
  mode: OutputMode,
  details: NonNullable<ReturnType<typeof getAssetDetail>>[],
  prompt: string,
) {
  if (mode === "evidence_cards") {
    return {
      mode,
      prompt,
      cards: details.flatMap((detail) =>
        detail.frames.map((frame) => ({
          claim: frame.onlyInVisual[0] ?? frame.summary,
          timestamp: frame.timestampSec,
          screenshot: frame.imagePath,
          visibleEvidence: frame.visibleText,
          explanation: frame.summary,
          source: detail.asset.title,
        })),
      ),
    };
  }

  if (mode === "multi_video_synthesis") {
    return {
      mode,
      prompt,
      commonThemes: ["Reusable memory", "Timestamped citations", "Visual evidence before generation"],
      sources: details.map((detail) => ({
        asset: detail.asset.title,
        citedFrames: detail.frames.map((frame) => ({
          timestamp: frame.timestampSec,
          reason: frame.retentionReason,
        })),
      })),
    };
  }

  return {
    mode,
    prompt,
    title: "Illustrated summary",
    takeaway: "The asset preserves transcript and visual evidence so outputs can be regenerated without reprocessing the video.",
    sections: details.map((detail) => ({
      source: detail.asset.title,
      keyFacts: detail.knowledgeItems.map((item) => item.content),
      illustrations: detail.frames.map((frame) => ({
        timestamp: frame.timestampSec,
        image: frame.imagePath,
        caption: frame.summary,
      })),
    })),
  };
}
