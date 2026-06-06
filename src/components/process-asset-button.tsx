"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";

export function ProcessAssetButton({ assetId, disabledReason }: { assetId: string; disabledReason?: string | null }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function processAsset() {
    setIsProcessing(true);
    setError(null);

    const response = await fetch(`/api/assets/${assetId}/process`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setIsProcessing(false);

    if (!response.ok) {
      setError(payload.error ?? "媒体处理失败。");
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={processAsset}
        disabled={isProcessing || Boolean(disabledReason)}
        translate="no"
        title={disabledReason ?? undefined}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[#195f48] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden={isProcessing} className={isProcessing ? "hidden" : "inline-flex"}>
          <ScanSearch size={16} />
        </span>
        <span aria-hidden={!isProcessing} className={isProcessing ? "inline-flex" : "hidden"}>
          <Loader2 size={16} className="animate-spin" />
        </span>
        <span className={isProcessing ? "hidden" : "inline"}>抽取关键帧</span>
        <span className={isProcessing ? "inline" : "hidden"}>正在抽帧...</span>
      </button>
      {disabledReason ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{disabledReason}</p> : null}
      {error ? <p className="mt-2 text-sm leading-5 text-red-700">{error}</p> : null}
    </div>
  );
}

