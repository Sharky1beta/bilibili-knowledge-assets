import type { AssetDetail, KnowledgeItemInput } from "@/lib/db/assets";

type KnowledgeBuilderResponse = {
  items?: Array<{
    type?: unknown;
    content?: unknown;
    sourceSegmentIds?: unknown;
    sourceFrameIds?: unknown;
  }>;
  error?: {
    message?: string;
  };
};

export type KnowledgeBuildResult = {
  items: KnowledgeItemInput[];
  usedFallback: boolean;
  warning: string | null;
};

const defaultModel = "gemini-2.5-flash";
const allowedTypes = new Set(["fact", "claim", "visual_fact", "action_item", "term", "timeline"]);

export async function buildKnowledgeAsset(detail: AssetDetail): Promise<KnowledgeBuildResult> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      items: fallbackKnowledgeItems(detail),
      usedFallback: true,
      warning: "GEMINI_API_KEY is not configured; used deterministic knowledge extraction.",
    };
  }

  try {
    const items = await buildKnowledgeWithGemini(detail);
    return {
      items: items.length ? items : fallbackKnowledgeItems(detail),
      usedFallback: items.length === 0,
      warning: items.length ? null : "Gemini returned no structured items; used deterministic knowledge extraction.",
    };
  } catch (error) {
    return {
      items: fallbackKnowledgeItems(detail),
      usedFallback: true,
      warning: error instanceof Error ? error.message : "Gemini knowledge extraction failed.",
    };
  }
}

async function buildKnowledgeWithGemini(detail: AssetDetail) {
  const model = process.env.GEMINI_KNOWLEDGE_MODEL || process.env.GEMINI_VISION_MODEL || defaultModel;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: knowledgePrompt(detail),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.15,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as KnowledgeBuilderResponse | null;
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Gemini knowledge request failed with HTTP ${response.status}.`);
  }

  const text = payload?.items
    ? JSON.stringify(payload)
    : ((payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null)?.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("\n")
        .trim();

  if (!text) {
    throw new Error("Gemini returned no knowledge extraction text.");
  }

  return normalizeKnowledgeItems(parseJson(text));
}

function knowledgePrompt(detail: AssetDetail) {
  const { asset, frames, segments } = detail;
  const compactFrames = frames
    .slice()
    .sort((a, b) => b.informationDensity - a.informationDensity)
    .slice(0, 12)
    .map((frame) => ({
      id: frame.id,
      timestampSec: frame.timestampSec,
      visualType: frame.visualType,
      informationDensity: frame.informationDensity,
      summary: frame.summary,
      visibleText: frame.visibleText.slice(0, 8),
      onlyInVisual: frame.onlyInVisual.slice(0, 8),
      retentionReason: frame.retentionReason,
    }));

  const compactSegments = segments.slice(0, 20).map((segment) => ({
    id: segment.id,
    startSec: segment.startSec,
    endSec: segment.endSec,
    text: segment.text,
    summary: segment.summary,
  }));

  return `
You are building a reusable knowledge asset from a Bilibili video.

Return strict JSON only:
{
  "items": [
    {
      "type": "fact|claim|visual_fact|action_item|term|timeline",
      "content": "clear reusable knowledge statement",
      "sourceSegmentIds": ["segment ids that support the statement"],
      "sourceFrameIds": ["frame ids that support the statement"]
    }
  ]
}

Rules:
- Create 6-12 high-signal items.
- Prefer visual_fact when the evidence depends on screenshot content, visible text, charts, tables, diagrams, code, or other visual-only facts.
- Every item must cite at least one sourceSegmentId or sourceFrameId when possible.
- Do not invent facts that are not grounded in the provided metadata, segments, or frame analyses.
- Use concise Simplified Chinese for every item content.

Asset metadata:
${JSON.stringify({
  id: asset.id,
  title: asset.title,
  description: asset.description,
  ownerName: asset.ownerName,
  duration: asset.duration,
  tags: asset.tags,
}, null, 2)}

Transcript segments:
${JSON.stringify(compactSegments, null, 2)}

Visual frame analyses:
${JSON.stringify(compactFrames, null, 2)}
`.trim();
}

function fallbackKnowledgeItems(detail: AssetDetail): KnowledgeItemInput[] {
  const items: KnowledgeItemInput[] = [];
  const { asset, frames, segments } = detail;
  const firstSegment = segments[0]?.id ? [segments[0].id] : [];

  items.push({
    type: "fact",
    content: `视频资产标题为《${asset.title}》${asset.ownerName ? `，UP 主是 ${asset.ownerName}` : ""}。`,
    sourceSegmentIds: firstSegment,
    sourceFrameIds: [],
  });

  if (asset.description) {
    items.push({
      type: "claim",
      content: summarizeSentence(asset.description),
      sourceSegmentIds: firstSegment,
      sourceFrameIds: [],
    });
  }

  const rankedFrames = frames
    .filter((frame) => frame.informationDensity >= 0.35 || frame.onlyInVisual.length > 0 || frame.visibleText.length > 0)
    .sort((a, b) => b.informationDensity - a.informationDensity)
    .slice(0, 8);

  for (const frame of rankedFrames) {
    const visualFact = frame.onlyInVisual[0] || frame.visibleText[0] || frame.summary;
    items.push({
      type: "visual_fact",
      content: `${formatTime(frame.timestampSec)} 的视觉证据：${visualFact}`,
      sourceSegmentIds: [],
      sourceFrameIds: [frame.id],
    });
  }

  for (const segment of segments.slice(0, 4)) {
    items.push({
      type: "timeline",
      content: `${formatTime(segment.startSec)}-${formatTime(segment.endSec)} 的文本线索：${segment.summary || summarizeSentence(segment.text)}`,
      sourceSegmentIds: [segment.id],
      sourceFrameIds: [],
    });
  }

  return items.slice(0, 12);
}

function parseJson(text: string) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenceMatch?.[1] ?? trimmed;

  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(jsonText.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    }

    throw new Error("Gemini returned invalid JSON for knowledge extraction.");
  }
}

function normalizeKnowledgeItems(raw: Record<string, unknown>): KnowledgeItemInput[] {
  if (!Array.isArray(raw.items)) {
    return [];
  }

  return raw.items
    .map((item) => {
      const record = item as Record<string, unknown>;
      const type = typeof record.type === "string" && allowedTypes.has(record.type) ? record.type : "fact";
      const content = typeof record.content === "string" ? record.content.trim() : "";
      return {
        type,
        content,
        sourceSegmentIds: stringArray(record.sourceSegmentIds),
        sourceFrameIds: stringArray(record.sourceFrameIds),
      };
    })
    .filter((item) => item.content)
    .slice(0, 12);
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function summarizeSentence(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function formatTime(seconds: number) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const rest = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
