"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";

export function ProcessAssetButton({ assetId }: { assetId: string }) {
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
      setError(payload.error ?? "Media processing failed.");
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={processAsset}
        disabled={isProcessing}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[#195f48] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
        {isProcessing ? "Extracting frames..." : "Extract frames"}
      </button>
      {error ? <p className="mt-2 max-w-sm text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
