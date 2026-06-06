import type { AssetStatus } from "@/lib/types";

const labels: Record<AssetStatus, string> = {
  created: "Created",
  metadata_fetched: "Metadata",
  video_resolved: "Stream",
  media_downloaded: "Downloaded",
  frames_extracted: "Frames",
  visual_understood: "Vision",
  transcript_ready: "Transcript",
  asset_built: "Built",
  ready: "Ready",
  failed: "Failed",
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
