import type { TranscriptSegmentInput } from "@/lib/ai/transcript";
import type { Frame } from "@/lib/types";

export type TranscriptWindow = {
  startSec: number;
  endSec: number;
};

export const transcriptWindowRadiusSec = 20;

export function buildFrameTranscriptWindows(options: {
  frames: Frame[];
  durationSec: number | null;
  radiusSec?: number;
}): TranscriptWindow[] {
  const radiusSec = options.radiusSec ?? transcriptWindowRadiusSec;
  const durationSec = Math.max(1, Math.floor(options.durationSec ?? 0));
  const windows = options.frames
    .map((frame) => ({
      startSec: Math.max(0, Math.round(frame.timestampSec - radiusSec)),
      endSec: Math.max(1, Math.round(frame.timestampSec + radiusSec)),
    }))
    .map((window) => ({
      startSec: window.startSec,
      endSec: durationSec ? Math.min(durationSec, window.endSec) : window.endSec,
    }))
    .filter((window) => window.endSec > window.startSec)
    .sort((a, b) => a.startSec - b.startSec);

  return mergeWindows(windows);
}

export function filterSegmentsToWindows(
  segments: TranscriptSegmentInput[],
  windows: TranscriptWindow[],
): TranscriptSegmentInput[] {
  if (!windows.length) {
    return segments;
  }

  return segments
    .filter((segment) => windows.some((window) => segmentOverlapsWindow(segment, window)))
    .map((segment) => ({
      ...segment,
      summary: segment.summary ?? nearestWindowSummary(segment, windows),
    }));
}

function mergeWindows(windows: TranscriptWindow[]) {
  const merged: TranscriptWindow[] = [];

  for (const window of windows) {
    const previous = merged.at(-1);
    if (!previous || window.startSec > previous.endSec) {
      merged.push({ ...window });
      continue;
    }

    previous.endSec = Math.max(previous.endSec, window.endSec);
  }

  return merged;
}

function segmentOverlapsWindow(segment: TranscriptSegmentInput, window: TranscriptWindow) {
  return segment.startSec <= window.endSec && segment.endSec >= window.startSec;
}

function nearestWindowSummary(segment: TranscriptSegmentInput, windows: TranscriptWindow[]) {
  const midpoint = (segment.startSec + segment.endSec) / 2;
  const nearest = windows
    .slice()
    .sort((a, b) => Math.abs(midpoint - windowMidpoint(a)) - Math.abs(midpoint - windowMidpoint(b)))[0];

  return nearest ? `Frame-aligned transcript context near ${formatTime(windowMidpoint(nearest))}.` : null;
}

function windowMidpoint(window: TranscriptWindow) {
  return (window.startSec + window.endSec) / 2;
}

function formatTime(seconds: number) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const rest = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
