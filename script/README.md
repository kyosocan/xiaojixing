# API 测试脚本

这个目录包含以下测试脚本：

## ASR（自动语音识别）API 测试脚本

1. **test-asr-api.js** - 通用 ASR API 测试脚本（旧版 API）
2. **test-volcengine-asr.js** - 火山引擎 ASR API 测试脚本（新版 API，推荐使用）

## TTS（文本转语音）API 测试脚本

3. **test-tts-api.js** - 字节跳动 TTS API 测试脚本

## 功能

两个脚本都提供以下功能：

1. 读取 MP3 音频文件
2. 将音频文件切分成 1 分钟（60秒）的片段
3. 对每个片段调用 ASR API 进行语音识别
4. 将所有识别结果拼接并保存到文件

---

## 火山引擎 ASR API 脚本（推荐）

### 使用方法

#### 方法 1: 使用命令行参数

```bash
node script/test-volcengine-asr.js <mp3文件路径> \
  --app-id 123456789 \
  --access-token your_access_token
```

#### 方法 2: 使用环境变量

```bash
export VOLCENGINE_APP_ID=123456789
export VOLCENGINE_ACCESS_TOKEN=your_access_token

node script/test-volcengine-asr.js audio.mp3
```

#### 完整示例

```bash
# 使用命令行参数
node script/test-volcengine-asr.js test.mp3 \
  --app-id 123456789 \
  --access-token your_access_token \
  --output result.txt \
  --save-json  # 可选：同时保存完整 JSON 响应

# 使用环境变量
export VOLCENGINE_APP_ID=123456789
export VOLCENGINE_ACCESS_TOKEN=your_access_token

node script/test-volcengine-asr.js test.mp3 --output result.txt
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--app-id` | App ID（从火山引擎控制台获取） | 环境变量 `VOLCENGINE_APP_ID` |
| `--access-token` | Access Token（从火山引擎控制台获取） | 环境变量 `VOLCENGINE_ACCESS_TOKEN` |
| `--duration` | 每个片段的时长（秒） | `60` |
| `--output` | 输出文件路径 | `volcengine_asr_result_<timestamp>.txt` |
| `--save-json` | 同时保存完整的 JSON 响应到文件 | `false` |

### API 配置说明

脚本使用火山引擎的 Flash 识别接口：

- **API URL**: `https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`
- **请求头**:
  - `X-Api-App-Key`: App ID
  - `X-Api-Access-Key`: Access Token
  - `X-Api-Resource-Id`: `volc.bigasr.auc_turbo`
  - `X-Api-Request-Id`: 随机生成的 UUID
  - `X-Api-Sequence`: `-1`
- **请求体**:
  - `user.uid`: App ID
  - `audio.data`: base64 编码的音频数据
  - `request.model_name`: `bigmodel`

### 响应处理

脚本会检查响应头中的状态码：
- `X-Api-Status-Code: 20000000` 表示成功
- 其他状态码表示错误（详见错误码表）

识别结果从 `result.text` 字段提取。

---

## 通用 ASR API 脚本（旧版）

## 前置要求

1. **Node.js**: 需要 Node.js 18+ 版本（支持原生 fetch API）
2. **ffmpeg**: 用于音频文件处理和切分
   - macOS: `brew install ffmpeg`
   - Linux: `apt-get install ffmpeg` 或 `yum install ffmpeg`
   - Windows: 从 [ffmpeg官网](https://ffmpeg.org/download.html) 下载安装

### 使用方法

#### 方法 1: 使用命令行参数

```bash
node script/test-asr-api.js <mp3文件路径> \
  --api-url http://your-api-host \
  --app-id 1000000000 \
  --server-key your_server_key \
  --token your_token  # 可选，公网环境需要
```

#### 方法 2: 使用环境变量

```bash
export ASR_API_BASE_URL=http://your-api-host
export ASR_APP_ID=1000000000
export ASR_SERVER_KEY=your_server_key
export ASR_TOKEN=your_token  # 可选，公网环境需要

node script/test-asr-api.js audio.mp3
```

#### 完整示例

```bash
# 使用命令行参数
node script/test-asr-api.js test.mp3 \
  --api-url http://api.example.com \
  --app-id 1000000000 \
  --server-key 97309113e96565844f16d440d12b933e \
  --token eyJhbGci0iJIUzI1NiIsInR5cCI6IkpXVCJ9... \
  --output result.txt

# 使用环境变量
export ASR_API_BASE_URL=http://api.example.com
export ASR_APP_ID=1000000000
export ASR_SERVER_KEY=97309113e96565844f16d440d12b933e
export ASR_TOKEN=eyJhbGci0iJIUzI1NiIsInR5cCI6IkpXVCJ9...

node script/test-asr-api.js test.mp3 --output result.txt
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--api-url` | API 基础 URL | 环境变量 `ASR_API_BASE_URL` |
| `--app-id` | 应用 ID | 环境变量 `ASR_APP_ID` |
| `--server-key` | 服务器密钥 | 环境变量 `ASR_SERVER_KEY` |
| `--token` | 公网环境 token（Web端） | 环境变量 `ASR_TOKEN` |
| `--cluster` | 集群名称 | `volcengine_input_common` |
| `--format` | 音频格式 | `mp3` |
| `--duration` | 每个片段的时长（秒） | `60` |
| `--output` | 输出文件路径 | `asr_result_<timestamp>.txt` |

### API 配置说明

根据 API 文档，脚本会：

1. **设置请求头**:
   - `Authorization: Bearer appID:serverKey`
   - `api-key: appID:serverKey`

2. **设置请求参数**:
   - `cluster`: 集群名称（默认 `volcengine_input_common`）
   - `format`: 音频格式（默认 `mp3`）
   - `audio_data`: base64 编码的音频数据

3. **公网环境**:
   - 如果提供了 `token`，会将其添加到 URL query 参数中: `?token=xxx`

---

## 输出文件格式

两个脚本都会生成一个文本文件，包含：

1. **文件头信息**: 生成时间、输入文件、总片段数、运行耗时
2. **每个片段的识别结果**: 包含时间段和识别文本
3. **合并结果**: 所有片段识别文本的拼接

示例输出：

```
火山引擎 ASR 识别结果
生成时间: 2024/1/1 12:00:00
输入文件: test.mp3
总片段数: 5
程序运行耗时: 45.23 秒
============================================================

片段 1 [00:00 - 01:00]
LogID: 202506191943547B30C313640AF
------------------------------------------------------------
这是第一分钟的识别结果...

片段 2 [01:00 - 02:00]
LogID: 202506191944127B30C313640AF
------------------------------------------------------------
这是第二分钟的识别结果...

...

============================================================
合并结果:
============================================================

这是第一分钟的识别结果...
这是第二分钟的识别结果...
...
```

## 注意事项

1. **音频文件大小**: API 限制音频文件 ≤60秒且 ≤2MB，脚本会自动切分成 60 秒的片段
2. **网络环境**: 
   - 内网环境：不需要 token（仅适用于旧版 API）
   - 公网环境：需要 token（仅适用于旧版 API）
   - 火山引擎 API：需要 App ID 和 Access Token（从控制台获取）
3. **临时文件**: 脚本会在音频文件同目录下创建临时目录用于存储切分的片段，处理完成后会自动清理
4. **错误码**: 火山引擎 API 返回的状态码：
   - `20000000`: 成功
   - `20000003`: 静音音频
   - `45000001`: 请求参数无效
   - `45000002`: 空音频
   - `45000151`: 音频格式不正确
   - `550XXXX`: 服务内部处理错误
   - `55000031`: 服务器繁忙

## 故障排查

1. **ffmpeg 未找到**: 确保已安装 ffmpeg 并在 PATH 中
2. **API 调用失败**: 
   - 检查 App ID 和 Access Token 是否正确（火山引擎）
   - 检查 API URL、app-id、server-key 是否正确（旧版 API）
3. **token 错误**: 公网环境需要有效的 token（仅适用于旧版 API）
4. **音频格式不支持**: 确保音频文件是 mp3 格式
5. **状态码错误**: 查看响应头中的 `X-Api-Status-Code` 和 `X-Api-Message` 了解具体错误原因

## 获取凭证

### 火山引擎 API

从火山引擎控制台获取：
- App ID (`X-Api-App-Key`)
- Access Token (`X-Api-Access-Key`)

参考：[控制台使用 FAQ](https://console.volcengine.com/)

### 旧版 API Token（公网环境）

如果需要获取 token，可以调用 `/v1/issueToken` 接口：

```bash
curl 'http://{{host}}/v1/issueToken' \
  -H 'api-key: appID:serverKey'
```

响应示例：
```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "token": "eyJhbGci0iJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## TTS API 测试脚本

### 前置要求

1. **Node.js**: 需要 Node.js 18+ 版本（支持原生 fetch API）

### 使用方法

#### 方法 1: 使用命令行参数

```bash
node script/test-tts-api.js "你好，这是测试文本" \
  --app-id appid123 \
  --token your_token
```

#### 方法 2: 使用环境变量

```bash
export TTS_APP_ID=appid123
export TTS_TOKEN=your_token

node script/test-tts-api.js "测试文本"
```

#### 方法 3: 从文件读取文本

```bash
node script/test-tts-api.js \
  --text-file input.txt \
  --app-id appid123 \
  --token your_token \
  --output output.mp3
```

#### 完整示例

```bash
# 使用命令行参数
node script/test-tts-api.js "字节跳动语音合成" \
  --app-id appid123 \
  --token access_token \
  --voice-type zh_male_M392_conversation_wvae_bigtts \
  --encoding mp3 \
  --speed-ratio 1.0 \
  --output output.mp3

# 使用环境变量
export TTS_APP_ID=appid123
export TTS_TOKEN=access_token
export TTS_VOICE_TYPE=zh_male_M392_conversation_wvae_bigtts

node script/test-tts-api.js "测试文本" --output output.mp3

# 从文件读取文本
node script/test-tts-api.js \
  --text-file long_text.txt \
  --app-id appid123 \
  --token access_token \
  --output output.mp3
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--api-url` | API URL | `https://openspeech.bytedance.com/api/v1/tts` |
| `--app-id` | App ID（从控制台获取） | 环境变量 `TTS_APP_ID` |
| `--token` | Token（从控制台获取） | 环境变量 `TTS_TOKEN` |
| `--cluster` | 集群名称 | `volcano_tts` |
| `--uid` | 用户ID | `test_user` |
| `--voice-type` | 音色类型 | `zh_male_M392_conversation_wvae_bigtts` |
| `--encoding` | 音频编码格式 | `mp3` (可选: wav/pcm/ogg_opus/mp3) |
| `--speed-ratio` | 语速 | `1.0` (范围: 0.1-2.0) |
| `--rate` | 采样率 | `24000` (可选: 8000/16000/24000) |
| `--operation` | 操作类型 | `query` (可选: query/submit) |
| `--output` | 输出文件路径 | `tts_output_<timestamp>.<encoding>` |
| `--text-file` | 从文件读取文本内容 | - |

### API 配置说明

脚本使用字节跳动的 TTS 接口：

- **API URL**: `https://openspeech.bytedance.com/api/v1/tts`
- **请求方法**: HTTP POST
- **请求头**:
  - `Authorization: Bearer;${token}` (注意：Bearer和token之间用分号分隔)
  - `Content-Type: application/json`
- **请求体**:
  - `app`: {appid, token, cluster}
  - `user`: {uid}
  - `audio`: {voice_type, encoding, speed_ratio, rate}
  - `request`: {reqid, text, operation}

### 响应处理

脚本会检查响应中的状态码：
- `code: 3000` 表示成功
- 其他状态码表示错误（详见错误码表）

音频数据从 `data` 字段提取（base64 编码），脚本会自动解码并保存为音频文件。

### 输出文件

脚本会生成两个文件：
1. **音频文件**: 合成的音频文件（格式由 `--encoding` 指定）
2. **信息文件**: `*_info.txt`，包含请求详情和文本内容

### 注意事项

1. **文本长度限制**: 单次请求文本长度限制为 1024 字节（UTF-8编码）
2. **reqid 唯一性**: 每次请求都会自动生成唯一的 UUID 作为 reqid
3. **音频格式**:
   - `wav` 格式不支持流式（operation=submit）
   - `pcm` 为默认格式
   - `mp3` 支持流式
4. **错误码**: API 返回的错误码：
   - `3000`: 请求正确
   - `3001`: 无效的请求
   - `3003`: 并发超限
   - `3005`: 后端服务忙
   - `3006`: 服务中断
   - `3010`: 文本长度超限
   - `3011`: 无效文本
   - `3030`: 处理超时

### 故障排查

1. **API 调用失败**: 
   - 检查 App ID 和 Token 是否正确
   - 确认 Token 格式正确（Bearer和token之间用分号分隔）
2. **文本长度超限**: 确保文本不超过 1024 字节（UTF-8编码）
3. **音频格式不支持**: 确保 encoding 参数正确（wav/pcm/ogg_opus/mp3）
4. **状态码错误**: 查看返回的 `code` 和 `message` 字段了解具体错误原因

### 获取凭证

从字节跳动控制台获取：
- App ID (`appid`)
- Token (`token`)
- Cluster (`cluster`，默认为 `volcano_tts`)

参考：[控制台使用 FAQ-Q1](https://console.volcengine.com/)

