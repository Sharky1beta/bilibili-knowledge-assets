"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MicVocal } from "lucide-react";

export function TranscribeAudioButton({ assetId, disabledReason }: { assetId: string; disabledReason?: string | null }) {
  const router = useRouter();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transcribeAudio() {
    setIsTranscribing(true);
    setError(null);

    const response = await fetch(`/api/assets/${assetId}/asr`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setIsTranscribing(false);

    if (!response.ok) {
      setError(payload.error ?? "ASR 转写失败。");
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={transcribeAudio}
        disabled={isTranscribing || Boolean(disabledReason)}
        translate="no"
        title={disabledReason ?? undefined}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#9333ea] px-4 text-sm font-semibold text-white transition hover:bg-[#7e22ce] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden={isTranscribing} className={isTranscribing ? "hidden" : "inline-flex"}>
          <MicVocal size={16} />
        </span>
        <span aria-hidden={!isTranscribing} className={isTranscribing ? "inline-flex" : "hidden"}>
          <Loader2 size={16} className="animate-spin" />
        </span>
        <span className={isTranscribing ? "hidden" : "inline"}>音频 ASR</span>
        <span className={isTranscribing ? "inline" : "hidden"}>正在转写...</span>
      </button>
      {disabledReason ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{disabledReason}</p> : null}
      {error ? <p className="mt-2 text-sm leading-5 text-red-700">{error}</p> : null}
    </div>
  );
}

