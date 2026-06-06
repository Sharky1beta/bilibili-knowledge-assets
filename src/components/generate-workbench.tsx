"use client";

import { useState } from "react";
import type { Asset, OutputMode } from "@/lib/types";

const modes: { value: OutputMode; label: string }[] = [
  { value: "illustrated_summary", label: "Illustrated Summary" },
  { value: "evidence_cards", label: "Evidence Cards" },
  { value: "multi_video_synthesis", label: "Multi-Video Synthesis" },
];

export function GenerateWorkbench({ assets }: { assets: Asset[] }) {
  const [selected, setSelected] = useState<string[]>(assets.slice(0, 1).map((asset) => asset.id));
  const [mode, setMode] = useState<OutputMode>("illustrated_summary");
  const [prompt, setPrompt] = useState("偏事实、保留视觉证据、输出可行动建议");
  const [content, setContent] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function generate() {
    setIsLoading(true);
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIds: selected, mode, prompt }),
    });
    const payload = (await response.json()) as { content?: unknown; error?: string };
    setContent(payload.content ?? { error: payload.error ?? "Generation failed." });
    setIsLoading(false);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="text-base font-semibold">Sources</h2>
        <div className="mt-4 grid gap-2">
          {assets.map((asset) => (
            <label key={asset.id} className="flex cursor-pointer gap-3 rounded-lg border border-[var(--line)] p-3 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(asset.id)}
                onChange={(event) => {
                  setSelected((current) =>
                    event.target.checked ? [...current, asset.id] : current.filter((id) => id !== asset.id),
                  );
                }}
              />
              <span>
                <span className="block font-medium">{asset.title}</span>
                <span className="mt-1 block text-xs text-[var(--muted)]">{asset.status}</span>
              </span>
            </label>
          ))}
        </div>
        <h2 className="mt-6 text-base font-semibold">Mode</h2>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as OutputMode)}
          className="mt-3 h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm"
        >
          {modes.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <h2 className="mt-6 text-base font-semibold">Focus prompt</h2>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="mt-3 min-h-28 w-full rounded-lg border border-[var(--line)] p-3 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={generate}
          disabled={isLoading || selected.length === 0}
          className="mt-4 h-11 w-full rounded-lg bg-[var(--accent)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Generating..." : "Generate output"}
        </button>
      </section>
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="text-base font-semibold">Output preview</h2>
        <pre className="mt-4 min-h-96 overflow-auto rounded-lg bg-[#111815] p-4 text-xs leading-6 text-[#d8f4e3]">
          {content ? JSON.stringify(content, null, 2) : "Choose assets and generate an output."}
        </pre>
      </section>
    </div>
  );
}
