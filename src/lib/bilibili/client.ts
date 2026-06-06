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
    subtitle?: {
      list?: BilibiliSubtitleTrack[];
    };
  };
};

type BilibiliTagsResponse = {
  code: number;
  message: string;
  data?: Array<{
    tag_name?: string;
  }>;
};

type BilibiliPlayUrlResponse = {
  code: number;
  message: string;
  data?: {
    timelength?: number;
    durl?: Array<{
      url: string;
      backup_url?: string[];
    }>;
    dash?: {
      video?: Array<{
        baseUrl?: string;
        base_url?: string;
        backupUrl?: string[];
        backup_url?: string[];
      }>;
      audio?: Array<{
        baseUrl?: string;
        base_url?: string;
        backupUrl?: string[];
        backup_url?: string[];
      }>;
    };
  };
};

type BilibiliPlayerV2Response = {
  code: number;
  message: string;
  data?: {
    subtitle?: {
      subtitles?: BilibiliSubtitleTrack[];
    };
  };
};

type BilibiliSubtitleTrack = {
  id?: number;
  id_str?: string;
  lan?: string;
  lan_doc?: string;
  subtitle_url?: string;
  subtitle_url_v2?: string;
};

type BilibiliSubtitleResponse = {
  body?: Array<{
    from?: number;
    to?: number;
    content?: string;
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

export class BilibiliSubtitleTrackUnavailableError extends BilibiliError {
  constructor(public readonly tracks: BilibiliSubtitleTrack[]) {
    super("检测到 B 站官方字幕轨道，但接口没有返回可下载的字幕文件地址。");
    this.name = "BilibiliSubtitleTrackUnavailableError";
  }
}

export type BilibiliPlayUrl = {
  urls: string[];
  audioUrls: string[];
  referer: string;
  userAgent: string;
};

export type BilibiliSubtitleSegment = {
  startSec: number;
  endSec: number;
  text: string;
  summary: string | null;
};

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

export async function fetchBilibiliPlayUrl(asset: {
  aid: number | null;
  bvid: string | null;
  cid: number | null;
  url: string;
}): Promise<BilibiliPlayUrl> {
  if (!asset.cid || (!asset.bvid && !asset.aid)) {
    throw new BilibiliError("Cannot resolve play URL before metadata provides cid and bvid/aid.");
  }

  const params = new URLSearchParams({
    cid: String(asset.cid),
    qn: "16",
    fnval: "16",
    fnver: "0",
    fourk: "0",
  });

  if (asset.bvid) {
    params.set("bvid", asset.bvid);
  } else if (asset.aid) {
    params.set("avid", String(asset.aid));
  }

  const referer = asset.bvid ? `https://www.bilibili.com/video/${asset.bvid}` : asset.url;
  const response = await fetch(`https://api.bilibili.com/x/player/playurl?${params.toString()}`, {
    headers: bilibiliHeaders(referer),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new BilibiliError(`Bilibili playurl request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as BilibiliPlayUrlResponse;
  if (payload.code !== 0 || !payload.data) {
    throw new BilibiliError(payload.message || "Bilibili playurl request returned no data.", payload.code);
  }

  const urls = [
    ...(payload.data.durl?.flatMap((item) => [item.url, ...(item.backup_url ?? [])]) ?? []),
    ...(payload.data.dash?.video?.flatMap((item) => [
      item.baseUrl,
      item.base_url,
      ...(item.backupUrl ?? []),
      ...(item.backup_url ?? []),
    ]) ?? []),
  ].filter((url): url is string => Boolean(url));
  const audioUrls = [
    ...(payload.data.dash?.audio?.flatMap((item) => [
      item.baseUrl,
      item.base_url,
      ...(item.backupUrl ?? []),
      ...(item.backup_url ?? []),
    ]) ?? []),
    ...(payload.data.durl?.flatMap((item) => [item.url, ...(item.backup_url ?? [])]) ?? []),
  ].filter((url): url is string => Boolean(url));

  if (!urls.length) {
    throw new BilibiliError("No playable video stream was found for this asset.");
  }

  return {
    urls: Array.from(new Set(urls)),
    audioUrls: Array.from(new Set(audioUrls)),
    referer,
    userAgent: bilibiliUserAgent,
  };
}

export async function fetchBilibiliSubtitleSegments(asset: {
  aid: number | null;
  bvid: string | null;
  cid: number | null;
  url: string;
}): Promise<BilibiliSubtitleSegment[]> {
  if (!asset.cid || (!asset.bvid && !asset.aid)) {
    throw new BilibiliError("Cannot fetch subtitles before metadata provides cid and bvid/aid.");
  }

  const params = new URLSearchParams({ cid: String(asset.cid) });
  if (asset.bvid) {
    params.set("bvid", asset.bvid);
  } else if (asset.aid) {
    params.set("aid", String(asset.aid));
  }

  const referer = asset.bvid ? `https://www.bilibili.com/video/${asset.bvid}` : asset.url;
  const response = await fetch(`https://api.bilibili.com/x/player/v2?${params.toString()}`, {
    headers: bilibiliHeaders(referer),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new BilibiliError(`Bilibili subtitle metadata request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as BilibiliPlayerV2Response;
  if (payload.code !== 0 || !payload.data) {
    throw new BilibiliError(payload.message || "Bilibili subtitle metadata returned no data.", payload.code);
  }

  const tracks = await findSubtitleTracks(payload, asset, referer);
  const subtitle = preferredSubtitleTrack(tracks);
  if (!subtitle) {
    if (tracks.length) {
      throw new BilibiliSubtitleTrackUnavailableError(tracks);
    }
    return [];
  }

  const subtitleUrl = normalizeBilibiliResourceUrl(subtitle.subtitle_url || subtitle.subtitle_url_v2 || "");
  return fetchBilibiliSubtitleSegmentsFromUrl(subtitleUrl, referer);
}

export async function fetchBilibiliSubtitleSegmentsFromUrl(url: string, referer: string): Promise<BilibiliSubtitleSegment[]> {
  const subtitleUrl = normalizeBilibiliResourceUrl(url.trim());
  if (!subtitleUrl || !/^https?:\/\/.+\.json(?:\?|$)/i.test(subtitleUrl)) {
    throw new BilibiliError("请粘贴 B 站字幕 JSON 文件 URL。");
  }

  const subtitleResponse = await fetch(subtitleUrl, {
    headers: bilibiliHeaders(referer),
    cache: "no-store",
  });

  if (!subtitleResponse.ok) {
    throw new BilibiliError(`B 站字幕 JSON 请求失败，HTTP ${subtitleResponse.status}。`);
  }

  const subtitlePayload = (await subtitleResponse.json()) as BilibiliSubtitleResponse;
  return (subtitlePayload.body ?? [])
    .map((item) => ({
      startSec: Number(item.from),
      endSec: Number(item.to),
      text: item.content?.trim() ?? "",
      summary: null,
    }))
    .filter((item) => Number.isFinite(item.startSec) && Number.isFinite(item.endSec) && item.text);
}

async function findSubtitleTracks(
  playerPayload: BilibiliPlayerV2Response,
  asset: {
    aid: number | null;
    bvid: string | null;
    cid: number | null;
    url: string;
  },
  referer: string,
) {
  const playerTracks = playerPayload.data?.subtitle?.subtitles ?? [];
  const usablePlayerTracks = playerTracks.filter(isSubtitleTrack);
  if (usablePlayerTracks.some(hasSubtitleUrl)) {
    return usablePlayerTracks;
  }

  const viewTracks = await fetchSubtitleTracksFromView(asset, referer).catch(() => []);
  return mergeSubtitleTracks([...usablePlayerTracks, ...viewTracks]);
}

async function fetchSubtitleTracksFromView(
  asset: {
    aid: number | null;
    bvid: string | null;
    url: string;
  },
  referer: string,
) {
  const params = new URLSearchParams();
  if (asset.bvid) {
    params.set("bvid", asset.bvid);
  } else if (asset.aid) {
    params.set("aid", String(asset.aid));
  }

  const response = await fetch(`https://api.bilibili.com/x/web-interface/view?${params.toString()}`, {
    headers: bilibiliHeaders(referer),
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as BilibiliViewResponse;
  if (payload.code !== 0 || !payload.data) {
    return [];
  }

  return (payload.data.subtitle?.list ?? []).filter(isSubtitleTrack);
}

function preferredSubtitleTrack(tracks: BilibiliSubtitleTrack[]) {
  const tracksWithUrl = tracks.filter(hasSubtitleUrl);
  return (
    tracksWithUrl.find((track) => track.lan === "zh-CN" || track.lan === "zh") ??
    tracksWithUrl.find((track) => track.lan?.startsWith("zh")) ??
    tracksWithUrl[0] ??
    null
  );
}

function mergeSubtitleTracks(tracks: BilibiliSubtitleTrack[]) {
  const seen = new Set<string>();
  const merged: BilibiliSubtitleTrack[] = [];

  for (const track of tracks) {
    const key = track.id_str || String(track.id ?? "") || `${track.lan ?? ""}:${track.lan_doc ?? ""}`;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(track);
  }

  return merged;
}

function isSubtitleTrack(track: BilibiliSubtitleTrack) {
  return Boolean(track.id || track.id_str || track.lan || track.lan_doc || track.subtitle_url || track.subtitle_url_v2);
}

function hasSubtitleUrl(track: BilibiliSubtitleTrack) {
  return Boolean(track.subtitle_url || track.subtitle_url_v2);
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
  const headers: Record<string, string> = {
    "User-Agent": bilibiliUserAgent,
    Referer: referer,
    Accept: "application/json,text/plain,*/*",
  };

  if (process.env.BILIBILI_COOKIE) {
    headers.Cookie = process.env.BILIBILI_COOKIE;
  }

  return headers;
}

function normalizeBilibiliResourceUrl(url: string) {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  return url;
}

const bilibiliUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";
