import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { getAssetDetail } from "@/lib/db/assets";

export default async function AssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = getAssetDetail(id);

  if (!detail) {
    notFound();
  }

  const { asset, frames, segments, knowledgeItems } = detail;

  return (
    <div className="px-6 py-6 lg:px-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft size={16} />
        Back to assets
      </Link>

      <header className="mt-5 rounded-lg border border-[var(--line)] bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={asset.status} />
              <span className="text-sm text-[var(--muted)]">{asset.aid ? `av${asset.aid}` : "av pending"}</span>
              <span className="text-sm text-[var(--muted)]">{asset.bvid ?? "BV pending"}</span>
              <span className="text-sm text-[var(--muted)]">{asset.cid ? `cid ${asset.cid}` : "cid pending"}</span>
            </div>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight">{asset.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {asset.description ?? "This asset is waiting for the ingestion pipeline to fetch metadata and evidence."}
            </p>
            {asset.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {asset.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-xs text-[var(--muted)]">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {asset.errorMessage ? (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{asset.errorMessage}</p>
            ) : null}
          </div>
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold"
          >
            Source
            <ExternalLink size={15} />
          </a>
        </div>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="grid gap-6">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">Key frames</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {frames.length ? (
                frames.map((frame) => (
                  <article key={frame.id} className="overflow-hidden rounded-lg border border-[var(--line)]">
                    <div className="relative aspect-video bg-[var(--panel-soft)]">
                      <Image src={frame.imagePath} alt={frame.summary} fill className="object-cover" />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                          {formatTime(frame.timestampSec)}
                        </span>
                        <span className="rounded-full bg-[var(--panel-soft)] px-2 py-1 text-xs text-[var(--muted)]">
                          {frame.visualType}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6">{frame.summary}</p>
                      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{frame.retentionReason}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {frame.onlyInVisual.map((item) => (
                          <span key={item} className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">
                            visual-only: {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">
                  No key frames yet. Milestone 3 will populate this area from ffmpeg scene candidates and visual analysis.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">Transcript segments</h2>
            <div className="mt-4 grid gap-3">
              {segments.map((segment) => (
                <div key={segment.id} className="rounded-lg border border-[var(--line)] p-4">
                  <div className="font-mono text-xs font-semibold text-[var(--accent)]">
                    {formatTime(segment.startSec)} - {formatTime(segment.endSec)}
                  </div>
                  <p className="mt-2 text-sm leading-6">{segment.text}</p>
                  {segment.summary ? <p className="mt-2 text-xs text-[var(--muted)]">{segment.summary}</p> : null}
                </div>
              ))}
              {!segments.length ? (
                <p className="rounded-lg border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">
                  No transcript segments yet.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="grid content-start gap-6">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">Knowledge items</h2>
            <div className="mt-4 grid gap-3">
              {knowledgeItems.map((item) => (
                <div key={item.id} className="rounded-lg bg-[var(--panel-soft)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{item.type}</div>
                  <p className="mt-2 text-sm leading-6">{item.content}</p>
                </div>
              ))}
              {!knowledgeItems.length ? <p className="text-sm text-[var(--muted)]">No structured items yet.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">Metadata</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Owner</dt>
                <dd className="text-right font-medium">{asset.ownerName ?? "Pending"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Duration</dt>
                <dd className="font-medium">{asset.duration ? formatDuration(asset.duration) : "Pending"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Pages</dt>
                <dd className="font-medium">{asset.pageCount ?? "Pending"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Cover</dt>
                <dd className="max-w-48 truncate text-right font-mono text-xs">{asset.coverUrl ?? "Pending"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">Processing status</h2>
            <ol className="mt-4 grid gap-3 text-sm text-[var(--muted)]">
              {[
                "created",
                "metadata_fetched",
                "video_resolved",
                "frames_extracted",
                "visual_understood",
                "asset_built",
                "ready",
              ].map((step) => (
                <li key={step} className="flex items-center gap-2">
                  <span className={step === asset.status ? "size-2 rounded-full bg-[var(--accent)]" : "size-2 rounded-full bg-[var(--line)]"} />
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const rest = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;

  if (hours) {
    return `${hours}h ${minutes}m ${rest}s`;
  }

  return `${minutes}m ${rest}s`;
}
