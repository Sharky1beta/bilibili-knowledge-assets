"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Music2 } from "lucide-react";

export function ExtractAudioButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function extractAudio() {
    setIsExtracting(true);
    setError(null);

    const response = await fetch(`/api/assets/${assetId}/audio`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setIsExtracting(false);

    if (!response.ok) {
      setError(payload.error ?? "Full audio extraction failed.");
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={extractAudio}
        disabled={isExtracting}
        translate="no"
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#155e75] px-4 text-sm font-semibold text-white transition hover:bg-[#164e63] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden={isExtracting} className={isExtracting ? "hidden" : "inline-flex"}>
          <Music2 size={16} />
        </span>
        <span aria-hidden={!isExtracting} className={isExtracting ? "inline-flex" : "hidden"}>
          <Loader2 size={16} className="animate-spin" />
        </span>
        <span className={isExtracting ? "hidden" : "inline"}>Extract audio</span>
        <span className={isExtracting ? "inline" : "hidden"}>Extracting audio...</span>
      </button>
      {error ? <p className="mt-2 max-w-sm text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
