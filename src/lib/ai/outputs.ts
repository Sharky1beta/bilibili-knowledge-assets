import type { AssetDetail } from "@/lib/db/assets";
import type { OutputMode } from "@/lib/types";

export type Citation = {
  assetId: string;
  assetTitle: string;
  kind: "frame" | "segment";
  sourceId: string;
  timestampSec: number | null;
  imagePath?: string;
};

export type IllustratedSummaryContent = {
  mode: "illustrated_summary";
  title: string;
  takeaway: string;
  keyFacts: Array<{
    text: string;
    citations: Citation[];
  }>;
  sections: Array<{
    heading: string;
    summary: string;
    imagePath: string | null;
    timestampSec: number | null;
    citations: Citation[];
  }>;
  actionSuggestions: string[];
};

export type EvidenceCardsContent = {
  mode: "evidence_cards";
  title: string;
  cards: Array<{
    claim: string;
    evidenceType: "visual-only" | "transcript-only" | "mixed";
    explanation: string;
    imagePath: string | null;
    timestampSec: number | null;
    visibleEvidence: string[];
    citations: Citation[];
  }>;
};

export type MultiVideoSynthesisContent = {
  mode: "multi_video_synthesis";
  title: string;
  commonThemes: string[];
  uniqueEvidence: Array<{
    assetTitle: string;
    points: string[];
    citations: Citation[];
  }>;
  synthesis: string;
  openQuestions: string[];
};

export type GeneratedContent = IllustratedSummaryContent | EvidenceCardsContent | MultiVideoSynthesisContent;

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const defaultModel = "gemini-2.5-flash";

export async function generateOutputContent(
  mode: OutputMode,
  details: AssetDetail[],
  prompt: string,
): Promise<{ content: GeneratedContent; usedFallback: boolean; warning: string | null }> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      content: fallbackGeneratedContent(mode, details, prompt),
      usedFallback: true,
      warning: "GEMINI_API_KEY is not configured; used deterministic output rendering.",
    };
  }

  try {
    const content = await generateWithGemini(mode, details, prompt);
    return { content, usedFallback: false, warning: null };
  } catch (error) {
    return {
      content: fallbackGeneratedContent(mode, details, prompt),
      usedFallback: true,
      warning: error instanceof Error ? error.message : "Gemini output generation failed.",
    };
  }
}

async function generateWithGemini(mode: OutputMode, details: AssetDetail[], prompt: string) {
  const model = process.env.GEMINI_OUTPUT_MODEL || process.env.GEMINI_KNOWLEDGE_MODEL || defaultModel;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: outputPrompt(mode, details, prompt) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.25,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Gemini output request failed with HTTP ${response.status}.`);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  if (!text) {
    throw new Error("Gemini returned no generated output text.");
  }

  return normalizeGeneratedContent(mode, parseJson(text), details, prompt);
}

function outputPrompt(mode: OutputMode, details: AssetDetail[], prompt: string) {
  return `
You are generating a reusable output from pre-built video knowledge assets. The video has already been processed; do not ask to reprocess it.

User focus:
${prompt || "No extra focus."}

Return strict JSON only for mode "${mode}".

For illustrated_summary:
{
  "title": "string",
  "takeaway": "string",
  "keyFacts": [{"text":"string","citationKeys":["assetId:frameId or assetId:segmentId"]}],
  "sections": [{"heading":"string","summary":"string","imageKey":"assetId:frameId","citationKeys":["assetId:frameId"]}],
  "actionSuggestions": ["string"]
}

For evidence_cards:
{
  "title": "string",
  "cards": [{"claim":"string","evidenceType":"visual-only|transcript-only|mixed","explanation":"string","imageKey":"assetId:frameId","visibleEvidence":["string"],"citationKeys":["assetId:frameId"]}]
}

For multi_video_synthesis:
{
  "title": "string",
  "commonThemes": ["string"],
  "uniqueEvidence": [{"assetTitle":"string","points":["string"],"citationKeys":["assetId:frameId or assetId:segmentId"]}],
  "synthesis": "string",
  "openQuestions": ["string"]
}

Rules:
- Ground every claim in supplied knowledge items, frame analyses, or transcript segments.
- Prefer visual citations when visual evidence exists.
- Use citation keys exactly as provided.
- Keep output concise and demo-friendly.

Available assets:
${JSON.stringify(compactAssets(details), null, 2)}
`.trim();
}

function compactAssets(details: AssetDetail[]) {
  return details.map((detail) => ({
    assetId: detail.asset.id,
    title: detail.asset.title,
    status: detail.asset.status,
    knowledgeItems: detail.knowledgeItems.map((item) => ({
      id: item.id,
      type: item.type,
      content: item.content,
      citationKeys: [
        ...item.sourceFrameIds.map((frameId) => `${detail.asset.id}:${frameId}`),
        ...item.sourceSegmentIds.map((segmentId) => `${detail.asset.id}:${segmentId}`),
      ],
    })),
    frames: detail.frames
      .slice()
      .sort((a, b) => b.informationDensity - a.informationDensity)
      .slice(0, 10)
      .map((frame) => ({
        key: `${detail.asset.id}:${frame.id}`,
        timestampSec: frame.timestampSec,
        imagePath: frame.imagePath,
        summary: frame.summary,
        visibleText: frame.visibleText,
        visualType: frame.visualType,
        informationDensity: frame.informationDensity,
        onlyInVisual: frame.onlyInVisual,
      })),
    segments: detail.segments.slice(0, 10).map((segment) => ({
      key: `${detail.asset.id}:${segment.id}`,
      startSec: segment.startSec,
      endSec: segment.endSec,
      text: segment.text,
      summary: segment.summary,
    })),
  }));
}

function fallbackGeneratedContent(mode: OutputMode, details: AssetDetail[], prompt: string): GeneratedContent {
  if (mode === "evidence_cards") {
    return fallbackEvidenceCards(details, prompt);
  }

  if (mode === "multi_video_synthesis") {
    return fallbackMultiVideoSynthesis(details, prompt);
  }

  return fallbackIllustratedSummary(details, prompt);
}

function fallbackIllustratedSummary(details: AssetDetail[], prompt: string): IllustratedSummaryContent {
  const facts = details.flatMap((detail) =>
    detail.knowledgeItems.slice(0, 6).map((item) => ({
      text: item.content,
      citations: citationsForItem(detail, item.sourceFrameIds, item.sourceSegmentIds),
    })),
  );

  const sections = details.flatMap((detail) =>
    rankedFrames(detail).slice(0, 4).map((frame) => ({
      heading: frame.visualType === "other" ? detail.asset.title : `${titleCase(frame.visualType)} evidence`,
      summary: frame.summary,
      imagePath: frame.imagePath,
      timestampSec: frame.timestampSec,
      citations: [frameCitation(detail, frame.id)].filter(Boolean) as Citation[],
    })),
  );

  return {
    mode: "illustrated_summary",
    title: prompt ? `Illustrated summary: ${prompt}` : "Illustrated summary",
    takeaway: facts[0]?.text || "This output reuses stored knowledge items and visual citations without reprocessing the video.",
    keyFacts: facts.length ? facts : fallbackFactRows(details),
    sections,
    actionSuggestions: [
      "Inspect the cited frames before reusing visual-only facts.",
      "Generate Evidence Cards from the same asset to review source-level support.",
      "Add another processed asset to compare recurring themes.",
    ],
  };
}

function fallbackEvidenceCards(details: AssetDetail[], prompt: string): EvidenceCardsContent {
  return {
    mode: "evidence_cards",
    title: prompt ? `Evidence cards: ${prompt}` : "Evidence cards",
    cards: details.flatMap((detail) => {
      const visualItems = detail.knowledgeItems.filter((item) => item.type === "visual_fact");
      const sourceItems = visualItems.length ? visualItems : detail.knowledgeItems;

      return sourceItems.slice(0, 8).map((item) => {
        const frame = item.sourceFrameIds[0] ? detail.frames.find((candidate) => candidate.id === item.sourceFrameIds[0]) : undefined;
        return {
          claim: item.content,
          evidenceType: item.sourceFrameIds.length && item.sourceSegmentIds.length
            ? "mixed"
            : item.sourceFrameIds.length
              ? "visual-only"
              : "transcript-only",
          explanation: frame?.summary || item.content,
          imagePath: frame?.imagePath ?? null,
          timestampSec: frame?.timestampSec ?? null,
          visibleEvidence: frame?.visibleText ?? [],
          citations: citationsForItem(detail, item.sourceFrameIds, item.sourceSegmentIds),
        };
      });
    }),
  };
}

function fallbackMultiVideoSynthesis(details: AssetDetail[], prompt: string): MultiVideoSynthesisContent {
  return {
    mode: "multi_video_synthesis",
    title: prompt ? `Multi-video synthesis: ${prompt}` : "Multi-video synthesis",
    commonThemes: [
      "The selected outputs are produced from stored knowledge items rather than reprocessing source videos.",
      "Visual citations preserve screenshots, timestamps, and frame-level evidence.",
      details.length > 1 ? "Cross-asset comparison can group unique evidence by source video." : "Add more assets to demonstrate stronger cross-video synthesis.",
    ],
    uniqueEvidence: details.map((detail) => ({
      assetTitle: detail.asset.title,
      points: detail.knowledgeItems.slice(0, 4).map((item) => item.content),
      citations: detail.knowledgeItems
        .slice(0, 4)
        .flatMap((item) => citationsForItem(detail, item.sourceFrameIds, item.sourceSegmentIds))
        .slice(0, 6),
    })),
    synthesis: details
      .map((detail) => `${detail.asset.title}: ${detail.knowledgeItems[0]?.content || detail.frames[0]?.summary || "stored asset is available for reuse"}`)
      .join(" "),
    openQuestions: [
      "Which visual facts should be promoted into the final recording script?",
      "Do any cited frames need manual pruning before submission?",
    ],
  };
}

function normalizeGeneratedContent(
  mode: OutputMode,
  raw: Record<string, unknown>,
  details: AssetDetail[],
  prompt: string,
): GeneratedContent {
  if (mode === "evidence_cards") {
    const fallback = fallbackEvidenceCards(details, prompt);
    return {
      mode,
      title: stringOrFallback(raw.title, fallback.title),
      cards: arrayOfRecords(raw.cards).map((card) => {
        const citations = citationsForKeys(details, stringArray(card.citationKeys));
        const imageCitation = citationForKey(details, stringOrNull(card.imageKey));
        const primaryCitation = ensureCitations(details, imageCitation ? [imageCitation, ...citations] : citations);
        return {
          claim: stringOrFallback(card.claim, "Evidence card"),
          evidenceType: normalizeEvidenceType(card.evidenceType),
          explanation: stringOrFallback(card.explanation, "This claim is grounded in the cited source."),
          imagePath: imageCitation?.imagePath ?? null,
          timestampSec: imageCitation?.timestampSec ?? null,
          visibleEvidence: stringArray(card.visibleEvidence),
          citations: dedupeCitations(primaryCitation),
        };
      }).filter((card) => card.citations.length || card.claim).slice(0, 10) || fallback.cards,
    };
  }

  if (mode === "multi_video_synthesis") {
    const fallback = fallbackMultiVideoSynthesis(details, prompt);
    return {
      mode,
      title: stringOrFallback(raw.title, fallback.title),
      commonThemes: stringArray(raw.commonThemes).slice(0, 8),
      uniqueEvidence: arrayOfRecords(raw.uniqueEvidence).map((item) => ({
        assetTitle: stringOrFallback(item.assetTitle, "Source asset"),
        points: stringArray(item.points).slice(0, 6),
        citations: citationsForKeys(details, stringArray(item.citationKeys)).slice(0, 8),
      })).slice(0, 8),
      synthesis: stringOrFallback(raw.synthesis, fallback.synthesis),
      openQuestions: stringArray(raw.openQuestions).slice(0, 6),
    };
  }

  const fallback = fallbackIllustratedSummary(details, prompt);
  return {
    mode,
    title: stringOrFallback(raw.title, fallback.title),
    takeaway: stringOrFallback(raw.takeaway, fallback.takeaway),
    keyFacts: arrayOfRecords(raw.keyFacts).map((fact) => ({
      text: stringOrFallback(fact.text, "Key fact"),
      citations: ensureCitations(details, citationsForKeys(details, stringArray(fact.citationKeys))),
    })).filter((fact) => fact.text).slice(0, 10),
    sections: arrayOfRecords(raw.sections).map((section) => {
      const imageCitation = citationForKey(details, stringOrNull(section.imageKey));
      const citations = ensureCitations(details, dedupeCitations([
        ...(imageCitation ? [imageCitation] : []),
        ...citationsForKeys(details, stringArray(section.citationKeys)),
      ]));
      return {
        heading: stringOrFallback(section.heading, "Illustrated section"),
        summary: stringOrFallback(section.summary, "This section is grounded in stored visual evidence."),
        imagePath: imageCitation?.imagePath ?? null,
        timestampSec: imageCitation?.timestampSec ?? null,
        citations,
      };
    }).slice(0, 8),
    actionSuggestions: stringArray(raw.actionSuggestions).slice(0, 6),
  };
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
    throw new Error("Gemini returned invalid JSON for output generation.");
  }
}

function rankedFrames(detail: AssetDetail) {
  return detail.frames.slice().sort((a, b) => b.informationDensity - a.informationDensity);
}

function citationsForItem(detail: AssetDetail, frameIds: string[], segmentIds: string[]) {
  return [
    ...frameIds.map((frameId) => frameCitation(detail, frameId)).filter(Boolean),
    ...segmentIds.map((segmentId) => segmentCitation(detail, segmentId)).filter(Boolean),
  ] as Citation[];
}

function frameCitation(detail: AssetDetail, frameId: string): Citation | null {
  const frame = detail.frames.find((item) => item.id === frameId);
  if (!frame) {
    return null;
  }

  return {
    assetId: detail.asset.id,
    assetTitle: detail.asset.title,
    kind: "frame",
    sourceId: frame.id,
    timestampSec: frame.timestampSec,
    imagePath: frame.imagePath,
  };
}

function segmentCitation(detail: AssetDetail, segmentId: string): Citation | null {
  const segment = detail.segments.find((item) => item.id === segmentId);
  if (!segment) {
    return null;
  }

  return {
    assetId: detail.asset.id,
    assetTitle: detail.asset.title,
    kind: "segment",
    sourceId: segment.id,
    timestampSec: segment.startSec,
  };
}

function citationForKey(details: AssetDetail[], key: string | null) {
  if (!key) {
    return null;
  }
  const [assetId, sourceId] = key.split(":");
  const detail = details.find((item) => item.asset.id === assetId);
  if (!detail || !sourceId) {
    return null;
  }
  return frameCitation(detail, sourceId) || segmentCitation(detail, sourceId);
}

function citationsForKeys(details: AssetDetail[], keys: string[]) {
  return dedupeCitations(keys.map((key) => citationForKey(details, key)).filter(Boolean) as Citation[]);
}

function dedupeCitations(citations: Citation[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.assetId}:${citation.sourceId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function ensureCitations(details: AssetDetail[], citations: Citation[]) {
  if (citations.length) {
    return dedupeCitations(citations);
  }

  const fallback = details
    .map((detail) => detail.frames[0] ? frameCitation(detail, detail.frames[0].id) : detail.segments[0] ? segmentCitation(detail, detail.segments[0].id) : null)
    .find(Boolean);

  return fallback ? [fallback] : [];
}

function fallbackFactRows(details: AssetDetail[]) {
  return details.map((detail) => ({
    text: `${detail.asset.title} is available as a reusable stored asset.`,
    citations: detail.frames[0] ? [frameCitation(detail, detail.frames[0].id)].filter(Boolean) as Citation[] : [],
  }));
}

function arrayOfRecords(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEvidenceType(value: unknown): EvidenceCardsContent["cards"][number]["evidenceType"] {
  return value === "visual-only" || value === "transcript-only" || value === "mixed" ? value : "visual-only";
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
