import Link from "next/link";
import { ArrowRight, Clock3, Image as ImageIcon, MessageSquareText } from "lucide-react";
import { DeleteAssetButton } from "@/components/delete-asset-button";
import { StatusPill } from "@/components/status-pill";
import { UrlIntake } from "@/components/url-intake";
import { createDemoAsset, listAssets } from "@/lib/db/assets";

export const dynamic = "force-dynamic";

const steps = [
  "Metadata",
  "Stream",
  "Frames",
  "Vision JSON",
  "Memory",
  "Outputs",
];

export default function HomePage() {
  createDemoAsset();
  const assets = listAssets();

  return (
    <div className="px-6 py-6 lg:px-10">
      <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Video assets</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Create reusable knowledge assets from Bilibili long videos, then generate cited outputs from saved visual and text evidence.
          </p>
        </div>
        <Link
          href="/generate"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold"
        >
          Generate
          <ArrowRight size={16} />
        </Link>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-6">
          <UrlIntake />

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold">Reusable assets</h2>
              <span className="text-sm text-[var(--muted)]">{assets.length} total</span>
            </div>
            <div className="mt-4 grid gap-3">
              {assets.map((asset) => (
                <article
                  key={asset.id}
                  className="relative grid gap-3 rounded-lg border border-[var(--line)] p-4 pr-14 transition hover:border-[var(--accent)] hover:bg-[var(--panel-soft)] md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="absolute right-4 top-4">
                    <DeleteAssetButton assetId={asset.id} title={asset.title} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{asset.title}</h3>
                      <StatusPill status={asset.status} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                      {asset.description ?? "Waiting for metadata and visual evidence extraction."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                      <span>{asset.aid ? `av${asset.aid}` : "aid pending"}</span>
                      <span>{asset.bvid ?? "BV pending"}</span>
                      <span>{asset.cid ? `cid ${asset.cid}` : "cid pending"}</span>
                      <span>{asset.ownerName ?? "Owner pending"}</span>
                      <span>{asset.duration ? `${Math.round(asset.duration / 60)} min` : "Duration pending"}</span>
                      <span>{asset.pageCount ? `${asset.pageCount} page${asset.pageCount > 1 ? "s" : ""}` : "pages pending"}</span>
                    </div>
                    {asset.errorMessage ? (
                      <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{asset.errorMessage}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end">
                    <Link
                      href={`/assets/${asset.id}`}
                      className="group inline-flex items-center text-sm font-semibold text-[var(--accent)]"
                    >
                      Open
                      <ArrowRight size={16} className="ml-2 transition group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">Pipeline</h2>
            <div className="mt-4 grid gap-3">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 text-sm">
                  <span className="grid size-7 place-items-center rounded-full bg-[var(--panel-soft)] text-xs font-semibold text-[var(--accent)]">
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[#14211c] p-5 text-white">
            <h2 className="text-base font-semibold">Demo proof points</h2>
            <div className="mt-4 grid gap-4 text-sm text-[#c5d8d0]">
              <div className="flex gap-3">
                <ImageIcon size={18} className="mt-0.5 text-emerald-300" />
                Information-driven key frames with timestamped visual notes.
              </div>
              <div className="flex gap-3">
                <Clock3 size={18} className="mt-0.5 text-emerald-300" />
                Same saved asset can generate multiple outputs without reprocessing.
              </div>
              <div className="flex gap-3">
                <MessageSquareText size={18} className="mt-0.5 text-emerald-300" />
                Multi-asset synthesis is available from the generation workbench.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
