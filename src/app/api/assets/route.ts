import { NextResponse } from "next/server";
import { createAsset, listAssets } from "@/lib/db/assets";

export async function GET() {
  return NextResponse.json({ assets: listAssets() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url?.trim();

  if (!url) {
    return NextResponse.json({ error: "Provide a Bilibili URL." }, { status: 400 });
  }

  if (!url.includes("bilibili.com") && !/^BV[a-zA-Z0-9]+$/.test(url)) {
    return NextResponse.json({ error: "Only public Bilibili URLs or BV ids are supported." }, { status: 400 });
  }

  const normalizedUrl = /^BV[a-zA-Z0-9]+$/.test(url) ? `https://www.bilibili.com/video/${url}` : url;
  const asset = createAsset(normalizedUrl);

  return NextResponse.json({ assetId: asset.id, asset });
}
