import { parseBilibiliInput, type ParsedBilibiliInput } from "@/lib/bilibili/parser";

type BilibiliViewResponse = {
  code: number;
  message: string;
  data?: {
    bvid: string;
    aid: number;
    videos: number;
    tid?: number;
    tname?: string;
    pic?: string;
    title: string;
    pubdate?: number;
    desc?: string;
    duration: number;
    owner?: {
      name?: string;
    };
    cid?: number;
    pages?: Array<{
      cid: number;
      page: number;
      part: string;
      duration: number;
    }>;
  };
};

type BilibiliTagsResponse = {
  code: number;
  message: string;
  data?: Array<{
    tag_name?: string;
  }>;
};

export type BilibiliMetadata = {
  aid: number;
  bvid: string;
  cid: number | null;
  canonicalUrl: string;
  title: string;
  description: string | null;
  ownerName: string | null;
  duration: number;
  coverUrl: string | null;
  tags: string[];
  pageCount: number;
  pages: Array<{
    cid: number;
    page: number;
    part: string;
    duration: number;
  }>;
};

export class BilibiliError extends Error {
  constructor(
    message: string,
    public readonly causeCode?: number,
  ) {
    super(message);
    this.name = "BilibiliError";
  }
}

export async function fetchBilibiliMetadata(input: string): Promise<BilibiliMetadata> {
  const parsed = parseBilibiliInput(input);

  if (!parsed) {
    throw new BilibiliError("Provide a Bilibili BV id, av id, or video URL.");
  }

  const view = await fetchView(parsed);
  const tags = await fetchTags(view.bvid).catch(() => []);

  return {
    ...view,
    tags,
  };
}

async function fetchView(parsed: ParsedBilibiliInput): Promise<Omit<BilibiliMetadata, "tags">> {
  const params = new URLSearchParams();
  if (parsed.kind === "bvid") {
    params.set("bvid", parsed.bvid);
  } else {
    params.set("aid", String(parsed.aid));
  }

  const response = await fetch(`https://api.bilibili.com/x/web-interface/view?${params.toString()}`, {
    headers: bilibiliHeaders(parsed.normalizedUrl),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new BilibiliError(`Bilibili metadata request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as BilibiliViewResponse;

  if (payload.code !== 0 || !payload.data) {
    throw new BilibiliError(payload.message || "Bilibili metadata request returned no data.", payload.code);
  }

  const firstPage = payload.data.pages?.[0] ?? null;
  const cid = payload.data.cid ?? firstPage?.cid ?? null;

  return {
    aid: payload.data.aid,
    bvid: payload.data.bvid,
    cid,
    canonicalUrl: `https://www.bilibili.com/video/${payload.data.bvid}`,
    title: payload.data.title,
    description: payload.data.desc?.trim() || null,
    ownerName: payload.data.owner?.name ?? null,
    duration: payload.data.duration,
    coverUrl: payload.data.pic ?? null,
    pageCount: payload.data.videos || payload.data.pages?.length || 1,
    pages:
      payload.data.pages?.map((page) => ({
        cid: page.cid,
        page: page.page,
        part: page.part,
        duration: page.duration,
      })) ?? [],
  };
}

async function fetchTags(bvid: string): Promise<string[]> {
  const params = new URLSearchParams({ bvid });
  const response = await fetch(`https://api.bilibili.com/x/tag/archive/tags?${params.toString()}`, {
    headers: bilibiliHeaders(`https://www.bilibili.com/video/${bvid}`),
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as BilibiliTagsResponse;
  if (payload.code !== 0 || !payload.data) {
    return [];
  }

  return payload.data
    .map((tag) => tag.tag_name?.trim())
    .filter((tag): tag is string => Boolean(tag));
}

function bilibiliHeaders(referer: string) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
    Referer: referer,
    Accept: "application/json,text/plain,*/*",
  };
}
