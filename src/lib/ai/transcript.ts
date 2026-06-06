import fs from "node:fs/promises";
import type { Asset } from "@/lib/types";

export type TranscriptSegmentInput = {
  startSec: number;
  endSec: number;
  text: string;
  summary: string | null;
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

export async function transcribeAudioWithGemini(options: {
  asset: Asset;
  audioPath: string;
  mimeType: "audio/mpeg";
  durationSec: number;
  offsetSec?: number;
}): Promise<TranscriptSegmentInput[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackTranscript(options.asset, options.durationSec, options.offsetSec ?? 0);
  }

  const audioBase64 = await fs.readFile(options.audioPath, { encoding: "base64" });
  const model = process.env.GEMINI_TRANSCRIPT_MODEL || process.env.GEMINI_VISION_MODEL || defaultModel;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    signal: AbortSignal.timeout(75_000),
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: options.mimeType,
                data: audioBase64,
              },
            },
            {
              text: transcriptPrompt(options.asset, options.durationSec, options.offsetSec ?? 0),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Gemini transcript request failed with HTTP ${response.status}.`);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  if (!text) {
    throw new Error("Gemini returned no transcript text.");
  }

  const segments = normalizeTranscriptSegments(parseJson(text), options.durationSec, options.offsetSec ?? 0);
  return segments.length ? segments : fallbackTranscript(options.asset, options.durationSec, options.offsetSec ?? 0);
}

function transcriptPrompt(asset: Asset, durationSec: number, offsetSec: number) {
  return `
You are transcribing an audio chunk from a full Bilibili long-video audio track.

Asset title: ${asset.title}
Asset description: ${asset.description ?? "No description."}
Chunk starts at ${offsetSec} seconds in the original video.
Chunk duration: ${durationSec} seconds.

Return strict JSON only:
{
  "segments": [
    {
      "startSec": 0,
      "endSec": 12.5,
      "text": "verbatim or close transcript text",
      "summary": "short summary of this segment"
    }
  ]
}

Rules:
- Produce timestamped segments in chronological order.
- Use timestamps relative to this chunk. The system will add the original-video offset.
- Use the spoken language you hear. Do not translate unless the audio itself switches language.
- Write summary in Simplified Chinese.
- Keep segments between 5 and 30 seconds when possible.
- If the audio is music or mostly non-speech, describe it as non-speech/music with timestamps.
- Do not invent named facts that are not audible.
`.trim();
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

    throw new Error("Gemini returned invalid JSON for transcript.");
  }
}

function normalizeTranscriptSegments(raw: Record<string, unknown>, durationSec: number, offsetSec: number): TranscriptSegmentInput[] {
  if (!Array.isArray(raw.segments)) {
    return [];
  }

  return raw.segments
    .map((item) => {
      const record = item as Record<string, unknown>;
      const startSec = clampTime(record.startSec, durationSec);
      const endSec = clampTime(record.endSec, durationSec);
      return {
        startSec: Math.min(startSec, endSec) + offsetSec,
        endSec: Math.max(startSec, endSec) + offsetSec,
        text: typeof record.text === "string" ? record.text.trim() : "",
        summary: typeof record.summary === "string" && record.summary.trim() ? record.summary.trim() : null,
      };
    })
    .filter((item) => item.text && item.endSec > item.startSec)
    .slice(0, 80);
}

function fallbackTranscript(asset: Asset, durationSec: number, offsetSec = 0): TranscriptSegmentInput[] {
  const text = asset.description?.trim() || asset.title;
  return [
    {
      startSec: offsetSec,
      endSec: offsetSec + Math.min(durationSec, 30),
      text,
      summary: "Fallback transcript segment derived from metadata because ASR was unavailable.",
    },
  ];
}

function clampTime(value: unknown, durationSec: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(durationSec, number));
}
