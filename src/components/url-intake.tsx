"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LinkIcon, Loader2 } from "lucide-react";

export function UrlIntake() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const payload = (await response.json()) as { assetId?: string; error?: string; reused?: boolean };
    setIsSubmitting(false);

    if (!response.ok || !payload.assetId) {
      setError(payload.error ?? "创建资产失败。");
      return;
    }

    router.push(`/assets/${payload.assetId}${payload.reused ? "?reused=1" : ""}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
      <label htmlFor="url" className="text-sm font-semibold">
        B 站视频 URL
      </label>
      <div className="mt-3 flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3">
          <LinkIcon size={17} className="shrink-0 text-[var(--muted)]" />
          <input
            id="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.bilibili.com/video/BV..."
            className="h-11 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[#195f48] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
          创建资产
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}
