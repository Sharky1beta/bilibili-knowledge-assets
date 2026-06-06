const hotWords = [
  "高能",
  "前方",
  "名场面",
  "泪目",
  "哈哈",
  "啊啊",
  "草",
  "卧槽",
  "牛",
  "666",
  "破防",
  "来了",
];

export type DanmakuHotspot = {
  timestampSec: number;
  heat: number;
  count: number;
};

type DanmakuRow = {
  timestampSec: number;
  text: string;
};

export async function fetchDanmakuHotspots(options: {
  cid: number;
  durationSec: number | null;
  binSizeSec?: number;
  top?: number;
}): Promise<DanmakuHotspot[]> {
  const binSizeSec = options.binSizeSec ?? 10;
  const top = options.top ?? 6;
  const durationSec = Math.max(1, Math.floor(options.durationSec ?? 8 * 60));
  const response = await fetch(`https://comment.bilibili.com/${options.cid}.xml`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      Referer: "https://www.bilibili.com/",
      Accept: "application/xml,text/xml,*/*",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const rows = parseDanmakuRows(await response.text());
  if (!rows.length) {
    return [];
  }

  const { xs, raw, heat } = buildHeatCurve(rows, durationSec, binSizeSec);
  return findPeaks(heat)
    .sort((a, b) => heat[b] - heat[a])
    .slice(0, top)
    .map((index) => ({
      timestampSec: Math.max(1, Math.round(xs[index])),
      heat: heat[index],
      count: raw[index],
    }));
}

function parseDanmakuRows(xml: string): DanmakuRow[] {
  const rows: DanmakuRow[] = [];
  const regex = /<d\s+[^>]*p="([^"]+)"[^>]*>([\s\S]*?)<\/d>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml))) {
    const timestampSec = Number(match[1].split(",")[0]);
    const text = decodeXml(match[2]).trim();

    if (Number.isFinite(timestampSec) && text) {
      rows.push({ timestampSec, text });
    }
  }

  return rows;
}

function buildHeatCurve(rows: DanmakuRow[], durationSec: number, binSizeSec: number) {
  const bucketCount = Math.max(1, Math.ceil(durationSec / binSizeSec));
  const raw = Array.from({ length: bucketCount }, () => 0);
  const weighted = Array.from({ length: bucketCount }, () => 0);

  for (const row of rows) {
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor(row.timestampSec / binSizeSec)));
    raw[index] += 1;
    weighted[index] += 1 + 1.8 * hotWords.filter((word) => row.text.includes(word)).length;
  }

  return {
    xs: Array.from({ length: bucketCount }, (_, index) => index * binSizeSec + binSizeSec / 2),
    raw,
    heat: smooth(weighted),
  };
}

function findPeaks(values: number[]) {
  if (!values.length) {
    return [];
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  const standardDeviation = Math.sqrt(variance) || 1;
  const threshold = average + 1.15 * standardDeviation;
  const peaks: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const left = index > 0 ? values[index - 1] : -1;
    const right = index + 1 < values.length ? values[index + 1] : -1;
    if (values[index] >= threshold && values[index] >= left && values[index] >= right) {
      peaks.push(index);
    }
  }

  return peaks;
}

function smooth(values: number[], radius = 2) {
  return values.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length, index + radius + 1);
    const window = values.slice(start, end);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });
}

function decodeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
