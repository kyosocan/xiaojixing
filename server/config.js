/**
 * 服务配置
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env 文件（从项目根目录）
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  // 服务器配置
  port: process.env.PORT || 3001,
  
  // TAL MLOps API（用于 Doubao 和 Gemini）
  talApi: {
    baseUrl: process.env.TAL_API_BASE_URL || 'http://ai-service.tal.com/openai-compatible',
    appId: process.env.VITE_TAL_MLOPS_APP_ID || '',
    appKey: process.env.VITE_TAL_MLOPS_APP_KEY || '',
  },
  
  // 火山引擎 BigModel ASR 配置
  volcengineAsr: {
    baseUrl: process.env.VOLCENGINE_ASR_BASE_URL || 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash',
    appId: process.env.VOLCENGINE_APP_ID || '',
    accessToken: process.env.VOLCENGINE_ACCESS_TOKEN || '',
    resourceId: process.env.VOLCENGINE_ASR_RESOURCE_ID || 'volc.bigasr.auc_turbo',
  },
  
  // 火山引擎 TTS 配置
  volcengineTts: {
    baseUrl: process.env.TTS_API_URL || 'https://openspeech.bytedance.com/api/v1/tts',
    appId: process.env.TTS_APP_ID || process.env.VOLCENGINE_APP_ID || '',
    token: process.env.TTS_TOKEN || process.env.VOLCENGINE_ACCESS_TOKEN || '',
    cluster: process.env.TTS_CLUSTER || 'volcano_tts',
    voiceType: process.env.TTS_VOICE_TYPE || 'BV406_streaming',
    encoding: 'mp3',
    speedRatio: 1.0,
    rate: 24000,
  },
  
  // 临时文件目录
  tempDir: path.join(__dirname, 'temp'),
  outputDir: path.join(__dirname, 'output'),
};

// 获取 TAL API 密钥
export function getTalApiKey() {
  return `${config.talApi.appId}:${config.talApi.appKey}`;
}

