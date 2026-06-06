import { NextResponse } from "next/server";
import { fetchBilibiliMetadata } from "@/lib/bilibili/client";
import { parseBilibiliInput } from "@/lib/bilibili/parser";
import {
  applyAssetMetadata,
  createAsset,
  findAssetByAid,
  findAssetByBvid,
  findAssetBySourceIdentity,
  listAssets,
  markAssetFailed,
} from "@/lib/db/assets";

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

  const existingFromInput = parsed.kind === "bvid" ? findAssetByBvid(parsed.bvid) : findAssetByAid(parsed.aid);
  if (existingFromInput) {
    return reusedAssetResponse(existingFromInput);
  }

  try {
    const metadata = await fetchBilibiliMetadata(parsed.normalizedUrl);
    const existingFromMetadata = findAssetBySourceIdentity({
      bvid: metadata.bvid,
      aid: metadata.aid,
      cid: metadata.cid,
    });

    if (existingFromMetadata) {
      return reusedAssetResponse(existingFromMetadata);
    }

    const createdAsset = createAsset(parsed.normalizedUrl);
    const asset = applyAssetMetadata(createdAsset.id, metadata);

    return NextResponse.json({ assetId: asset.id, asset, reused: false });
  } catch (error) {
    const createdAsset = createAsset(parsed.normalizedUrl);
    const message = error instanceof Error ? error.message : "Failed to fetch Bilibili metadata.";
    const asset = markAssetFailed(createdAsset.id, message);

    return NextResponse.json({ assetId: asset.id, asset, reused: false, warning: message }, { status: 202 });
  }
}

function reusedAssetResponse(asset: NonNullable<ReturnType<typeof findAssetByBvid>>) {
  return NextResponse.json({
    assetId: asset.id,
    asset,
    reused: true,
    message: "This Bilibili source already exists. Reusing the saved asset without reprocessing.",
  });
}
