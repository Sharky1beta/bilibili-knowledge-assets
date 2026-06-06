import type { Asset, AssetStatus } from "@/lib/types";

export type PipelineAction =
  | "process"
  | "vision"
  | "audio"
  | "subtitles"
  | "asr"
  | "build";

export const pipelineSteps: AssetStatus[] = [
  "created",
  "metadata_fetched",
  "video_resolved",
  "media_downloaded",
  "frames_extracted",
  "visual_understood",
  "transcript_ready",
  "asset_built",
  "ready",
];

const statusOrder = new Map(pipelineSteps.map((status, index) => [status, index]));

export function actionDisabledReason(options: {
  asset: Asset;
  action: PipelineAction;
  hasFrames: boolean;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasKnowledge: boolean;
}) {
  const { asset, action, hasFrames, hasAudio, hasKnowledge } = options;

  if (!asset.cid || (!asset.bvid && !asset.aid)) {
    return "缺少元数据。请先用有效的公开 B 站 URL 创建资产。";
  }

  if (action === "process") {
    return null;
  }

  if (action === "audio") {
    return null;
  }

  if (action === "subtitles") {
    if (!hasFrames) {
      return "请先抽取关键帧。本 Demo 只保留关键帧附近的字幕片段。";
    }
    return null;
  }

  if (action === "vision" && !hasFrames) {
    return "请先抽取关键帧，视觉模型需要截图才能分析。";
  }

  if (asset.status === "failed" && (action === "vision" || action === "build")) {
    return "请先恢复失败的前置步骤，再重试这个操作。";
  }

  if (action === "asr" && !hasAudio) {
    return "请先提取音频；ASR 会从已保存的 audio-full.mp3 中切窗口。";
  }

  if (action === "asr" && !hasFrames) {
    return "请先抽取关键帧。ASR 只转写关键帧附近的音频窗口。";
  }

  if (action === "build") {
    if (!hasFrames) {
      return "请先抽取关键帧，让资产具备视觉证据。";
    }
    if (statusRank(asset.status) < statusRank("visual_understood")) {
      return "请先做视觉分析，生成帧摘要、可见文字和 visual-only facts。";
    }
    if (hasKnowledge && (asset.status === "asset_built" || asset.status === "ready")) {
      return "这个资产已经构建完成。只有在重抽帧、更新字幕或转写后才需要重建。";
    }
  }

  return null;
}

export function getNextPipelineStep(options: {
  asset: Asset;
  hasFrames: boolean;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasKnowledge: boolean;
}) {
  const { asset, hasFrames, hasAudio, hasTranscript, hasKnowledge } = options;

  if (asset.status === "failed") {
    return {
      title: "恢复失败资产",
      body: asset.errorMessage || "先查看错误原因，再重试缺失的前置步骤，必要时重新创建资产。",
    };
  }

  if (!asset.cid || (!asset.bvid && !asset.aid)) {
    return {
      title: "获取元数据",
      body: "请从公开 B 站 URL 创建资产，系统会保存 aid、bvid、cid、时长、UP 主和标签。",
    };
  }

  if (!hasFrames) {
    return {
      title: "下一步：抽取信息驱动关键帧",
      body: "先用场景变化、弹幕峰值和少量兜底点找候选帧，再做视觉分析。",
    };
  }

  if (statusRank(asset.status) < statusRank("visual_understood")) {
    return {
      title: "下一步：视觉分析",
      body: "让 Gemini 判断每张帧的信息密度、可见文字和只存在于画面中的事实。",
    };
  }

  if (!hasAudio) {
    return {
      title: "可选：提取音频",
      body: "如果没有官方字幕，就需要先保存 audio-full.mp3，后续 ASR 会从关键帧附近切音频窗口。",
    };
  }

  if (!hasTranscript) {
    return {
      title: "下一步：补充字幕/转写层",
      body: "优先抓 B 站官方字幕；如果没有字幕，再对关键帧附近的音频窗口跑 ASR。",
    };
  }

  if (!hasKnowledge || statusRank(asset.status) < statusRank("asset_built")) {
    return {
      title: "下一步：构建可复用资产",
      body: "把元数据、视觉事实、字幕片段和引用合并成结构化知识条目。",
    };
  }

  return {
    title: "可以生成了",
    body: "去生成页复用这个资产，生成图文总结、证据卡片或多视频综合，不需要重新处理视频。",
  };
}

export function recoveryAdvice(errorMessage: string | null) {
  const message = (errorMessage ?? "").toLowerCase();

  if (message.includes("gemini") || message.includes("api key")) {
    return "请检查 .env.local 里的 GEMINI_API_KEY，重启开发服务器后再试。";
  }

  if (message.includes("ffmpeg")) {
    return "请安装 ffmpeg，并确认它在 PATH 中可用，然后重试抽帧或音频提取。";
  }

  if (message.includes("playurl") || message.includes("stream") || message.includes("region")) {
    return "请确认视频是公开可访问的，当前地区可播放，并且没有被 B 站防盗链限制。";
  }

  if (message.includes("metadata") || message.includes("bvid") || message.includes("cid")) {
    return "请用有效的 B 站 BV/av URL 重新创建资产，让系统获取 cid 和来源身份。";
  }

  return null;
}

function statusRank(status: AssetStatus) {
  return statusOrder.get(status) ?? -1;
}
