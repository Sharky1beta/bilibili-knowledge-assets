import type { AssetStatus } from "@/lib/types";

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

export function StatusPill({ status }: { status: AssetStatus }) {
  const isReady = status === "ready";
  const isFailed = status === "failed";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        isReady
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : isFailed
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-blue-200 bg-blue-50 text-blue-700",
      ].join(" ")}
    >
      {labels[status]}
    </span>
  );
}
