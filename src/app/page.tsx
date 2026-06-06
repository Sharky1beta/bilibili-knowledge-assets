import Link from "next/link";
import { ArrowRight, Clock3, Image as ImageIcon, MessageSquareText } from "lucide-react";
import { DeleteAssetButton } from "@/components/delete-asset-button";
import { StatusPill } from "@/components/status-pill";
import { UrlIntake } from "@/components/url-intake";
import { createDemoAsset, listAssets } from "@/lib/db/assets";

export const dynamic = "force-dynamic";

const steps = [
  "元数据",
  "视频流",
  "关键帧",
  "视觉理解",
  "知识资产",
  "生成输出",
];

export default function HomePage() {
  createDemoAsset();
  const assets = listAssets();

  return (
    <div className="px-6 py-6 lg:px-10">
      <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">视频资产</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            从 B 站长视频创建可复用知识资产，再基于已保存的视觉证据和文本证据生成带引用的结果。
          </p>
        </div>
        <Link
          href="/generate"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold"
        >
          去生成
          <ArrowRight size={16} />
        </Link>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-6">
          <UrlIntake />

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold">可复用资产</h2>
              <span className="text-sm text-[var(--muted)]">共 {assets.length} 个</span>
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
                      {asset.description ?? "等待抓取元数据和视觉证据。"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                      <span>{asset.aid ? `av${asset.aid}` : "aid 待获取"}</span>
                      <span>{asset.bvid ?? "BV 待获取"}</span>
                      <span>{asset.cid ? `cid ${asset.cid}` : "cid 待获取"}</span>
                      <span>{asset.ownerName ?? "UP 主待获取"}</span>
                      <span>{asset.duration ? `${Math.round(asset.duration / 60)} 分钟` : "时长待获取"}</span>
                      <span>{asset.pageCount ? `${asset.pageCount} P` : "分 P 待获取"}</span>
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
            <h2 className="text-base font-semibold">处理流程</h2>
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
            <h2 className="text-base font-semibold">Demo 证明点</h2>
            <div className="mt-4 grid gap-4 text-sm text-[#c5d8d0]">
              <div className="flex gap-3">
                <ImageIcon size={18} className="mt-0.5 text-emerald-300" />
                信息驱动选帧，保留时间戳和视觉说明。
              </div>
              <div className="flex gap-3">
                <Clock3 size={18} className="mt-0.5 text-emerald-300" />
                同一资产可生成多种输出，不重新处理视频。
              </div>
              <div className="flex gap-3">
                <MessageSquareText size={18} className="mt-0.5 text-emerald-300" />
                生成工作台支持多资产综合分析。
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
