import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { deleteAsset, getAssetDetail } from "@/lib/db/assets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = getAssetDetail(id);

  if (!detail) {
    return NextResponse.json({ error: "资产不存在。" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = getAssetDetail(id);

  if (!detail) {
    return NextResponse.json({ error: "资产不存在。" }, { status: 404 });
  }

  const deleted = deleteAsset(id);
  await removeAssetPublicFiles(id);

  return NextResponse.json({ deleted, assetId: id });
}

async function removeAssetPublicFiles(assetId: string) {
  const assetsRoot = path.resolve(process.cwd(), "public", "assets");
  const assetDir = path.resolve(assetsRoot, assetId);

  if (!assetDir.startsWith(`${assetsRoot}${path.sep}`)) {
    throw new Error("拒绝删除 public/assets 目录之外的文件。");
  }

  await fs.rm(assetDir, { recursive: true, force: true });
}
