"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boxes, Loader2 } from "lucide-react";

export function BuildKnowledgeButton({ assetId }: { assetId: string }) {
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
      setError(payload.error ?? "Knowledge asset build failed.");
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
        disabled={isBuilding}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-sm font-semibold text-white transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBuilding ? <Loader2 size={16} className="animate-spin" /> : <Boxes size={16} />}
        {isBuilding ? "Building asset..." : "Build asset"}
      </button>
      {error ? <p className="mt-2 max-w-sm text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
