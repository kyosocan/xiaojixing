/**
 * TTS 语音合成服务
 * 基于火山引擎语音合成 API
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config.js';

/**
 * 调用 TTS API 合成语音
 * @param {string} text - 要合成的文本
 * @param {object} options - 选项
 * @returns {Promise<Buffer>} - 音频数据
 */
async function callTTSAPI(text, options = {}) {
  const { baseUrl, appId, token, cluster, voiceType, encoding, speedRatio, rate } = config.volcengineTts;
  
  const reqid = randomUUID();
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer;${token}`,
  };

  const body = {
    app: {
      appid: appId,
      token: token,
      cluster: cluster,
    },
    user: {
      uid: 'xiaojixing_user',
    },
    audio: {
      voice_type: options.voiceType || voiceType,
      encoding: options.encoding || encoding,
      speed_ratio: options.speedRatio || speedRatio,
      rate: options.rate || rate,
    },
    request: {
      reqid: reqid,
      text: text,
      operation: 'query', // 非流式
    },
  };

  try {
    console.log(`TTS 请求 (reqid: ${reqid}): ${text.substring(0, 50)}...`);
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API 请求失败:', response.status, errorText);
      throw new Error(`TTS API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 3000) {
      console.error('TTS API 返回错误:', data);
      throw new Error(`TTS API error: code=${data.code}, message=${data.message || 'Unknown'}`);
    }

    if (!data.data) {
      throw new Error('TTS API 返回的音频数据为空');
    }

    // 解码 base64 音频数据
    const audioBuffer = Buffer.from(data.data, 'base64');
    
    console.log(`TTS 合成成功: ${audioBuffer.length} bytes, 时长: ${data.addition?.duration || 'unknown'}ms`);
    
    return {
      buffer: audioBuffer,
      duration: data.addition?.duration,
      reqid: data.reqid,
    };
  } catch (error) {
    console.error('TTS API 调用失败:', error);
    throw error;
  }
}

/**
 * 将文本转换为语音并保存到文件
 * @param {string} text - 要合成的文本
 * @param {string} outputPath - 输出文件路径
 * @param {object} options - 选项
 * @returns {Promise<{filepath: string, duration: number}>}
 */
export async function textToSpeechFile(text, outputPath, options = {}) {
  // 检查文本长度（UTF-8编码限制1024字节）
  const textBytes = Buffer.from(text, 'utf-8').length;
  
  if (textBytes > 1024) {
    // 文本太长，需要分段处理
    return await synthesizeLongText(text, outputPath, options);
  }

  const result = await callTTSAPI(text, options);
  
  // 确保输出目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, result.buffer);
  
  return {
    filepath: outputPath,
    duration: result.duration,
    size: result.buffer.length,
  };
}

/**
 * 将文本转换为语音，返回 base64
 * @param {string} text - 要合成的文本
 * @param {object} options - 选项
 * @returns {Promise<{base64: string, duration: number}>}
 */
export async function textToSpeechBase64(text, options = {}) {
  const textBytes = Buffer.from(text, 'utf-8').length;
  
  if (textBytes > 1024) {
    // 文本太长，需要分段处理并合并
    const tempPath = path.join(config.tempDir, `tts_temp_${Date.now()}.mp3`);
    const result = await synthesizeLongText(text, tempPath, options);
    const buffer = fs.readFileSync(result.filepath);
    
    // 清理临时文件
    fs.unlinkSync(result.filepath);
    
    return {
      base64: buffer.toString('base64'),
      duration: result.duration,
    };
  }

  const result = await callTTSAPI(text, options);
  
  return {
    base64: result.buffer.toString('base64'),
    duration: result.duration,
  };
}

/**
 * 分段合成长文本
 * @param {string} text - 长文本
 * @param {string} outputPath - 输出文件路径
 * @param {object} options - 选项
 */
async function synthesizeLongText(text, outputPath, options = {}) {
  const { execSync } = await import('child_process');
  const tempDir = config.tempDir;
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 按标点符号分割文本
  const segments = splitTextByPunctuation(text, 300); // 每段约300字符
  const tempFiles = [];
  let totalDuration = 0;

  console.log(`长文本分段处理: 共 ${segments.length} 段`);

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const tempFile = path.join(tempDir, `tts_segment_${Date.now()}_${i}.mp3`);
    
    try {
      const result = await callTTSAPI(segment, options);
      fs.writeFileSync(tempFile, result.buffer);
      tempFiles.push(tempFile);
      totalDuration += result.duration || 0;
      
      console.log(`段落 ${i + 1}/${segments.length} 合成完成`);
    } catch (error) {
      console.error(`段落 ${i + 1} 合成失败:`, error);
      // 跳过失败的段落
    }
  }

  if (tempFiles.length === 0) {
    throw new Error('所有段落合成失败');
  }

  // 使用 ffmpeg 合并音频文件
  const listFile = path.join(tempDir, `concat_list_${Date.now()}.txt`);
  const listContent = tempFiles.map(f => `file '${f}'`).join('\n');
  fs.writeFileSync(listFile, listContent);

  try {
    // 确保输出目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    execSync(
      `ffmpeg -f concat -safe 0 -i "${listFile}" -acodec copy "${outputPath}" -y`,
      { stdio: 'ignore' }
    );
  } finally {
    // 清理临时文件
    fs.unlinkSync(listFile);
    tempFiles.forEach(f => {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    });
  }

  return {
    filepath: outputPath,
    duration: totalDuration,
    size: fs.statSync(outputPath).size,
  };
}

/**
 * 按标点符号分割文本
 * @param {string} text - 文本
 * @param {number} maxLength - 最大长度（字符）
 * @returns {string[]}
 */
function splitTextByPunctuation(text, maxLength) {
  const segments = [];
  let currentSegment = '';
  
  // 按句子分割
  const sentences = text.split(/([。！？；\n]+)/).filter(Boolean);
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    if (currentSegment.length + sentence.length <= maxLength) {
      currentSegment += sentence;
    } else {
      if (currentSegment) {
        segments.push(currentSegment.trim());
      }
      currentSegment = sentence;
    }
  }
  
  if (currentSegment) {
    segments.push(currentSegment.trim());
  }
  
  // 如果某个段落仍然太长，强制分割
  const result = [];
  for (const segment of segments) {
    if (Buffer.from(segment, 'utf-8').length > 1000) {
      // 强制按长度分割
      let start = 0;
      while (start < segment.length) {
        let end = start + maxLength;
        if (end < segment.length) {
          // 尝试在逗号处分割
          const commaIndex = segment.lastIndexOf('，', end);
          if (commaIndex > start) {
            end = commaIndex + 1;
          }
        }
        result.push(segment.substring(start, end).trim());
        start = end;
      }
    } else {
      result.push(segment);
    }
  }
  
  return result.filter(s => s.length > 0);
}

