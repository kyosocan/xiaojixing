#!/usr/bin/env node

/**
 * ASR API 测试脚本
 * 功能：
 * 1. 读取 MP3 文件
 * 2. 将文件切分成 1 分钟（60秒）的片段
 * 3. 对每个片段调用 ASR API 进行语音识别
 * 4. 将所有识别结果拼接并保存到文件
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置参数
const defaultConfig = {
  apiBaseUrl: process.env.ASR_API_BASE_URL || 'http://your-api-host',
  appId: process.env.ASR_APP_ID || '',
  serverKey: process.env.ASR_SERVER_KEY || '',
  token: process.env.ASR_TOKEN,
  cluster: 'volcengine_input_common',
  format: 'mp3',
  segmentDuration: 60,
};

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
function getAudioDuration(filePath) {
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
 * 切分音频文件为指定时长的片段
 */
function splitAudio(inputFile, outputDir, duration) {
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const audioDuration = getAudioDuration(inputFile);
  const segmentCount = Math.ceil(audioDuration / duration);
  const segmentFiles = [];

  console.log(`音频总时长: ${audioDuration.toFixed(2)} 秒`);
  console.log(`将切分为 ${segmentCount} 个片段，每个 ${duration} 秒`);

  for (let i = 0; i < segmentCount; i++) {
    const startTime = i * duration;
    const outputFile = path.join(outputDir, `segment_${i + 1}.mp3`);

    try {
      execSync(
        `ffmpeg -i "${inputFile}" -ss ${startTime} -t ${duration} -acodec copy "${outputFile}" -y`,
        { stdio: 'ignore' }
      );
      segmentFiles.push(outputFile);
      console.log(`✓ 已切分片段 ${i + 1}/${segmentCount}: ${outputFile}`);
    } catch (error) {
      console.error(`✗ 切分片段 ${i + 1} 失败:`, error);
      throw error;
    }
  }

  return segmentFiles;
}

/**
 * 将文件转换为 base64
 */
function fileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

/**
 * 调用 ASR API
 */
async function callASRAPI(audioBase64, config) {
  const url = new URL(`${config.apiBaseUrl}/v1/asr`);
  
  // 如果是公网环境且提供了 token，添加到 URL query
  if (config.token) {
    url.searchParams.set('token', config.token);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.appId}:${config.serverKey}`,
    'api-key': `${config.appId}:${config.serverKey}`,
  };

  const body = {
    cluster: config.cluster,
    format: config.format,
    audio_data: audioBase64,
  };

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();

    if (data.code !== 200) {
      throw new Error(`API 返回错误: ${data.code} - ${data.message}`);
    }

    // 提取识别结果文本
    const text = data.data?.text || data.data?.result || '';
    return text;
  } catch (error) {
    console.error('ASR API 调用失败:', error);
    throw error;
  }
}

/**
 * 清理临时文件
 */
function cleanupTempFiles(files, outputDir) {
  console.log('\n清理临时文件...');
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (error) {
      console.warn(`删除临时文件失败: ${file}`, error);
    }
  });

  try {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn(`删除临时目录失败: ${outputDir}`, error);
  }
}

/**
 * 格式化时间为 MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
用法: node test-asr-api.js <mp3文件路径> [选项]

选项:
  --api-url <url>        API 基础 URL (默认: 从环境变量 ASR_API_BASE_URL 获取)
  --app-id <id>          App ID (默认: 从环境变量 ASR_APP_ID 获取)
  --server-key <key>     服务器密钥 (默认: 从环境变量 ASR_SERVER_KEY 获取)
  --token <token>        公网环境 token (可选，默认: 从环境变量 ASR_TOKEN 获取)
  --cluster <cluster>    集群名称 (默认: volcengine_input_common)
  --format <format>      音频格式 (默认: mp3)
  --duration <seconds>   每个片段的时长（秒）(默认: 60)
  --output <file>        输出文件路径 (默认: asr_result_<timestamp>.txt)

示例:
  node test-asr-api.js audio.mp3 --api-url http://api.example.com --app-id 1000000000 --server-key your_key
  
环境变量示例:
  export ASR_API_BASE_URL=http://api.example.com
  export ASR_APP_ID=1000000000
  export ASR_SERVER_KEY=your_server_key
  export ASR_TOKEN=your_token  # 可选，公网环境需要
  node test-asr-api.js audio.mp3
    `);
    process.exit(1);
  }

  const inputFile = args[0];
  if (!fs.existsSync(inputFile)) {
    console.error(`错误: 文件不存在: ${inputFile}`);
    process.exit(1);
  }

  // 解析命令行参数
  const config = { ...defaultConfig };
  let outputFile = `asr_result_${Date.now()}.txt`;

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--api-url':
        config.apiBaseUrl = value;
        break;
      case '--app-id':
        config.appId = value;
        break;
      case '--server-key':
        config.serverKey = value;
        break;
      case '--token':
        config.token = value;
        break;
      case '--cluster':
        config.cluster = value;
        break;
      case '--format':
        config.format = value;
        break;
      case '--duration':
        config.segmentDuration = parseInt(value, 10);
        break;
      case '--output':
        outputFile = value;
        break;
    }
  }

  // 验证配置
  if (!config.appId || !config.serverKey) {
    console.error('错误: 必须提供 app-id 和 server-key');
    console.error('可以通过命令行参数或环境变量提供: ASR_APP_ID, ASR_SERVER_KEY');
    process.exit(1);
  }

  // 检查 ffmpeg
  if (!checkFFmpeg()) {
    console.error('错误: 未找到 ffmpeg，请先安装 ffmpeg');
    console.error('安装方法: brew install ffmpeg (macOS) 或 apt-get install ffmpeg (Linux)');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('ASR API 测试脚本');
  console.log('='.repeat(60));
  console.log(`输入文件: ${inputFile}`);
  console.log(`API URL: ${config.apiBaseUrl}`);
  console.log(`集群: ${config.cluster}`);
  console.log(`格式: ${config.format}`);
  console.log(`片段时长: ${config.segmentDuration} 秒`);
  console.log(`输出文件: ${outputFile}`);
  console.log('='.repeat(60));
  console.log();

  const tempDir = path.join(path.dirname(inputFile), `.asr_temp_${Date.now()}`);
  const segmentFiles = [];
  const results = [];

  try {
    // 1. 切分音频
    console.log('步骤 1: 切分音频文件...');
    const segments = splitAudio(inputFile, tempDir, config.segmentDuration);
    segmentFiles.push(...segments);
    console.log();

    // 2. 对每个片段调用 API
    console.log('步骤 2: 调用 ASR API 进行识别...');
    for (let i = 0; i < segments.length; i++) {
      const segmentFile = segments[i];
      const segmentNum = i + 1;
      const startTime = i * config.segmentDuration;

      console.log(`\n处理片段 ${segmentNum}/${segments.length} (${formatTime(startTime)} - ${formatTime(startTime + config.segmentDuration)})...`);

      try {
        const audioBase64 = fileToBase64(segmentFile);
        const text = await callASRAPI(audioBase64, config);

        results.push({
          segment: segmentNum,
          text: text.trim(),
          startTime,
        });

        console.log(`✓ 识别成功`);
        if (text.trim()) {
          console.log(`  结果: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        } else {
          console.log(`  结果: (空)`);
        }
      } catch (error) {
        console.error(`✗ 识别失败:`, error);
        results.push({
          segment: segmentNum,
          text: `[识别失败: ${error instanceof Error ? error.message : String(error)}]`,
          startTime,
        });
      }
    }

    // 3. 保存结果
    console.log('\n步骤 3: 保存识别结果...');
    let outputContent = `ASR 识别结果\n`;
    outputContent += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
    outputContent += `输入文件: ${inputFile}\n`;
    outputContent += `总片段数: ${results.length}\n`;
    outputContent += `${'='.repeat(60)}\n\n`;

    results.forEach((result) => {
      const startTime = result.startTime;
      const endTime = startTime + config.segmentDuration;
      const timeStr = `${formatTime(startTime)} - ${formatTime(endTime)}`;

      outputContent += `片段 ${result.segment} [${timeStr}]\n`;
      outputContent += `${'-'.repeat(60)}\n`;
      outputContent += `${result.text}\n\n`;
    });

    // 合并所有文本
    outputContent += `${'='.repeat(60)}\n`;
    outputContent += `合并结果:\n`;
    outputContent += `${'='.repeat(60)}\n\n`;
    const mergedText = results.map(r => r.text).join('\n');
    outputContent += mergedText;

    fs.writeFileSync(outputFile, outputContent, 'utf-8');
    console.log(`✓ 结果已保存到: ${outputFile}`);

    // 统计信息
    console.log('\n统计信息:');
    console.log(`  总片段数: ${results.length}`);
    console.log(`  成功识别: ${results.filter(r => !r.text.includes('[识别失败')).length}`);
    console.log(`  失败片段: ${results.filter(r => r.text.includes('[识别失败')).length}`);
    console.log(`  总字符数: ${mergedText.length}`);

  } catch (error) {
    console.error('\n错误:', error);
    process.exit(1);
  } finally {
    // 清理临时文件
    cleanupTempFiles(segmentFiles, tempDir);
  }

  console.log('\n完成!');
}

// 运行主函数
main().catch(error => {
  console.error('未处理的错误:', error);
  process.exit(1);
});

