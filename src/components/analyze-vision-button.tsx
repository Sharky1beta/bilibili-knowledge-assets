"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";

export function AnalyzeVisionButton({ assetId, disabledReason }: { assetId: string; disabledReason?: string | null }) {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyzeVision() {
    setIsAnalyzing(true);
    setError(null);

    const response = await fetch(`/api/assets/${assetId}/vision`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setIsAnalyzing(false);

    if (!response.ok) {
      setError(payload.error ?? "视觉分析失败。");
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={analyzeVision}
        disabled={isAnalyzing || Boolean(disabledReason)}
        translate="no"
        title={disabledReason ?? undefined}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden={isAnalyzing} className={isAnalyzing ? "hidden" : "inline-flex"}>
          <Eye size={16} />
        </span>
        <span aria-hidden={!isAnalyzing} className={isAnalyzing ? "inline-flex" : "hidden"}>
          <Loader2 size={16} className="animate-spin" />
        </span>
        <span className={isAnalyzing ? "hidden" : "inline"}>视觉分析</span>
        <span className={isAnalyzing ? "inline" : "hidden"}>正在分析...</span>
      </button>
      {disabledReason ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{disabledReason}</p> : null}
      {error ? <p className="mt-2 text-sm leading-5 text-red-700">{error}</p> : null}
    </div>
  );
}

