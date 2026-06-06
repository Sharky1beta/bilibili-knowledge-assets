"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boxes, Loader2 } from "lucide-react";

export function BuildKnowledgeButton({ assetId, disabledReason }: { assetId: string; disabledReason?: string | null }) {
  const router = useRouter();
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buildKnowledge() {
    setIsBuilding(true);
    setError(null);

    const response = await fetch(`/api/assets/${assetId}/build`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setIsBuilding(false);

    if (!response.ok) {
      setError(payload.error ?? "知识资产构建失败。");
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={buildKnowledge}
        disabled={isBuilding || Boolean(disabledReason)}
        translate="no"
        title={disabledReason ?? undefined}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-sm font-semibold text-white transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden={isBuilding} className={isBuilding ? "hidden" : "inline-flex"}>
          <Boxes size={16} />
        </span>
        <span aria-hidden={!isBuilding} className={isBuilding ? "inline-flex" : "hidden"}>
          <Loader2 size={16} className="animate-spin" />
        </span>
        <span className={isBuilding ? "hidden" : "inline"}>构建资产</span>
        <span className={isBuilding ? "inline" : "hidden"}>正在构建...</span>
      </button>
      {disabledReason ? <p className="mt-2 max-w-sm text-xs text-[var(--muted)]">{disabledReason}</p> : null}
      {error ? <p className="mt-2 max-w-sm text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
