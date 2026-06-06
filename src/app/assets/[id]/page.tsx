import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AnalyzeVisionButton } from "@/components/analyze-vision-button";
import { BuildKnowledgeButton } from "@/components/build-knowledge-button";
import { ExtractAudioButton } from "@/components/extract-audio-button";
import { ExtractTranscriptButton } from "@/components/extract-transcript-button";
import { ProcessAssetButton } from "@/components/process-asset-button";
import { StatusPill } from "@/components/status-pill";
import { TranscribeAudioButton } from "@/components/transcribe-audio-button";
import { getAssetDetail } from "@/lib/db/assets";
import { getAudioArtifactInfo, readTranscriptManifest } from "@/lib/media/artifacts";
import { actionDisabledReason, getNextPipelineStep, recoveryAdvice } from "@/lib/pipeline";
import type { AssetStatus } from "@/lib/types";

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ reused?: string }>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const detail = getAssetDetail(id);

  if (!detail) {
    notFound();
  }

  const { asset, frames, segments, knowledgeItems } = detail;
  const audioArtifact = await getAudioArtifactInfo(asset.id);
  const transcriptManifest = await readTranscriptManifest(asset.id);
  const pipelineContext = {
    asset,
    hasFrames: frames.length > 0,
    hasAudio: Boolean(audioArtifact),
    hasTranscript: segments.length > 0,
    hasKnowledge: knowledgeItems.length > 0,
  };
  const nextStep = getNextPipelineStep(pipelineContext);
  const advice = recoveryAdvice(asset.errorMessage);

  return (
    <div className="px-6 py-6 lg:px-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft size={16} />
        返回资产列表
      </Link>

      {query.reused === "1" ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          这个 B 站来源已经存在。本次直接复用已保存资产，不重新处理视频。
        </p>
      ) : null}

      <header className="mt-5 rounded-lg border border-[var(--line)] bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={asset.status} />
              <span className="text-sm text-[var(--muted)]">{asset.aid ? `av${asset.aid}` : "av 待获取"}</span>
              <span className="text-sm text-[var(--muted)]">{asset.bvid ?? "BV 待获取"}</span>
              <span className="text-sm text-[var(--muted)]">{asset.cid ? `cid ${asset.cid}` : "cid 待获取"}</span>
            </div>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight">{asset.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {asset.description ?? "这个资产还在等待抓取元数据和证据。"}
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
          <div className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] p-3 lg:w-[560px]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">处理操作</h2>
              <span className="text-xs text-[var(--muted)]">按推荐顺序执行</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProcessAssetButton
                assetId={asset.id}
                disabledReason={actionDisabledReason({ ...pipelineContext, action: "process" })}
              />
              <AnalyzeVisionButton
                assetId={asset.id}
                disabledReason={actionDisabledReason({ ...pipelineContext, action: "vision" })}
              />
              <ExtractAudioButton
                assetId={asset.id}
                disabledReason={actionDisabledReason({ ...pipelineContext, action: "audio" })}
              />
              <ExtractTranscriptButton
                assetId={asset.id}
                disabledReason={actionDisabledReason({ ...pipelineContext, action: "subtitles" })}
              />
              <TranscribeAudioButton
                assetId={asset.id}
                disabledReason={actionDisabledReason({ ...pipelineContext, action: "asr" })}
              />
              <BuildKnowledgeButton
                assetId={asset.id}
                disabledReason={actionDisabledReason({ ...pipelineContext, action: "build" })}
              />
              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold"
              >
                原视频
                <ExternalLink size={15} />
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="grid gap-6">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">关键帧</h2>
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
                          {formatVisualType(frame.visualType)}
                        </span>
                      </div>
                      {frame.candidateSource ? (
                        <div className="mt-3 rounded-md bg-[#f1f8f5] px-2 py-1 text-xs leading-5 text-[var(--accent)]">
                          候选来源：{formatCandidateSource(frame.candidateSource)}
                        </div>
                      ) : null}
                      <p className="mt-3 text-sm leading-6">{frame.summary}</p>
                      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{formatRetentionReason(frame.retentionReason)}</p>
                      {frame.candidateReason ? (
                        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">信号：{frame.candidateReason}</p>
                      ) : null}
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
                          <span>信息密度</span>
                          <span className="font-mono">{Math.round(frame.informationDensity * 100)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--panel-soft)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${Math.round(frame.informationDensity * 100)}%` }}
                          />
                        </div>
                      </div>
                      {frame.visibleText.length ? (
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-[var(--muted)]">画面文字</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {frame.visibleText.map((item) => (
                              <span key={item} className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-xs text-[var(--muted)]">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {frame.onlyInVisual.map((item) => (
                          <span key={item} className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">
                            仅画面可见：{item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">
                  还没有关键帧。请先点击“抽取关键帧”，系统会结合场景变化、弹幕峰值和时间覆盖生成候选帧。
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">字幕 / 转写片段</h2>
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
                  还没有字幕或转写片段。先抽取关键帧，再抓官方字幕；没有官方字幕时可先提取音频再做 ASR。
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="grid content-start gap-6">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">推荐下一步</h2>
            <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{nextStep.title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{nextStep.body}</p>
            {advice ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">{advice}</p>
            ) : null}
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">知识条目</h2>
            <div className="mt-4 grid gap-3">
              {knowledgeItems.map((item) => (
                <div key={item.id} className="rounded-lg bg-[var(--panel-soft)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{item.type}</div>
                  <p className="mt-2 text-sm leading-6">{item.content}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.sourceFrameIds.map((frameId) => (
                      <span key={frameId} className="rounded-md bg-white px-2 py-1 font-mono text-[11px] text-[var(--muted)]">
                        帧:{shortId(frameId)}
                      </span>
                    ))}
                    {item.sourceSegmentIds.map((segmentId) => (
                      <span key={segmentId} className="rounded-md bg-white px-2 py-1 font-mono text-[11px] text-[var(--muted)]">
                        文本:{shortId(segmentId)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {!knowledgeItems.length ? <p className="text-sm text-[var(--muted)]">还没有结构化知识条目。</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">元数据</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">UP 主</dt>
                <dd className="text-right font-medium">{asset.ownerName ?? "待获取"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">时长</dt>
                <dd className="font-medium">{asset.duration ? formatDuration(asset.duration) : "待获取"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">分 P</dt>
                <dd className="font-medium">{asset.pageCount ?? "待获取"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">封面</dt>
                <dd className="max-w-48 truncate text-right font-mono text-xs">{asset.coverUrl ?? "待获取"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">源媒体</h2>
            <div className="mt-4 grid gap-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">完整音频</div>
                {audioArtifact ? (
                  <div className="mt-2 rounded-lg bg-[var(--panel-soft)] p-3">
                    <a
                      href={audioArtifact.publicPath}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--accent)] hover:underline"
                    >
                      audio-full.mp3
                    </a>
                    <p className="mt-1 text-xs text-[var(--muted)]">已本地保存，{formatBytes(audioArtifact.bytes)}</p>
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg border border-dashed border-[var(--line)] p-3 text-[var(--muted)]">
                    还没有提取音频。需要 ASR 时，请先点击“提取音频”。
                  </p>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">文本层</div>
                {transcriptManifest ? (
                  <div className="mt-2 rounded-lg bg-[var(--panel-soft)] p-3">
                    <div className="font-semibold">{formatTranscriptSource(transcriptManifest.source)}</div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {transcriptManifest.segmentCount} 个带时间戳片段
                      {transcriptManifest.chunks ? `，来自 ${transcriptManifest.chunks} 个音频窗口` : ""}
                    </p>
                    {transcriptManifest.note ? (
                      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{transcriptManifest.note}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg border border-dashed border-[var(--line)] p-3 text-[var(--muted)]">
                    请先抽取关键帧，再抓官方字幕。Demo 只保留关键帧附近的字幕/转写窗口，避免完整文本过大。
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-semibold">处理状态</h2>
            <ol className="mt-4 grid gap-3 text-sm text-[var(--muted)]">
              {[
                "created",
                "metadata_fetched",
                "video_resolved",
                "media_downloaded",
                "frames_extracted",
                "visual_understood",
                "transcript_ready",
                "asset_built",
                "ready",
              ].map((step) => (
                <li key={step} className="flex items-center gap-2">
                  <span className={step === asset.status ? "size-2 rounded-full bg-[var(--accent)]" : "size-2 rounded-full bg-[var(--line)]"} />
                  {formatStatusStep(step as AssetStatus)}
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
    return `${hours}小时 ${minutes}分钟 ${rest}秒`;
  }

  return `${minutes}分钟 ${rest}秒`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTranscriptSource(source: string) {
  if (source === "bilibili_subtitle") {
    return "B 站官方字幕";
  }

  return "基于已保存音频的 ASR 转写";
}

function shortId(id: string) {
  return id.length > 12 ? id.slice(0, 12) : id;
}

function formatRetentionReason(reason: string) {
  if (reason.includes("Milestone 3") || reason.includes("Milestone 4")) {
    return "视觉理解候选帧。";
  }

  return reason;
}

function formatCandidateSource(source: string) {
  const labels: Record<string, string> = {
    scene_change: "场景变化",
    danmaku_hotspot: "弹幕峰值",
    mixed_signal: "混合信号",
    coverage_fallback: "全片覆盖兜底",
    timeline_coverage: "时间线覆盖",
  };

  return labels[source] ?? source.replace(/_/g, " ");
}

function formatVisualType(type: string) {
  const labels: Record<string, string> = {
    slide: "幻灯片",
    chart: "图表",
    code: "代码",
    whiteboard: "白板",
    table: "表格",
    talking_head: "人物口播",
    diagram: "示意图",
    other: "其他",
  };

  return labels[type] ?? type;
}

function formatStatusStep(status: AssetStatus) {
  const labels: Record<AssetStatus, string> = {
    created: "已创建",
    metadata_fetched: "元数据",
    video_resolved: "流已解析",
    media_downloaded: "媒体已取",
    frames_extracted: "已抽帧",
    visual_understood: "视觉完成",
    transcript_ready: "文本完成",
    asset_built: "资产完成",
    ready: "可复用",
    failed: "失败",
  };

  return labels[status];
}
