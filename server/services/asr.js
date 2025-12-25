/**
 * ASR 语音识别服务
 * 基于火山引擎 BigModel ASR API
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { config } from '../config.js';

/**
 * 检查 ffmpeg 是否可用
 */
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取音频文件时长（秒）
 */
export function getAudioDuration(filePath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf-8' }
    );
    return parseFloat(output.trim());
  } catch (error) {
    console.error('获取音频时长失败:', error);
    throw error;
  }
}

/**
 * 截取音频片段
 * @param {string} inputFile - 输入文件路径
 * @param {string} outputFile - 输出文件路径
 * @param {number} startTime - 开始时间（秒）
 * @param {number} duration - 时长（秒）
 */
export function extractAudioSegment(inputFile, outputFile, startTime, duration) {
  try {
    execSync(
      `ffmpeg -i "${inputFile}" -ss ${startTime} -t ${duration} -acodec libmp3lame -ar 16000 -ac 1 "${outputFile}" -y`,
      { stdio: 'ignore' }
    );
    return true;
  } catch (error) {
    console.error('截取音频片段失败:', error);
    throw error;
  }
}

/**
 * 将文件转换为 base64
 */
function fileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

/**
 * 调用火山引擎 BigModel ASR API 识别单个音频片段
 * 参考 test-volcengine-asr.js 实现
 * @param {string} audioBase64 - base64 编码的音频数据
 * @returns {Promise<string>} - 识别结果文本
 */
async function callASRAPI(audioBase64) {
  const { baseUrl, appId, accessToken, resourceId } = config.volcengineAsr;
  const requestId = randomUUID();
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-App-Key': appId,
    'X-Api-Access-Key': accessToken,
    'X-Api-Resource-Id': resourceId,
    'X-Api-Request-Id': requestId,
    'X-Api-Sequence': '-1',
  };

  const body = {
    user: {
      uid: appId,
    },
    audio: {
      data: audioBase64,
    },
    request: {
      model_name: 'bigmodel',
    },
  };

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    // 检查响应头中的状态码
    const statusCode = response.headers.get('X-Api-Status-Code');
    const message = response.headers.get('X-Api-Message');
    const logid = response.headers.get('X-Tt-Logid');

    console.log(`ASR 请求 (reqId: ${requestId}): statusCode=${statusCode}, logid=${logid}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ASR API 请求失败:', response.status, errorText);
      throw new Error(`ASR API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // 检查状态码
    // 20000000 = 成功
    // 20000003 = 静音片段，无有效语音（这是正常情况，不应该报错）
    if (statusCode === '20000003') {
      console.log('ASR: 该片段为静音，跳过');
      return '';  // 静音片段返回空字符串
    }
    
    if (statusCode !== '20000000') {
      console.error('ASR API 返回错误:', statusCode, message);
      throw new Error(`ASR API error: ${statusCode} - ${message || 'Unknown error'}`);
    }

    // 提取识别结果文本
    const text = data.result?.text || '';
    return text;
  } catch (error) {
    console.error('ASR API 调用失败:', error);
    throw error;
  }
}

/**
 * 识别音频文件
 * @param {string} audioFilePath - 音频文件路径
 * @param {number} startTime - 开始时间（秒）
 * @param {number} endTime - 结束时间（秒）
 * @param {function} onProgress - 进度回调
 * @returns {Promise<string>} - 完整识别结果
 */
export async function transcribeAudio(audioFilePath, startTime, endTime, onProgress) {
  if (!checkFFmpeg()) {
    throw new Error('ffmpeg 未安装，请先安装 ffmpeg');
  }

  const tempDir = config.tempDir;
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const duration = endTime - startTime;
  const segmentDuration = 60; // 每段60秒
  const segmentCount = Math.ceil(duration / segmentDuration);
  const segmentResults = [];

  console.log(`开始识别音频: ${startTime}s - ${endTime}s, 共 ${segmentCount} 个片段`);

  // 准备所有片段的任务
  const segmentTasks = [];
  for (let i = 0; i < segmentCount; i++) {
    const segmentStart = startTime + i * segmentDuration;
    const segmentLength = Math.min(segmentDuration, endTime - segmentStart);
    const segmentFile = path.join(tempDir, `segment_${Date.now()}_${i}.mp3`);

    segmentTasks.push({
      index: i,
      segmentStart,
      segmentLength,
      segmentFile,
    });
  }

  // 并发处理片段，限制并发数为 3
  const CONCURRENT_LIMIT = 3;
  let completedCount = 0;
  const allResults = [];
  
  // 处理单个片段的任务
  const processSegment = async ({ index, segmentStart, segmentLength, segmentFile }) => {
    try {
      // 截取音频片段
      extractAudioSegment(audioFilePath, segmentFile, segmentStart, segmentLength);

      // 转换为 base64 并调用 API
      const audioBase64 = fileToBase64(segmentFile);
      const text = await callASRAPI(audioBase64);
      
      completedCount++;
      const progress = Math.round((completedCount / segmentCount) * 80);
      onProgress?.(progress, `正在处理片段 ${completedCount}/${segmentCount}...`);
      
      console.log(`片段 ${index + 1}/${segmentCount} 识别完成: ${text.substring(0, 50)}...`);
      
      return {
        index,
        text: text || '',
        success: true,
      };
    } catch (error) {
      completedCount++;
      const progress = Math.round((completedCount / segmentCount) * 80);
      onProgress?.(progress, `正在处理片段 ${completedCount}/${segmentCount}...`);
      
      console.error(`片段 ${index + 1} 识别失败:`, error);
      return {
        index,
        text: `[片段 ${index + 1} 识别失败]`,
        success: false,
      };
    } finally {
      // 清理临时文件
      if (fs.existsSync(segmentFile)) {
        fs.unlinkSync(segmentFile);
      }
    }
  };

  // 控制并发执行
  for (let i = 0; i < segmentTasks.length; i += CONCURRENT_LIMIT) {
    const batch = segmentTasks.slice(i, i + CONCURRENT_LIMIT);
    const batchResults = await Promise.all(batch.map(processSegment));
    allResults.push(...batchResults);
  }

  // 按索引排序并合并结果
  allResults.sort((a, b) => a.index - b.index);
  const results = allResults.map(r => r.text);

  onProgress?.(100, '语音识别完成');
  return results.join('\n');
}

/**
 * 快速识别整个音频文件（适用于较短的音频）
 * @param {string} audioFilePath - 音频文件路径
 * @returns {Promise<string>} - 识别结果
 */
export async function quickTranscribe(audioFilePath) {
  const audioBase64 = fileToBase64(audioFilePath);
  return await callASRAPI(audioBase64);
}

