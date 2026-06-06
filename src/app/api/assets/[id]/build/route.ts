import { NextResponse } from "next/server";
import { buildKnowledgeAsset } from "@/lib/ai/knowledge";
import { getAssetDetail, replaceKnowledgeItems, updateAssetStatus } from "@/lib/db/assets";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = getAssetDetail(id);

  if (!detail) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  if (!detail.frames.length && !detail.segments.length) {
    return NextResponse.json(
      { error: "Extract frames or transcript segments before building the knowledge asset." },
      { status: 409 },
    );
  }

  const result = await buildKnowledgeAsset(detail);
  const knowledgeItems = replaceKnowledgeItems(detail.asset.id, result.items);
  const asset = updateAssetStatus(detail.asset.id, "asset_built");

  return NextResponse.json({
    asset,
    knowledgeItems,
    usedFallback: result.usedFallback,
    warning: result.warning,
  });
}
