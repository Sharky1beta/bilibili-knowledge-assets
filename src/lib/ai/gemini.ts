import fs from "node:fs/promises";
import path from "node:path";
import type { Frame } from "@/lib/types";

export type FrameVisualAnalysis = {
  summary: string;
  visibleText: string[];
  visualType: "slide" | "chart" | "code" | "whiteboard" | "table" | "talking_head" | "diagram" | "other";
  informationDensity: number;
  retentionReason: string;
  onlyInVisual: string[];
};

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

export class GeminiVisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiVisionError";
  }
}

export function hasGeminiApiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function analyzeFrameWithGemini(frame: Frame): Promise<FrameVisualAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiVisionError("GEMINI_API_KEY is not configured. Add it to .env.local before visual analysis.");
  }

  const imagePath = resolvePublicPath(frame.imagePath);
  const imageBase64 = await fs.readFile(imagePath, { encoding: "base64" });
  const model = process.env.GEMINI_VISION_MODEL || defaultModel;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              text: frameAnalysisPrompt(frame),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;

  if (!response.ok || payload?.error) {
    throw new GeminiVisionError(payload?.error?.message || `Gemini vision request failed with HTTP ${response.status}.`);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  if (!text) {
    throw new GeminiVisionError("Gemini returned no visual analysis text.");
  }

  return normalizeAnalysis(parseJson(text));
}

function frameAnalysisPrompt(frame: Frame) {
  return `
You are analyzing a screenshot from a Bilibili long video at ${frame.timestampSec} seconds.

Candidate selection signal:
- source: ${frame.visualType}
- reason: ${frame.retentionReason}

Return strict JSON only, with this exact shape:
{
  "summary": "one sentence describing the visible content",
  "visibleText": ["important text visible in the image"],
  "visualType": "slide|chart|code|whiteboard|table|talking_head|diagram|other",
  "informationDensity": 0.0,
  "retentionReason": "why this frame should or should not be kept as evidence",
  "onlyInVisual": ["facts that appear visually and might not be spoken aloud"]
}

Scoring guidance:
- 0.0-0.2: mostly decorative, transition, blank, or repeated talking head.
- 0.3-0.5: some context but little reusable evidence.
- 0.6-0.8: meaningful slide, diagram, table, code, chart, formula, or whiteboard content.
- 0.9-1.0: dense visual evidence with numbers, claims, steps, code, or diagrams.

Prefer preserving frames with charts, tables, code, whiteboard derivations, formulas, visible numbers, diagrams, or slide conclusions.
Use the candidate signal as context, but make the final decision from visible evidence in the image.
`.trim();
}

function resolvePublicPath(publicPath: string) {
  const normalized = publicPath.replace(/^\//, "");
  return path.join(process.cwd(), "public", normalized);
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

    throw new GeminiVisionError("Gemini returned invalid JSON for visual analysis.");
  }
}

function normalizeAnalysis(raw: Record<string, unknown>): FrameVisualAnalysis {
  const visualType = normalizeVisualType(raw.visualType);
  const informationDensity = clampNumber(raw.informationDensity);

  return {
    summary: stringOrFallback(raw.summary, "Visual analysis did not include a summary."),
    visibleText: stringArray(raw.visibleText),
    visualType,
    informationDensity,
    retentionReason: stringOrFallback(raw.retentionReason, "Visual analysis did not include a retention reason."),
    onlyInVisual: stringArray(raw.onlyInVisual),
  };
}

function normalizeVisualType(value: unknown): FrameVisualAnalysis["visualType"] {
  const allowed = new Set<FrameVisualAnalysis["visualType"]>([
    "slide",
    "chart",
    "code",
    "whiteboard",
    "table",
    "talking_head",
    "diagram",
    "other",
  ]);
  return typeof value === "string" && allowed.has(value as FrameVisualAnalysis["visualType"])
    ? (value as FrameVisualAnalysis["visualType"])
    : "other";
}

function clampNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(1, number));
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
