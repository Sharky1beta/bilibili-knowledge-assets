"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Captions, Loader2 } from "lucide-react";

export function ExtractTranscriptButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function extractTranscript() {
    setIsExtracting(true);
    setError(null);

    const response = await fetch(`/api/assets/${assetId}/transcript`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setIsExtracting(false);

    if (!response.ok) {
      setError(payload.error ?? "Transcript extraction failed.");
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={extractTranscript}
        disabled={isExtracting}
        translate="no"
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f766e] px-4 text-sm font-semibold text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden={isExtracting} className={isExtracting ? "hidden" : "inline-flex"}>
          <Captions size={16} />
        </span>
        <span aria-hidden={!isExtracting} className={isExtracting ? "inline-flex" : "hidden"}>
          <Loader2 size={16} className="animate-spin" />
        </span>
        <span className={isExtracting ? "hidden" : "inline"}>Extract transcript</span>
        <span className={isExtracting ? "inline" : "hidden"}>Extracting transcript...</span>
      </button>
      {error ? <p className="mt-2 max-w-sm text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
