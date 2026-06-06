import { NextResponse } from "next/server";
import { fetchBilibiliMetadata } from "@/lib/bilibili/client";
import { parseBilibiliInput } from "@/lib/bilibili/parser";
import { applyAssetMetadata, createAsset, listAssets, markAssetFailed } from "@/lib/db/assets";

export async function GET() {
  return NextResponse.json({ assets: listAssets() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url?.trim();

  if (!url) {
    return NextResponse.json({ error: "Provide a Bilibili URL." }, { status: 400 });
  }

  const parsed = parseBilibiliInput(url);
  if (!parsed) {
    return NextResponse.json({ error: "Only public Bilibili URLs, BV ids, or av ids are supported." }, { status: 400 });
  }

  const createdAsset = createAsset(parsed.normalizedUrl);

  try {
    const metadata = await fetchBilibiliMetadata(parsed.normalizedUrl);
    const asset = applyAssetMetadata(createdAsset.id, metadata);

    return NextResponse.json({ assetId: asset.id, asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch Bilibili metadata.";
    const asset = markAssetFailed(createdAsset.id, message);

    return NextResponse.json({ assetId: asset.id, asset, warning: message }, { status: 202 });
  }
}
