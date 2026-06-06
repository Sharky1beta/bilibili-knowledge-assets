"use client";

import Image from "next/image";
import { useState } from "react";
import { FileText, Layers3, Loader2, Sparkles } from "lucide-react";
import type { Citation, GeneratedContent } from "@/lib/ai/outputs";
import type { Asset, AssetStatus, OutputMode } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";

type ReuseProof = {
  message: string;
  assets: Array<{
    assetId: string;
    title: string;
    status: AssetStatus;
    metadata: boolean;
    frames: number;
    transcriptSegments: number;
    knowledgeItems: number;
  }>;
};

const modes: { value: OutputMode; label: string }[] = [
  { value: "illustrated_summary", label: "Illustrated Summary" },
  { value: "evidence_cards", label: "Evidence Cards" },
  { value: "multi_video_synthesis", label: "Multi-Video Synthesis" },
];

const statusSteps: AssetStatus[] = [
  "created",
  "metadata_fetched",
  "video_resolved",
  "media_downloaded",
  "frames_extracted",
  "visual_understood",
  "transcript_ready",
  "asset_built",
  "ready",
];

export function GenerateWorkbench({ assets }: { assets: Asset[] }) {
  const [selected, setSelected] = useState<string[]>(assets.slice(0, 1).map((asset) => asset.id));
  const [mode, setMode] = useState<OutputMode>("illustrated_summary");
  const [prompt, setPrompt] = useState("Prioritize visual evidence, reusable facts, and concrete next actions.");
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [reuseProof, setReuseProof] = useState<ReuseProof | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function generate() {
    setIsLoading(true);
    setWarning(null);

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIds: selected, mode, prompt }),
    });
    const payload = (await response.json()) as {
      content?: GeneratedContent;
      error?: string;
      warning?: string | null;
      reuseProof?: ReuseProof;
    };

    setContent(payload.content ?? null);
    setWarning(payload.warning ?? payload.error ?? null);
    setReuseProof(payload.reuseProof ?? null);
    setIsLoading(false);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="text-base font-semibold">Sources</h2>
        <div className="mt-4 grid gap-2">
          {assets.map((asset) => (
            <SourceAssetOption
              key={asset.id}
              asset={asset}
              checked={selected.includes(asset.id)}
              onChange={(checked) => {
                setSelected((current) =>
                  checked ? [...current, asset.id] : current.filter((id) => id !== asset.id),
                );
              }}
            />
          ))}
        </div>

        <h2 className="mt-6 text-base font-semibold">Mode</h2>
        <div className="mt-3 grid gap-2">
          {modes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value)}
              className={
                item.value === mode
                  ? "flex items-center justify-between rounded-lg border border-[var(--accent)] bg-[#e8f5ef] px-3 py-3 text-left text-sm font-semibold text-[var(--foreground)]"
                  : "flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-3 text-left text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
              }
            >
              {item.label}
              {item.value === "illustrated_summary" ? <FileText size={16} /> : item.value === "evidence_cards" ? <Sparkles size={16} /> : <Layers3 size={16} />}
            </button>
          ))}
        </div>

        <h2 className="mt-6 text-base font-semibold">Focus prompt</h2>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="mt-3 min-h-28 w-full rounded-lg border border-[var(--line)] p-3 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={generate}
          disabled={isLoading || selected.length === 0}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {isLoading ? "Generating..." : "Generate output"}
        </button>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Output preview</h2>
          {content ? <span className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-xs text-[var(--muted)]">{content.mode}</span> : null}
        </div>
        {warning ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{warning}</p> : null}
        {reuseProof ? <ReuseProofPanel proof={reuseProof} /> : null}
        <div className="mt-4 min-h-96">
          {content ? <OutputPreview content={content} /> : <EmptyPreview />}
        </div>
      </section>
    </div>
  );
}

function ReuseProofPanel({ proof }: { proof: ReuseProof }) {
  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-sm font-semibold text-emerald-900">{proof.message}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {proof.assets.map((asset) => (
          <div key={asset.assetId} className="rounded-md bg-white/75 px-3 py-2 text-xs text-emerald-900">
            <div className="truncate font-semibold">{asset.title}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-emerald-800">
              <span>metadata {asset.metadata ? "yes" : "no"}</span>
              <span>frames {asset.frames}</span>
              <span>transcript {asset.transcriptSegments}</span>
              <span>knowledge {asset.knowledgeItems}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceAssetOption({
  asset,
  checked,
  onChange,
}: {
  asset: Asset;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const progress = statusProgress(asset.status);

  return (
    <label className="grid min-w-0 cursor-pointer grid-cols-[18px_minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border border-[var(--line)] p-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      <span className="block min-w-0">
        <span className="block max-w-full truncate font-medium">{asset.title}</span>
        <span className="mt-2 flex min-w-0 items-center justify-between gap-3">
          <StatusPill status={asset.status} />
          <span className="shrink-0 font-mono text-[11px] text-[var(--muted)]">
            {progress.current}/{statusSteps.length}
          </span>
        </span>
        <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-soft)]">
          <span
            className="block h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${progress.percent}%` }}
          />
        </span>
      </span>
    </label>
  );
}

function OutputPreview({ content }: { content: GeneratedContent }) {
  if (content.mode === "evidence_cards") {
    return (
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">{content.title}</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {content.cards.map((card, index) => (
            <article key={`${card.claim}-${index}`} className="overflow-hidden rounded-lg border border-[var(--line)]">
              {card.imagePath ? (
                <div className="relative aspect-video bg-[var(--panel-soft)]">
                  <Image src={card.imagePath} alt={card.claim} fill className="object-cover" />
                </div>
              ) : null}
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-md bg-[#e8f5ef] px-2 py-1 text-xs font-semibold text-[var(--accent)]">{card.evidenceType}</span>
                  {card.timestampSec !== null ? <span className="font-mono text-xs text-[var(--muted)]">{formatTime(card.timestampSec)}</span> : null}
                </div>
                <h4 className="mt-3 text-sm font-semibold leading-6">{card.claim}</h4>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.explanation}</p>
                {card.visibleEvidence.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {card.visibleEvidence.slice(0, 6).map((item) => (
                      <span key={item} className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-xs text-[var(--muted)]">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
                <CitationList citations={card.citations} />
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (content.mode === "multi_video_synthesis") {
    return (
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">{content.title}</h3>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{content.synthesis}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {content.sourceCoverage.map((item) => (
            <div key={item.assetTitle} className="rounded-lg border border-[var(--line)] p-3">
              <h4 className="truncate text-sm font-semibold">{item.assetTitle}</h4>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                <span>Claims {item.claimCount}</span>
                <span>Visual {item.visualFactCount}</span>
                <span>Transcript {item.transcriptSegmentCount}</span>
                <span>Frames {item.frameCount}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-[var(--line)] p-4">
            <h4 className="text-sm font-semibold">Common themes</h4>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted)]">
              {content.commonThemes.map((theme) => (
                <li key={theme}>{theme}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-[var(--line)] p-4">
            <h4 className="text-sm font-semibold">Open questions</h4>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted)]">
              {content.openQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <h4 className="text-sm font-semibold">Layered evidence</h4>
          <div className="grid gap-3 md:grid-cols-3">
            {content.layeredEvidence.map((item) => (
              <article key={`${item.layer}-${item.insight}`} className="rounded-lg border border-[var(--line)] p-4">
                <span className="rounded-md bg-[#e8f5ef] px-2 py-1 text-xs font-semibold text-[var(--accent)]">{item.layer}</span>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.insight}</p>
                <CitationList citations={item.citations} />
              </article>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <h4 className="text-sm font-semibold">Comparison matrix</h4>
          {content.comparisonMatrix.map((row) => (
            <article key={row.dimension} className="rounded-lg border border-[var(--line)] p-4">
              <h5 className="text-sm font-semibold">{row.dimension}</h5>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {row.observations.map((observation) => (
                  <div key={`${row.dimension}-${observation.assetTitle}`} className="rounded-lg bg-[var(--panel-soft)] p-3">
                    <div className="text-xs font-semibold text-[var(--accent)]">{observation.assetTitle}</div>
                    <p className="mt-2 text-sm leading-6">{observation.point}</p>
                    <CitationList citations={observation.citations} compact />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 grid gap-4">
          {content.uniqueEvidence.map((item) => (
            <article key={item.assetTitle} className="rounded-lg border border-[var(--line)] p-4">
              <h4 className="text-sm font-semibold">{item.assetTitle}</h4>
              <ul className="mt-3 grid gap-2 text-sm leading-6">
                {item.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <CitationList citations={item.citations} />
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-2xl font-semibold tracking-tight">{content.title}</h3>
      <p className="mt-3 rounded-lg bg-[#e8f5ef] px-4 py-3 text-sm leading-6 text-[var(--accent)]">{content.takeaway}</p>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4">
          {content.sections.map((section, index) => (
            <article key={`${section.heading}-${index}`} className="overflow-hidden rounded-lg border border-[var(--line)]">
              {section.imagePath ? (
                <div className="relative aspect-video bg-[var(--panel-soft)]">
                  <Image src={section.imagePath} alt={section.heading} fill className="object-cover" />
                </div>
              ) : null}
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold">{section.heading}</h4>
                  {section.timestampSec !== null ? <span className="font-mono text-xs text-[var(--muted)]">{formatTime(section.timestampSec)}</span> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{section.summary}</p>
                <CitationList citations={section.citations} />
              </div>
            </article>
          ))}
        </div>
        <aside className="grid content-start gap-4">
          <div className="rounded-lg border border-[var(--line)] p-4">
            <h4 className="text-sm font-semibold">Key facts</h4>
            <div className="mt-3 grid gap-3">
              {content.keyFacts.map((fact) => (
                <div key={fact.text} className="rounded-lg bg-[var(--panel-soft)] p-3">
                  <p className="text-sm leading-6">{fact.text}</p>
                  <CitationList citations={fact.citations} compact />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] p-4">
            <h4 className="text-sm font-semibold">Actions</h4>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted)]">
              {content.actionSuggestions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CitationList({ citations, compact = false }: { citations: Citation[]; compact?: boolean }) {
  if (!citations.length) {
    return null;
  }

  return (
    <div className={compact ? "mt-2 flex flex-wrap gap-1" : "mt-3 flex flex-wrap gap-2"}>
      {citations.slice(0, compact ? 3 : 6).map((citation) => (
        <span key={`${citation.assetTitle}-${citation.sourceId}`} className="rounded-md bg-white px-2 py-1 font-mono text-[11px] text-[var(--muted)]">
          {citation.kind}:{shortId(citation.sourceId)}
          {citation.timestampSec !== null ? ` @${formatTime(citation.timestampSec)}` : ""}
        </span>
      ))}
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="flex min-h-96 items-center justify-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel-soft)] p-8 text-center">
      <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
        Choose one built asset for summary or cards, or select several assets for synthesis.
      </p>
    </div>
  );
}

function formatTime(seconds: number) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const rest = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function shortId(id: string) {
  return id.length > 10 ? id.slice(0, 10) : id;
}

function statusProgress(status: AssetStatus) {
  if (status === "failed") {
    return { current: 0, percent: 100 };
  }

  const index = statusSteps.indexOf(status);
  const current = index >= 0 ? index + 1 : 0;
  return {
    current,
    percent: Math.round((current / statusSteps.length) * 100),
  };
}
