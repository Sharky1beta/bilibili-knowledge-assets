export type ParsedBilibiliInput =
  | {
      kind: "bvid";
      bvid: string;
      normalizedUrl: string;
    }
  | {
      kind: "aid";
      aid: number;
      normalizedUrl: string;
    };

const bvidPattern = /BV[a-zA-Z0-9]{6,}/;
const aidPattern = /(?:^|\/|av)(av)?(\d{3,})/i;

export function parseBilibiliInput(input: string): ParsedBilibiliInput | null {
  const value = input.trim();

  if (!value) {
    return null;
  }

  const bvid = value.match(bvidPattern)?.[0];
  if (bvid) {
    return {
      kind: "bvid",
      bvid,
      normalizedUrl: `https://www.bilibili.com/video/${bvid}`,
    };
  }

  const aidMatch = value.match(aidPattern);
  const aid = aidMatch?.[2] ? Number(aidMatch[2]) : null;
  if (aid && Number.isFinite(aid)) {
    return {
      kind: "aid",
      aid,
      normalizedUrl: `https://www.bilibili.com/video/av${aid}`,
    };
  }

  return null;
}
