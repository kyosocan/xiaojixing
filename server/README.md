# 小迹星后端服务

这是小迹星应用的后端服务，负责处理音频文件、生成 PPT 视频。

## 功能特性

- **ASR 语音识别**：将音频转换为文字
- **知识点分析**：使用 Doubao Seed 1.6 Flash 分析知识点
- **PPT 脚本生成**：自动生成教学脚本
- **图片生成**：使用 Gemini 3 Pro Image 生成疯狂动物城风格的图片
- **TTS 语音合成**：将脚本转换为语音
- **视频合成**：使用 ffmpeg 合成带字幕的视频

## 环境要求

- Node.js 18+
- ffmpeg（用于音频处理和视频合成）

### 安装 ffmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# 从 https://ffmpeg.org/download.html 下载并添加到 PATH
```

## 配置

在项目根目录的 `.env` 文件中配置以下环境变量：

```env
# TAL MLOps API (用于 Doubao 和 Gemini)
VITE_TAL_MLOPS_APP_ID=your_app_id
VITE_TAL_MLOPS_APP_KEY=your_app_key

# 火山引擎 ASR/TTS API
VOLCENGINE_APP_ID=your_volcengine_app_id
VOLCENGINE_ACCESS_TOKEN=your_volcengine_access_token

# TTS 语音合成（可选，不设置则使用上面的 VOLCENGINE 配置）
TTS_APP_ID=your_tts_app_id
TTS_TOKEN=your_tts_token
TTS_VOICE_TYPE=zh_female_shuangkuaisisi_moon_bigtts
```

## 安装依赖

```bash
# 在 server 目录下
npm install
```

或者在项目根目录：

```bash
npm run server:install
```

## 启动服务

```bash
# 开发模式（支持热重载）
npm run server:dev

# 生产模式
npm run server
```

服务默认运行在 `http://localhost:3001`

## API 接口

### 健康检查

```
GET /api/health
```

返回服务状态和 ffmpeg 可用性。

### 配置状态

```
GET /api/config/status
```

返回各个服务的配置状态。

### 上传并处理

```
POST /api/process
Content-Type: multipart/form-data

audio: 音频文件 (MP3/WAV/M4A)
markers: JSON 数组，时间标记（秒），如 "[600, 1200]"
```

返回任务 ID，可通过轮询获取处理状态。

### 获取任务状态

```
GET /api/tasks/:taskId
```

返回任务的当前状态和处理进度。

### 获取输出文件

```
GET /api/files/:taskId/:filename
```

获取生成的图片、音频、视频文件。

## 处理流程

1. **音频截取**：根据时间标记截取前 10 分钟、后 5 分钟的音频
2. **ASR 识别**：将音频转换为文字
3. **知识点分析**：使用 LLM 提取知识点
4. **脚本生成**：生成 5-7 页 PPT 的脚本
5. **图片生成**：为每页生成疯狂动物城风格的图片
6. **TTS 合成**：将逐字稿转换为语音
7. **视频合成**：将图片和音频合成为带字幕的视频

## 目录结构

```
server/
├── index.js          # 主入口，Express 服务
├── config.js         # 配置文件
├── package.json      # 依赖配置
├── services/
│   ├── asr.js        # ASR 语音识别服务
│   ├── tts.js        # TTS 语音合成服务
│   ├── llm.js        # LLM 服务（Doubao）
│   ├── imageGen.js   # 图片生成服务（Gemini）
│   ├── videoSynth.js # 视频合成服务
│   └── processor.js  # 主处理逻辑
├── temp/             # 临时文件目录
└── output/           # 输出文件目录
```

## 注意事项

1. 确保 ffmpeg 已正确安装并在 PATH 中
2. 音频文件大小限制为 500MB
3. TTS 单次请求文本限制为 1024 字节，长文本会自动分段处理
4. 图片生成可能需要较长时间，请耐心等待

