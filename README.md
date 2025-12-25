# 🌟 小迹星 - 音频转 PPT 视频生成器

小迹星是一款智能教育工具，能够将课堂录音自动转换为精美的 PPT 讲解视频。通过 AI 技术，它可以识别语音内容、提取知识点、生成教学脚本和配图，最终合成带字幕的教学视频。

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ 功能特性

- 🎙️ **ASR 语音识别** - 使用火山引擎 BigModel ASR 将音频转换为文字
- 🧠 **智能知识点分析** - 使用 Doubao Seed 1.6 Flash 提取和分析知识点
- 📝 **自动生成教学脚本** - AI 生成结构化的 PPT 脚本
- 🎨 **AI 图片生成** - 使用 Gemini 3 Pro Image 生成疯狂动物城风格的教学配图
- 🔊 **TTS 语音合成** - 火山引擎 TTS 将脚本转换为自然语音
- 🎬 **视频合成** - 使用 ffmpeg 合成带字幕的教学视频

## 📋 目录

- [环境要求](#-环境要求)
- [快速开始](#-快速开始)
- [配置说明](#-配置说明)
- [使用方法](#-使用方法)
- [项目结构](#-项目结构)
- [API 文档](#-api-文档)
- [常见问题](#-常见问题)

## 🔧 环境要求

- **Node.js** 18.0 或更高版本
- **npm** 或 **yarn**
- **ffmpeg** （用于音频处理和视频合成）

### 安装 ffmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install ffmpeg

# Windows (使用 Chocolatey)
choco install ffmpeg

# Windows (手动安装)
# 从 https://ffmpeg.org/download.html 下载并添加到系统 PATH
```

验证安装：

```bash
ffmpeg -version
```

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/xiaojixing.git
cd xiaojixing
```

### 2. 安装依赖

```bash
# 安装前端和后端所有依赖（会自动安装 server 目录的依赖）
npm install
```

或分别安装：

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install
```

### 3. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API 密钥（详见 [配置说明](#-配置说明)）。

### 4. 启动项目

```bash
# 同时启动前端和后端服务
npm start
```

或者分别启动：

```bash
# 终端 1 - 启动后端服务（端口 3001）
npm run server:dev

# 终端 2 - 启动前端开发服务器（端口 5173）
npm run dev
```

### 5. 访问应用

打开浏览器访问：

- 🌐 前端：http://localhost:5173
- 🔌 后端 API：http://localhost:3001
- 💓 健康检查：http://localhost:3001/api/health
- ⚙️ 配置状态：http://localhost:3001/api/config/status

## ⚙️ 配置说明

### 环境变量

在项目根目录创建 `.env` 文件，配置以下环境变量：

```env
# ========================================
# TAL MLOps API (用于 Doubao LLM 和 Gemini 图片生成)
# ========================================
VITE_TAL_MLOPS_APP_ID=your_tal_app_id
VITE_TAL_MLOPS_APP_KEY=your_tal_app_key

# 可选：自定义 TAL API 地址
# TAL_API_BASE_URL=http://ai-service.tal.com/openai-compatible

# ========================================
# 火山引擎 API (用于 ASR 语音识别和 TTS 语音合成)
# ========================================
VOLCENGINE_APP_ID=your_volcengine_app_id
VOLCENGINE_ACCESS_TOKEN=your_volcengine_access_token

# 可选：ASR 资源 ID
# VOLCENGINE_ASR_RESOURCE_ID=volc.bigasr.auc_turbo

# ========================================
# TTS 语音合成配置（可选，不设置则使用上面的火山引擎配置）
# ========================================
# TTS_APP_ID=your_tts_app_id
# TTS_TOKEN=your_tts_token
# TTS_VOICE_TYPE=zh_female_shuangkuaisisi_moon_bigtts
# TTS_CLUSTER=volcano_tts

# ========================================
# 服务器配置（可选）
# ========================================
# PORT=3001
```

### API 密钥获取

| 服务 | 获取地址 | 用途 |
|------|----------|------|
| TAL MLOps | 联系 TAL 技术支持 | Doubao LLM、Gemini 图片生成 |
| 火山引擎 | https://console.volcengine.com | ASR 语音识别、TTS 语音合成 |

## 📖 使用方法

1. **上传音频文件**
   - 支持格式：MP3、WAV、M4A
   - 文件大小限制：500MB

2. **设置时间标记**
   - 在音频的关键知识点位置添加时间标记
   - 系统会自动截取标记点前后的音频进行处理

3. **等待处理**
   - ASR 识别 → 知识点分析 → 脚本生成 → 图片生成 → TTS 合成 → 视频合成
   - 处理进度实时显示

4. **下载成果**
   - 查看生成的 PPT 图片
   - 播放合成的教学视频
   - 下载视频文件

## 📁 项目结构

```
xiaojixing/
├── src/                    # 前端源码 (React + TypeScript)
│   ├── components/         # UI 组件
│   │   ├── Header.tsx      # 顶部导航
│   │   ├── VideoCard.tsx   # 视频卡片
│   │   ├── UploadModal.tsx # 上传弹窗
│   │   └── ...
│   ├── pages/              # 页面组件
│   │   ├── HomePage.tsx    # 首页
│   │   └── VideoDetailPage.tsx  # 视频详情页
│   ├── services/           # API 服务
│   │   ├── api.ts          # 后端 API 调用
│   │   └── videoProcessor.ts    # 视频处理逻辑
│   ├── store/              # 状态管理 (Zustand)
│   ├── types/              # TypeScript 类型定义
│   ├── App.tsx             # 根组件
│   └── main.tsx            # 入口文件
│
├── server/                 # 后端源码 (Node.js + Express)
│   ├── services/           # 服务模块
│   │   ├── asr.js          # ASR 语音识别
│   │   ├── llm.js          # LLM 知识点分析
│   │   ├── imageGen.js     # 图片生成
│   │   ├── tts.js          # TTS 语音合成
│   │   ├── videoSynth.js   # 视频合成
│   │   └── processor.js    # 主处理流程
│   ├── index.js            # 服务入口
│   ├── config.js           # 配置管理
│   ├── temp/               # 临时文件
│   └── output/             # 输出文件
│
├── public/                 # 静态资源
├── script/                 # 测试脚本
├── .env                    # 环境变量配置
├── package.json            # 项目依赖
├── vite.config.ts          # Vite 配置
├── tailwind.config.js      # TailwindCSS 配置
└── tsconfig.json           # TypeScript 配置
```

## 📡 API 文档

### 健康检查

```http
GET /api/health
```

**响应示例：**
```json
{
  "status": "ok",
  "ffmpeg": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 配置状态

```http
GET /api/config/status
```

**响应示例：**
```json
{
  "talApi": { "configured": true, "baseUrl": "http://ai-service.tal.com/openai-compatible" },
  "volcengineAsr": { "configured": true },
  "volcengineTts": { "configured": true },
  "ffmpeg": true
}
```

### 上传并处理音频

```http
POST /api/process
Content-Type: multipart/form-data

audio: [音频文件]
markers: "[600, 1200, 1800]"  // 时间标记（秒）
```

**响应示例：**
```json
{
  "taskId": "abc123xyz",
  "status": "processing",
  "message": "任务已创建，正在处理中"
}
```

### 获取任务状态

```http
GET /api/tasks/:taskId
```

**响应示例：**
```json
{
  "id": "abc123xyz",
  "status": "completed",
  "progress": 100,
  "message": "处理完成",
  "results": [...],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:05:00.000Z"
}
```

### 获取所有任务

```http
GET /api/tasks
```

### 获取输出文件

```http
GET /api/files/:taskId/:filename
```

支持的文件类型：
- 图片：`slide_1.jpg`, `slide_2.jpg`, ...
- 音频：`slide_1_audio.mp3`, `slide_2_audio.mp3`, ...
- 视频：`final_video.mp4`

### 删除任务

```http
DELETE /api/tasks/:taskId
```

## 🛠️ 开发命令

```bash
# 启动开发环境（前端 + 后端）
npm start

# 仅启动前端开发服务器
npm run dev

# 仅启动后端服务（开发模式，支持热重载）
npm run server:dev

# 仅启动后端服务（生产模式）
npm run server

# 构建前端生产版本
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint

# 安装后端依赖
npm run server:install
```

## ❓ 常见问题

### 1. ffmpeg 未找到

**问题：** 启动服务时提示 "ffmpeg not installed"

**解决：**
- 确保 ffmpeg 已正确安装
- 确保 ffmpeg 在系统 PATH 中
- 运行 `ffmpeg -version` 验证安装

### 2. API 密钥配置错误

**问题：** 处理时提示 API 调用失败

**解决：**
- 访问 http://localhost:3001/api/config/status 检查配置状态
- 确认 `.env` 文件中的密钥正确
- 确认密钥有足够的调用配额

### 3. 音频处理失败

**问题：** 上传音频后处理失败

**解决：**
- 确保音频格式为 MP3、WAV 或 M4A
- 检查文件大小是否超过 500MB
- 查看后端控制台的错误日志

### 4. 图片生成超时

**问题：** 图片生成步骤耗时过长

**解决：**
- Gemini 图片生成可能需要 30-60 秒
- 网络不稳定时可能更慢
- 失败时会自动生成占位图

### 5. 端口被占用

**问题：** 启动时提示端口被占用

**解决：**
```bash
# 查看占用端口的进程
lsof -i :3001
lsof -i :5173

# 终止进程
kill -9 <PID>

# 或修改 .env 中的 PORT 配置
```

## 📄 技术栈

**前端：**
- React 18
- TypeScript
- Vite
- TailwindCSS
- Zustand (状态管理)
- React Router

**后端：**
- Node.js
- Express
- Multer (文件上传)
- Sharp (图片处理)
- Fluent-ffmpeg (视频处理)

**AI 服务：**
- 火山引擎 BigModel ASR
- Doubao Seed 1.6 Flash (知识点分析)
- Gemini 3 Pro Image (图片生成)
- 火山引擎 TTS

## 📜 License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

<p align="center">
  Made with ❤️ by 小迹星团队
</p>

# xiaojixing
