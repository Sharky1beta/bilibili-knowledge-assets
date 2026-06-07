# Knowledge Clip Studio

一个 24 小时全栈 Demo：输入公开 B 站长视频 URL，将视频处理成可复用的多模态知识资产，并基于一个或多个资产生成带截图、时间戳和引用的输出。

核心证明：

- 同一个视频只处理一次。
- 同一个资产可以不重新处理视频，生成多种输出。
- 多个视频资产可以合成一次跨视频输出。
- 系统会保存视觉证据，不只依赖字幕或转写。

## 本地运行

环境要求：

- Node.js 20+
- npm
- ffmpeg，并确保在 `PATH` 中
- Gemini API Key

创建 `.env.local`：

```bash
GEMINI_API_KEY=your_key_here
```

启动：

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

检查：

```bash
npm run lint
npm run build
```

## Demo 怎么看

### 1. 输入 URL 创建资产

在首页 `/` 输入公开 B 站视频 URL，例如：

```text
https://www.bilibili.com/video/BV1C47y65E1R
```

系统会解析 BVID / AID，获取 metadata，并创建视频资产。如果该视频已经处理过，会直接复用已有资产，不创建重复记录。

### 2. 处理资产

进入资产详情页后，依次执行：

1. `Process asset`
2. `Analyze vision`
3. `Build asset`

处理完成后，可以看到：

- 视频 metadata
- 转写片段
- 关键帧截图
- 视觉理解结果
- visual-only facts
- knowledge items
- 每个证据对应的时间戳和来源 ID

### 3. 同一个资产生成两种输出

打开 `/generate`：

1. 勾选一个状态为 `ready` 的视频资产。
2. 选择 `Illustrated Summary`。
3. 点击 `Generate output`。
4. 不重新处理视频，直接切换到 `Evidence Cards`。
5. 再次点击 `Generate output`。

这一步用于证明：同一个资产可以复用已保存的 frames、transcript segments 和 knowledge items，生成不同输出。

### 4. 多视频综合生成

打开 `/generate`：

1. 同时勾选 2 个真实视频资产。
2. 再勾选 1 个 seed 资产：`asset_demo_visual` 或 `Demo: visual-only facts in a technical video`。
3. 选择 `Multi-Video Synthesis`。
4. 点击 `Generate output`。

seed 资产是预置演示资产，用来稳定展示“画面里有信息但口播没说”的 visual-only 能力。

## 输出模态

当前实现 3 种输出：

- `Illustrated Summary`：图文并茂总结，包含关键帧配图、要点、行动建议和引用。
- `Evidence Cards`：自创模态，把图表、文字、界面、白板等视觉证据整理成卡片。
- `Multi-Video Synthesis`：跨多个视频资产做综合总结、共同主题、独特证据和开放问题。

其中 `Evidence Cards` 是自创模态。它适合技术讲解、产品演示、论文解读、财经分析、代码教学、白板推导类视频，因为这些视频的关键信息经常出现在画面里，而不会被完整读出来。

## 核心取舍

### 抽取策略

系统不把固定间隔截图作为主要选帧策略，而是使用信息驱动的候选帧策略：

- ffmpeg scene change 检测画面变化。
- B 站弹幕热度辅助发现高信息时刻。
- 信号不足时才使用少量 coverage fallback。
- Gemini vision 对候选帧进行结构化分析，返回 summary、visible text、visual type、information density、retention reason 和 only-in-visual facts。

这样做的目标是保留真正承载信息的画面，例如 PPT、图表、代码、白板、表格和产品界面。

### Memory 结构

Demo 使用 SQLite + 本地文件存储：

- `assets`：视频身份、metadata、状态和错误信息。
- `frames`：关键帧截图、时间戳、视觉分析、visible text 和 visual-only facts。
- `segments`：字幕或 ASR 转写片段。
- `knowledge_items`：结构化事实、观点、视觉事实和时间线条目。
- `outputs`：生成结果，保存 mode、assetIds、prompt 和 content JSON。

截图、音频、字幕快照等文件保存在 `public/assets/{assetId}`。

当前没有接入生产级向量数据库，而是使用结构化检索，优先保证 24 小时 Demo 的完整闭环和可解释性。

### 输出抽象

输出层不重新处理视频，而是读取已保存的 memory。用户可以选择一个或多个资产，并通过 prompt 指定侧重点，例如偏事实、偏观点、偏步骤、偏争议或偏复盘。

生成结果尽量携带 citation，包括 asset、frame / segment、timestamp 和 image path。

### 交互设计

用户流程：

1. 输入 B 站 URL。
2. 创建或复用视频资产。
3. 处理视频、分析视觉、构建知识资产。
4. 在资产详情页回看证据。
5. 在 `/generate` 选择资产、输出模态和 prompt。
6. 生成带截图和引用的结果。

处理进度通过资产状态展示，例如 `metadata_fetched`、`frames_extracted`、`visual_understood`、`asset_built`、`ready`。

### 砍掉了什么

为了保证 24 小时内交付完整链路，暂时砍掉：

- 登录和用户系统。
- 云存储。
- 生产级向量数据库。
- 后台任务队列。
- 完整人工标注工作台。
- 视频剪辑时间线。
- Docker 配置。

## 失败与降级处理

- 缺 Gemini API Key：视觉分析、ASR 或高质量生成会给出清晰错误；部分生成可 fallback 到已保存数据的确定性渲染。
- 缺 ffmpeg：视频抽帧和音频提取失败，提示安装 ffmpeg 并加入 `PATH`。
- B 站下载失败：保留 metadata 和错误信息，可能原因包括私有视频、地区限制、流地址过期、防盗链。
- 没有官方字幕：尝试提取音频并使用 Gemini ASR。
- ASR 分块失败：失败分块写入占位 segment，不让整个资产失败。
- Gemini 生成不稳定：输出 fallback 到 frames、segments 和 knowledge items。
- 视频过长：Demo 优先处理有限时长，保证能在本地完成演示。

## 如果再给 1 周

1. 把抽帧、ASR、视觉分析迁移到后台任务队列，支持进度轮询、取消和重试。
2. 增加手动修正 UI，用于编辑关键帧事实、转写片段和知识条目。
3. 深化候选帧抽取的逻辑
4. 增加 Ask UI，支持针对一个或多个资产提问，并返回帧级引用。
5. 增加 seed/reset 脚本，保证评审环境有稳定演示数据。
6. 支持导出 Markdown / DOCX。
7. 优化长视频分块、ASR 成本控制和更细粒度的视觉证据去重。
