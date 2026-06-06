"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

export function DeleteAssetButton({ assetId, title }: { assetId: string; title: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAsset() {
    const confirmed = window.confirm(`Delete "${title}"? This removes the local asset record and extracted frames.`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const response = await fetch(`/api/assets/${assetId}`, {
      method: "DELETE",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setIsDeleting(false);

    if (!response.ok) {
      setError(payload.error ?? "Delete failed.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={deleteAsset}
        disabled={isDeleting}
        aria-label={`Delete ${title}`}
        title="Delete asset"
        className="inline-grid size-8 place-items-center rounded-lg border border-red-100 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
      </button>
      {error ? <p className="mt-2 max-w-40 text-right text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
