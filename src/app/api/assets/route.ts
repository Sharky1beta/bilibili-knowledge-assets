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
    return NextResponse.json({ error: "请提供 B 站视频 URL。" }, { status: 400 });
  }

  const parsed = parseBilibiliInput(url);
  if (!parsed) {
    return NextResponse.json({ error: "仅支持公开 B 站 URL、BV 号或 av 号。" }, { status: 400 });
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
    const message = error instanceof Error ? error.message : "获取 B 站元数据失败。";
    const asset = markAssetFailed(createdAsset.id, message);

    return NextResponse.json({ assetId: asset.id, asset, reused: false, warning: message }, { status: 202 });
  }
}

function reusedAssetResponse(asset: NonNullable<ReturnType<typeof findAssetByBvid>>) {
  return NextResponse.json({
    assetId: asset.id,
    asset,
    reused: true,
    message: "这个 B 站来源已经存在。本次直接复用已保存资产，不重新处理视频。",
  });
}
