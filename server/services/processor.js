/**
 * 主处理服务
 * 整合 ASR、LLM、图片生成、TTS、视频合成的完整处理流程
 */
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { transcribeAudio, getAudioDuration, extractAudioSegment } from './asr.js';
import { analyzeKnowledgePoint, generatePPTScript } from './llm.js';
import { generateImage, generateImageToFile } from './imageGen.js';
import { textToSpeechFile, textToSpeechBase64 } from './tts.js';
import { synthesizeVideo, checkFFmpeg, generateSubtitlesFromScript } from './videoSynth.js';

// 生成唯一 ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * 处理单个时间标记点，生成完整的 PPT 视频
 * @param {string} audioFilePath - 音频文件路径
 * @param {number} markerTime - 标记时间点（秒）
 * @param {function} onProgress - 进度回调 (progress: number, message: string)
 * @param {function} onUpdate - 状态更新回调 (data: object)
 * @returns {Promise<object>} - 处理结果
 */
export async function processTimeMarker(audioFilePath, markerTime, onProgress, onUpdate) {
  const taskId = generateId();
  const outputDir = path.join(config.outputDir, taskId);
  const tempDir = path.join(config.tempDir, taskId);
  
  // 创建目录
  [outputDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`开始处理任务 ${taskId}`);
  console.log(`音频文件: ${audioFilePath}`);
  console.log(`标记时间: ${markerTime}s`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // ==================== 步骤 1: ASR 语音识别 ====================
    onProgress(Math.round(5), '正在识别语音内容...');
    onUpdate?.({ step: 'asr', status: 'processing' });

    // 计算截取范围：前5分钟 + 后3分钟
    const audioDuration = getAudioDuration(audioFilePath);
    const startTime = Math.max(0, markerTime - 300); // 前5分钟
    const endTime = Math.min(audioDuration, markerTime + 180); // 后3分钟
    
    console.log(`音频总时长: ${audioDuration.toFixed(2)}s`);
    console.log(`截取范围: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`);

    // 截取音频片段
    const segmentPath = path.join(tempDir, 'audio_segment.mp3');
    extractAudioSegment(audioFilePath, segmentPath, startTime, endTime - startTime);
    
    // ASR 识别
    const transcript = await transcribeAudio(
      segmentPath, 
      0, 
      endTime - startTime,
      (prog, msg) => onProgress(Math.round(5 + prog * 0.15), msg)
    );
    
    console.log('语音识别完成，文本长度:', transcript.length);
    onUpdate?.({ step: 'asr', status: 'completed', transcript: transcript.substring(0, 200) + '...' });

    // ==================== 步骤 2: 知识点分析 ====================
    onProgress(Math.round(20), '正在分析知识点...');
    onUpdate?.({ step: 'analyze', status: 'processing' });

    const analysis = await analyzeKnowledgePoint(transcript);
    
    console.log('知识点分析完成:', analysis.knowledgePoint);
    onUpdate?.({ 
      step: 'analyze', 
      status: 'completed',
      knowledgePoint: analysis.knowledgePoint,
      summary: analysis.summary,
      subject: analysis.subject,
    });

    // ==================== 步骤 3: 生成 PPT 脚本 ====================
    onProgress(Math.round(30), '正在生成教学脚本...');
    onUpdate?.({ step: 'script', status: 'processing' });

    const pptScript = await generatePPTScript(
      analysis.knowledgePoint,
      analysis.summary,
      analysis.keyPoints
    );
    
    console.log('PPT 脚本生成完成，共', pptScript.slides.length, '页');
    onUpdate?.({ step: 'script', status: 'completed', slidesCount: pptScript.slides.length });

    // ==================== 步骤 4 & 5: 并发生成 PPT 图片和 TTS 语音 ====================
    onProgress(Math.round(40), '正在生成教学图片和语音...');
    onUpdate?.({ step: 'images', status: 'processing' });
    onUpdate?.({ step: 'tts', status: 'processing' });

    const slideImages = [];
    const slideAudios = [];
    const totalSlides = pptScript.slides.length;

    // 按顺序处理每个幻灯片，但每个幻灯片内部的图片生成和TTS并发执行
    for (let i = 0; i < pptScript.slides.length; i++) {
      const slide = pptScript.slides[i];
      const progress = Math.round(40 + (i / totalSlides) * 30);
      onProgress(progress, `处理幻灯片 ${i + 1}/${totalSlides}...`);

      // 当前幻灯片的图片生成和TTS并发执行
      const [imageResult, audioResult] = await Promise.all([
        // 图片生成
        (async () => {
          const imagePath = path.join(outputDir, `slide_${i + 1}.jpg`);
          
          try {
            const result = await generateImageToFile(slide.imagePrompt, imagePath);
            console.log(`图片 ${i + 1} 生成成功`);
            return {
              index: i,
              path: result.filepath,
              success: true,
            };
          } catch (error) {
            console.error(`图片 ${i + 1} 生成失败:`, error.message);
            // 生成占位图
            const placeholderPath = await createPlaceholderImage(
              imagePath, 
              slide.title,
              slide.subtitle
            );
            return {
              index: i,
              path: placeholderPath,
              success: false,
              error: error.message,
            };
          }
        })(),
        
        // TTS 生成
        (async () => {
          const audioPath = path.join(outputDir, `slide_${i + 1}_audio.mp3`);
          
          try {
            const result = await textToSpeechFile(slide.script, audioPath);
            console.log(`语音 ${i + 1} 生成成功, 时长: ${result.duration}ms`);
            return {
              index: i,
              path: result.filepath,
              duration: result.duration,
              success: true,
            };
          } catch (error) {
            console.error(`语音 ${i + 1} 生成失败:`, error.message);
            // 生成静音音频作为占位
            const silentPath = await createSilentAudio(audioPath, 5);
            return {
              index: i,
              path: silentPath,
              duration: 5000,
              success: false,
              error: error.message,
            };
          }
        })()
      ]);

      slideImages.push(imageResult);
      slideAudios.push(audioResult);

      // 延迟避免 API 限流（最后一个幻灯片不需要延迟）
      if (i < pptScript.slides.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    // 按索引排序，确保顺序正确
    slideImages.sort((a, b) => a.index - b.index);
    slideAudios.sort((a, b) => a.index - b.index);
    
    onUpdate?.({ step: 'images', status: 'completed', images: slideImages.length });
    onUpdate?.({ step: 'tts', status: 'completed', audios: slideAudios.length });

    // ==================== 步骤 6: 合成视频 ====================
    onProgress(Math.round(80), '正在合成视频...');
    onUpdate?.({ step: 'video', status: 'processing' });

    // 准备幻灯片数据
    const slidesForVideo = pptScript.slides.map((slide, i) => ({
      imagePath: slideImages[i]?.path,
      audioPath: slideAudios[i]?.path,
      subtitle: slide.subtitle,
      subtitles: slide.subtitles, // 支持分段字幕
      script: slide.script,
    }));

    const videoOutputPath = path.join(outputDir, 'final_video.mp4');
    
    let videoResult;
    if (checkFFmpeg()) {
      videoResult = await synthesizeVideo(
        slidesForVideo,
        videoOutputPath,
        (prog, msg) => onProgress(Math.round(80 + prog * 0.18), msg)
      );
    } else {
      console.warn('ffmpeg 未安装，跳过视频合成');
      videoResult = {
        filepath: null,
        duration: 0,
        slidesCount: pptScript.slides.length,
        error: 'ffmpeg not installed',
      };
    }
    
    onUpdate?.({ step: 'video', status: 'completed', videoPath: videoResult.filepath });

    // ==================== 完成 ====================
    onProgress(Math.round(100), '处理完成！');

    // 清理临时文件
    cleanupTempDir(tempDir);

    // 构建结果
    const result = {
      taskId,
      success: true,
      knowledgePoint: analysis.knowledgePoint,
      summary: analysis.summary,
      subject: analysis.subject,
      transcript: transcript,
      slides: pptScript.slides.map((slide, i) => {
        // 如果没有分段字幕，根据 script 和音频时长自动生成
        let subtitles = slide.subtitles;
        if ((!subtitles || subtitles.length === 0) && slide.script && slideAudios[i]?.duration) {
          const audioDurationSeconds = slideAudios[i].duration / 1000; // 转换为秒
          subtitles = generateSubtitlesFromScript(slide.script, audioDurationSeconds);
        }
        
        return {
          index: i + 1,
          title: slide.title,
          script: slide.script,
          subtitle: slide.subtitle,
          subtitles: subtitles, // 包含分段字幕（LLM 生成或自动生成）
          imagePath: slideImages[i]?.path,
          imageUrl: `/api/files/${taskId}/slide_${i + 1}.jpg`,
          audioPath: slideAudios[i]?.path,
          audioUrl: `/api/files/${taskId}/slide_${i + 1}_audio.mp3`,
          audioDuration: slideAudios[i]?.duration,
        };
      }),
      video: videoResult.filepath ? {
        path: videoResult.filepath,
        url: `/api/files/${taskId}/final_video.mp4`,
        duration: videoResult.duration,
      } : null,
      outputDir,
      createdAt: new Date().toISOString(),
    };

    console.log('\n处理完成！');
    console.log('知识点:', result.knowledgePoint);
    console.log('学科:', result.subject);
    console.log('幻灯片数量:', result.slides.length);
    console.log('视频路径:', result.video?.path || '未生成');

    return result;
  } catch (error) {
    console.error('处理失败:', error);
    
    // 清理临时文件
    cleanupTempDir(tempDir);
    
    throw error;
  }
}

/**
 * 批量处理多个时间标记点
 * @param {string} audioFilePath - 音频文件路径
 * @param {number[]} markerTimes - 标记时间点数组（秒）
 * @param {function} onProgress - 总体进度回调
 * @param {function} onTaskUpdate - 单个任务更新回调
 * @returns {Promise<object[]>} - 处理结果数组
 */
export async function processMultipleMarkers(audioFilePath, markerTimes, onProgress, onTaskUpdate) {
  const results = [];
  const total = markerTimes.length;

  for (let i = 0; i < total; i++) {
    const markerTime = markerTimes[i];
    const baseProgress = Math.round((i / total) * 100);
    
    // 通知前端开始处理当前标记点（用于创建处理中的卡片）
    // 使用 started 标记，不会被后续更新覆盖
    onTaskUpdate?.(i, { step: 'start', started: true, markerTime });
    
    onProgress?.(baseProgress, `处理标记点 ${i + 1}/${total}...`);
    
    try {
      const result = await processTimeMarker(
        audioFilePath,
        markerTime,
        (prog, msg) => {
          const totalProgress = Math.round(baseProgress + (prog / total));
          onProgress?.(totalProgress, msg);
        },
        (data) => onTaskUpdate?.(i, data)
      );
      
      const fullResult = {
        markerTime,
        ...result,
      };
      results.push(fullResult);
      
      // 立即通知前端该标记点已完成，发送完整结果
      onTaskUpdate?.(i, { step: 'completed', ...fullResult });
    } catch (error) {
      console.error(`标记点 ${i + 1} 处理失败:`, error);
      const failedResult = {
        markerTime,
        success: false,
        error: error.message,
      };
      results.push(failedResult);
      
      // 通知前端该标记点处理失败
      onTaskUpdate?.(i, { step: 'failed', ...failedResult });
    }
  }

  onProgress?.(Math.round(100), '所有标记点处理完成');
  return results;
}

/**
 * 创建占位图片
 */
async function createPlaceholderImage(outputPath, title, subtitle) {
  try {
    const sharp = (await import('sharp')).default;
    
    // 创建渐变背景
    const svg = `
      <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="72" fill="white" text-anchor="middle" font-weight="bold">${escapeXml(title || '知识点')}</text>
        <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="36" fill="rgba(255,255,255,0.8)" text-anchor="middle">${escapeXml(subtitle || '')}</text>
      </svg>
    `;
    
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 90 })
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    // sharp 不可用，创建简单的占位图
    console.warn('sharp 不可用，使用默认占位图');
    // 复制一个默认图片或创建一个简单的 buffer
    return outputPath;
  }
}

/**
 * XML 转义
 */
function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 创建静音音频
 */
async function createSilentAudio(outputPath, durationSeconds) {
  const { execSync } = await import('child_process');
  
  try {
    execSync(
      `ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t ${durationSeconds} -acodec libmp3lame "${outputPath}" -y`,
      { stdio: 'ignore' }
    );
    return outputPath;
  } catch (error) {
    console.error('创建静音音频失败:', error);
    return outputPath;
  }
}

/**
 * 清理临时目录
 */
function cleanupTempDir(tempDir) {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn('清理临时目录失败:', error);
  }
}

