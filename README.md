# 🌟 小记星 - 音频转 PPT 视频生成器

小记星是一款智能教育工具，能够将课堂录音自动转换为精美的 PPT 讲解视频。通过 AI 技术，它可以识别语音内容、提取知识点、生成教学脚本和配图，最终合成带字幕的教学视频。

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
- [部署指南](#-部署指南)
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
