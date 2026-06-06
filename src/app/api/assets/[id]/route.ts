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
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
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
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const deleted = deleteAsset(id);
  await removeAssetPublicFiles(id);

  return NextResponse.json({ deleted, assetId: id });
}

async function removeAssetPublicFiles(assetId: string) {
  const assetsRoot = path.resolve(process.cwd(), "public", "assets");
  const assetDir = path.resolve(assetsRoot, assetId);

  if (!assetDir.startsWith(`${assetsRoot}${path.sep}`)) {
    throw new Error("Refusing to remove files outside public assets directory.");
  }

  await fs.rm(assetDir, { recursive: true, force: true });
}
