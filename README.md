# Knowledge Clip Studio

Knowledge Clip Studio 是一个 24 小时全栈 Demo，用于把公开可访问的 B 站长视频 URL 转换成可复用的知识资产。资产中会保存 metadata、带时间戳的转写片段、信息驱动选取的关键帧、只存在于画面中的视觉事实、结构化知识条目，以及后续生成结果。

这个 Demo 要证明三件事：

- 一个 B 站视频只处理一次。
- 保存后的视频资产可以在不重新处理视频的情况下生成多种输出。
- 多个已保存的视频资产可以合成一次跨视频输出，并保留引用来源。

## 环境要求

- 推荐 Node.js 20+。
- npm。
- `ffmpeg` 已安装，并且可以在 `PATH` 中访问。
- 可以访问 B 站公开接口：
  - `https://api.bilibili.com/x/web-interface/view`
  - `https://api.bilibili.com/x/player/playurl`
  - `https://api.bilibili.com/x/player/v2`
  - `https://comment.bilibili.com/{cid}.xml`
- Gemini API Key，用于视觉理解、ASR、知识构建和高质量输出生成。

创建 `.env.local`：

```bash
GEMINI_API_KEY=your_key_here
```

可选模型配置：

```bash
GEMINI_VISION_MODEL=gemini-2.5-flash
GEMINI_KNOWLEDGE_MODEL=gemini-2.5-flash
GEMINI_OUTPUT_MODEL=gemini-2.5-flash
```

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

验证命令：

```bash
npm run lint
npm run build
```

## 推荐 Demo 资产

本地 Demo 数据库里可能包含调试过程中的半成品资产。录制最终演示时，优先选择状态为 `ready` 的稳定资产。

推荐资产：

1. `asset_3af991af-7b3d-450f-969f-6c80116132d1`
   - BVID：`BV1C47y65E1R`
   - 状态：`ready`
   - 证据规模：12 个关键帧、22 个转写片段、10 个知识条目。

2. `asset_b05b1957-4c52-44be-a52b-419114819822`
   - BVID：`BV1xx411c7mD`
   - 状态：`ready`
   - 证据规模：8 个关键帧、12 个转写片段、8 个知识条目。

3. `asset_demo_visual`
   - 预置的 visual-only Demo 资产。
   - 适合作为多视频综合生成里的第三个稳定资产。

录制正式 Demo 时，避免选择仍处于 `created`、`metadata_fetched` 或 `frames_extracted` 状态的资产。

## Demo 演示路线

### 1. 同一个资产生成两种输出

1. 打开 `/generate`。
2. 选择一个状态为 `ready` 的视频资产。
3. 生成 `Illustrated Summary`。
4. 切换到 `Evidence Cards`。
5. 使用同一个视频资产再次生成。
6. 说明这一步没有重新处理视频，而是复用了：
   - 已保存 metadata；
   - 已保存关键帧；
   - 已保存转写片段；
   - 已保存知识条目。

### 2. 多资产综合生成

1. 打开 `/generate`。
2. 同时选择多个资产，例如：
   - `BV1C47y65E1R` 对应资产；
   - `BV1xx411c7mD` 对应资产；
   - `Demo: visual-only facts in a technical video`。
3. 选择 `Multi-Video Synthesis`。
4. 使用类似下面的 focus prompt：

```text
比较多个视频中的论点层、视觉证据和转写证据，重点说明各自独特的信息来源。
```

5. 展示生成结果里的：
   - source coverage；
   - layered evidence；
   - comparison matrix；
   - unique evidence per asset；
   - citations。

### 3. 重复 URL 复用

1. 回到 `/`。
2. 提交一个已经处理过的 B 站 URL，例如：

```text
https://www.bilibili.com/video/BV1C47y65E1R
```

3. 应用会跳转到已有资产，并提示：

```text
This Bilibili source already exists. Reusing the saved asset without reprocessing.
```

## 处理流程

### 1. 资产身份与复用

应用会解析 BV/av 输入，并获取 B 站 metadata。插入新资产之前，会按下面的规则检查是否已经存在：

- 先检查解析出的 `bvid` 或 `aid`；
- 再检查 metadata 身份：`bvid + cid` 或 `aid + cid`。

如果同一个来源已经存在，应用会返回已有 `assetId`，并带上 `reused: true`，不会创建重复记录。

### 2. 信息驱动选帧

系统不会把固定时间间隔截图作为主要选帧策略。

候选帧来源包括：

- `scene_change`：使用 ffmpeg 场景变化检测，表达式为 `select='gt(scene,0.32)',showinfo`。
- `danmaku_hotspot`：按 10 秒窗口统计 B 站弹幕热度峰值。
- `mixed_signal`：场景变化和弹幕热度同时指向同一时刻。
- `coverage_fallback`：仅在信号不足时补少量兜底候选点。

当 B 站 metadata 提供 duration 时，候选检测覆盖完整视频时长；系统只限制最终保留的截图数量最多 12 张，不再只截取前 8 分钟。

弹幕热度会结合评论数量和高信号词，例如“高能”“名场面”“666”“破防”等。

候选帧抽取后，Gemini vision 会对每一帧打分并返回：

- visual summary；
- visible text；
- visual type；
- information density；
- retention reason；
- visual-only facts。

资产详情页会展示候选来源、候选信号原因、时间戳、帧图像、可见文字、信息密度和视觉独有事实。

### 3. 转写 / 字幕 / ASR 层

优先级如下：

1. 通过 `x/player/v2` 获取 B 站官方字幕。
2. 如果没有官方字幕，则提取完整音频到 `public/assets/{assetId}/audio-full.mp3`。
3. 使用 Gemini ASR 对保存的完整音频按 60 秒分块转写。

保存的产物包括：

- `audio-full.mp3`
- `official-subtitles.json`
- `transcript-manifest.json`
- SQLite `segments` 表中的 `startSec`、`endSec`、`text` 和 `summary`

ASR 是 Demo 级兜底能力。长视频转写可能较慢或成本较高，因此推荐顺序是：优先官方字幕，必要时再启用 ASR。

### 4. 知识资产构建

Build 步骤会组合：

- metadata；
- 视觉帧分析；
- 转写片段；
- source frame IDs；
- source segment IDs。

然后写入可复用的结构化 `knowledge_items`，包括：

- `fact`
- `claim`
- `visual_fact`
- `action_item`
- `term`
- `timeline`

每个 knowledge item 都会尽量保留来源引用。

### 5. 输出生成

当前支持的输出模式：

- `Illustrated Summary`
- `Evidence Cards`
- `Multi-Video Synthesis`

生成只使用已保存的 memory，不会重新执行：

- B 站 metadata 获取；
- playurl 解析；
- ffmpeg 抽帧；
- 音频提取；
- ASR；
- 视觉分析。

输出预览会展示复用证据，包括：

- metadata；
- frames；
- transcript segments；
- knowledge items。

多视频综合生成使用轻量结构化检索，而不是生产级向量数据库。对于每个选中的资产，系统会构建一个 compact retrieval pack：

- metadata layer；
- argument layer；
- visual layer；
- transcript layer。

生成结果包括：

- source coverage；
- common themes；
- argument / visual / transcript layered evidence；
- comparison matrix；
- unique evidence；
- open questions。

## 数据模型

SQLite 表：

- `assets`：来源身份、metadata、状态和错误信息。
- `frames`：截图、时间戳、候选来源、候选原因、视觉分析和 visual-only facts。
- `segments`：带时间戳的字幕或 ASR 转写文本。
- `knowledge_items`：带 frame/segment 引用的结构化事实。
- `outputs`：按 mode、asset IDs、prompt 和 content JSON 保存生成结果。

`public/assets/{assetId}` 下的文件：

- 关键帧截图；
- `audio-full.mp3`；
- ASR 音频分块；
- 字幕快照；
- transcript manifest。

## 失败处理

- 缺少 Gemini API Key：
  - 视觉分析、ASR 和高质量生成会返回清晰错误，或使用确定性 fallback。
  - 解决方式：把 `GEMINI_API_KEY` 加入 `.env.local`，并重启 `npm run dev`。

- 缺少 ffmpeg：
  - 帧抽取和音频抽取会失败。
  - 解决方式：安装 ffmpeg，并确保它在 `PATH` 中。

- B 站 playurl 或视频流失败：
  - 资产会保留 metadata，并显示错误。
  - 可能原因：私有视频、地区限制、流地址过期、防盗链限制。

- 没有官方字幕：
  - 使用完整音频 + ASR 作为兜底。

- ASR 分块失败：
  - 失败分块会写入占位 segment，而不是让整个资产失败。

- Gemini 生成失败：
  - 输出会 fallback 到已保存 frames、segments 和 knowledge items 的确定性渲染。

## 当前范围与取舍

这是一个 24 小时考试 Demo，因此实现优先保证完整、可解释的闭环，而不是生产级基础设施。

当前选择：

- 使用 SQLite，而不是托管 Postgres / 向量数据库。
- 使用本地文件产物，而不是云存储。
- 使用结构化检索，而不是生产级 Hybrid RAG。
- 使用 ffmpeg 场景检测 + 弹幕热度 + Gemini scoring，而不是完整视频理解流水线。
- 使用同步 route handlers，而不是持久化后台任务队列。

已知限制：

- 长时间抽取和 ASR 请求是同步执行的。
- transcript 替换是覆盖式的；官方字幕和 ASR 版本没有做版本管理。
- 暂无手动修正 frame facts 或 transcript segments 的 UI。
- 暂无 ask-box UI；当前通过输出模态展示复用和生成能力。
- 当前版本没有 Docker 配置。

## 放弃的方案

1. 完整向量数据库 RAG。
   - 放弃原因：配置、调优和检索评估会分散对必需全栈 Demo 闭环的投入。

2. 下载并保存完整源视频文件。
   - 放弃原因：会增加存储、法律和运行时成本。当前应用保存关键帧、必要时保存完整音频，以及结构化证据。

3. 完整人工标注工作台。
   - 放弃原因：手动编辑和版本管理很有价值，但不是证明视频资产复用和视觉证据抽取的最低必要能力。

## AI 协作说明

本项目使用 AI 辅助加速实现、调试和设计复盘。最有帮助的协作点包括：

- 将开放式考试题拆成可实现里程碑；
- 对照评分项识别缺口；
- 调试浏览器翻译导致的 DOM 错误；
- 改进候选帧选择，避免只用固定时间间隔；
- 设计 transcript / audio / ASR 兜底路径；
- 将多视频综合生成强化为分层结构化检索；
- 编写交付文档和 Demo 证明点。

人工决策控制了项目范围：

- 不做生产级鉴权；
- 不接入向量数据库；
- 时间不足时不增加 Docker；
- 在 README 和 Demo 证明完成前，不新增 ask-box。

## 一周后续计划

如果再给一周时间：

1. 将长时间抽取和 ASR 移到后台任务队列，支持进度轮询和重试。
2. 增加 frame、transcript segment 和 knowledge item 的修正 UI。
3. 增加针对 frames、transcript 和 knowledge rows 的 hybrid search 或向量检索。
4. 增加面向一个或多个资产的问答查询界面。
5. 增加 seed/reset 脚本和干净的 Demo 数据库。
6. 支持将生成结果导出为 Markdown 或 DOCX。
7. 增加更好的长视频分块策略和 ASR 成本控制。

## 录制检查清单

- 展示重复 URL 复用。
- 在资产详情页展示 candidate frame source。
- 展示 transcript / source media 面板。
- 用一个 ready 资产生成 Illustrated Summary。
- 用同一个 ready 资产生成 Evidence Cards。
- 用 2 个真实资产加 1 个 seed 资产生成 Multi-Video Synthesis。
- 每次生成后展示复用证据。
