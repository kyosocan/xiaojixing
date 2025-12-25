/**
 * 视频合成服务
 * 使用 ffmpeg 将图片、音频合成为带字幕的视频
 */
import fs from 'fs';
import path from 'path';
import { execSync, exec } from 'child_process';
import { config } from '../config.js';

/**
 * 检查 ffmpeg 是否可用
 */
export function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 根据 script 文本自动生成分段字幕
 * 基于文字长度按比例分配时间，模拟 TTS 朗读速度
 * @param {string} script - 讲解文本
 * @param {number} totalDuration - 总时长（秒）
 * @returns {Array<{text: string, start: number, duration: number}>}
 */
export function generateSubtitlesFromScript(script, totalDuration) {
  if (!script || totalDuration <= 0) {
    return [];
  }

  // 按句子分割（句号、问号、感叹号、分号）
  const sentences = script.split(/([。！？；\n])/).filter(s => s.trim().length > 0);
  
  // 合并标点符号和句子，形成完整的句子
  const segments = [];
  let currentSegment = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const part = sentences[i];
    if (/[。！？；\n]/.test(part)) {
      // 遇到句号、问号、感叹号、分号，结束当前句子
      if (currentSegment) {
        segments.push(currentSegment.trim() + (part === '\n' ? '' : part));
        currentSegment = '';
      }
    } else {
      currentSegment += part;
    }
  }
  
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  if (segments.length === 0) {
    return [];
  }

  // 计算总字符数（用于按比例分配时间）
  const totalChars = segments.reduce((sum, seg) => sum + seg.length, 0);
  if (totalChars === 0) {
    return [];
  }

  // 按字符数比例分配时间，模拟 TTS 朗读速度
  const subtitles = [];
  let currentTime = 0;

  segments.forEach((segment, index) => {
    // 按字符数比例计算时长
    const charRatio = segment.length / totalChars;
    let duration = totalDuration * charRatio;
    
    // 确保每段至少 1.5 秒，最多 8 秒
    duration = Math.max(1.5, Math.min(duration, 8));
    
    // 最后一段使用剩余时间
    if (index === segments.length - 1) {
      duration = Math.max(1.5, totalDuration - currentTime);
    }
    
    // 如果句子太长，进一步按逗号分割显示
    if (segment.length > 25) {
      const subParts = splitByComma(segment, 25);
      const subDuration = duration / subParts.length;
      
      subParts.forEach((subPart, subIndex) => {
        subtitles.push({
          text: subPart,
          start: currentTime + subIndex * subDuration,
          duration: Math.max(1, subDuration),
        });
      });
    } else {
      subtitles.push({
        text: segment,
        start: currentTime,
        duration: duration,
      });
    }
    
    currentTime += duration;
  });

  return subtitles;
}

/**
 * 按逗号分割长句子，确保每段不超过指定长度
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string[]}
 */
function splitByComma(text, maxLength) {
  const parts = text.split(/([，,])/).filter(s => s.trim().length > 0);
  const result = [];
  let current = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (/[，,]/.test(part)) {
      current += part;
      if (current.length >= maxLength * 0.7) {
        result.push(current.trim());
        current = '';
      }
    } else {
      if (current.length + part.length > maxLength) {
        if (current.trim()) {
          result.push(current.trim());
        }
        current = part;
      } else {
        current += part;
      }
    }
  }
  
  if (current.trim()) {
    result.push(current.trim());
  }
  
  return result.length > 0 ? result : [text.substring(0, maxLength) + '...'];
}

/**
 * 获取音频时长
 */
function getAudioDuration(audioPath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      { encoding: 'utf-8' }
    );
    return parseFloat(output.trim());
  } catch {
    return 5; // 默认5秒
  }
}

/**
 * 生成 SRT 字幕文件
 * @param {Array<{text: string, start: number, duration: number}>} subtitles
 * @param {string} outputPath
 */
function generateSRTFile(subtitles, outputPath) {
  let srtContent = '';
  
  subtitles.forEach((sub, index) => {
    const startTime = formatSRTTime(sub.start);
    const endTime = formatSRTTime(sub.start + sub.duration);
    
    srtContent += `${index + 1}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    srtContent += `${sub.text}\n\n`;
  });
  
  fs.writeFileSync(outputPath, srtContent, 'utf-8');
  return outputPath;
}

/**
 * 格式化 SRT 时间
 */
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * 生成 ASS 字幕文件（更好的样式支持）
 * @param {Array<{text: string, start: number, duration: number}>} subtitles
 * @param {string} outputPath
 */
function generateASSFile(subtitles, outputPath) {
  // ASS 文件头
  let assContent = `[Script Info]
Title: PPT Video Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,56,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,50,50,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  subtitles.forEach((sub) => {
    const startTime = formatASSTime(sub.start);
    const endTime = formatASSTime(sub.start + sub.duration);
    
    // 处理换行
    const text = sub.text.replace(/\n/g, '\\N');
    
    assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
  });
  
  fs.writeFileSync(outputPath, assContent, 'utf-8');
  return outputPath;
}

/**
 * 格式化 ASS 时间
 */
function formatASSTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = (seconds % 60).toFixed(2);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
}

/**
 * 将单张图片和音频合成为视频片段
 * @param {string} imagePath - 图片路径
 * @param {string} audioPath - 音频路径
 * @param {string} outputPath - 输出视频路径
 * @param {object} options - 选项
 */
export async function createSlideVideo(imagePath, audioPath, outputPath, options = {}) {
  const duration = options.duration || getAudioDuration(audioPath);
  const resolution = options.resolution || '1920x1080';
  
  // 确保输出目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // ffmpeg 命令：图片 + 音频 -> 视频
  // 使用 scale 确保图片适配分辨率，使用 pad 填充黑边
  // -shortest: 以最短的输入流（音频）为准，确保视频长度等于音频长度
  // -ar 44100: 统一音频采样率为 44100Hz，避免后续合并时音频参数不一致
  const cmd = `ffmpeg -loop 1 -i "${imagePath}" -i "${audioPath}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -ar 44100 -pix_fmt yuv420p -vf "scale=${resolution.replace('x', ':')}:force_original_aspect_ratio=decrease,pad=${resolution.replace('x', ':')}:(ow-iw)/2:(oh-ih)/2:color=white" -shortest "${outputPath}" -y`;
  
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('视频片段生成失败:', stderr);
        reject(error);
      } else {
        resolve({ filepath: outputPath, duration });
      }
    });
  });
}

/**
 * 合并多个视频片段
 * @param {string[]} videoPaths - 视频文件路径数组
 * @param {string} outputPath - 输出视频路径
 */
export async function concatenateVideos(videoPaths, outputPath) {
  const tempDir = config.tempDir;
  const listFile = path.join(tempDir, `concat_${Date.now()}.txt`);
  
  // 创建视频列表文件
  const listContent = videoPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listFile, listContent);
  
  // 确保输出目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 使用重新编码而不是直接复制，避免音频重叠问题
  // -c:v copy: 视频流直接复制（快速）
  // -c:a aac -b:a 192k: 音频重新编码为 AAC，确保音频流正确合并
  const cmd = `ffmpeg -f concat -safe 0 -i "${listFile}" -c:v copy -c:a aac -b:a 192k -ar 44100 "${outputPath}" -y`;
  
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      // 清理临时文件
      if (fs.existsSync(listFile)) {
        fs.unlinkSync(listFile);
      }
      
      if (error) {
        console.error('视频合并失败:', stderr);
        reject(error);
      } else {
        resolve({ filepath: outputPath });
      }
    });
  });
}

/**
 * 为视频添加字幕
 * @param {string} videoPath - 视频路径
 * @param {Array<{text: string, start: number, duration: number}>} subtitles - 字幕数组
 * @param {string} outputPath - 输出视频路径
 */
export async function addSubtitles(videoPath, subtitles, outputPath) {
  const tempDir = config.tempDir;
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // 生成 ASS 字幕文件
  const assFile = path.join(tempDir, `subtitles_${Date.now()}.ass`);
  generateASSFile(subtitles, assFile);
  
  // 确保输出目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 使用 ffmpeg 烧录字幕
  const cmd = `ffmpeg -i "${videoPath}" -vf "ass='${assFile.replace(/'/g, "'\\''").replace(/\\/g, '/')}'" -c:a copy "${outputPath}" -y`;
  
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      // 清理临时字幕文件
      if (fs.existsSync(assFile)) {
        fs.unlinkSync(assFile);
      }
      
      if (error) {
        console.error('字幕添加失败:', stderr);
        // 字幕添加失败时，返回原视频
        resolve({ filepath: videoPath, subtitlesAdded: false });
      } else {
        resolve({ filepath: outputPath, subtitlesAdded: true });
      }
    });
  });
}

/**
 * 完整的视频合成流程
 * @param {Array<{imagePath: string, audioPath: string, subtitle: string}>} slides - 幻灯片数组
 * @param {string} outputPath - 最终输出路径
 * @param {function} onProgress - 进度回调
 */
export async function synthesizeVideo(slides, outputPath, onProgress) {
  if (!checkFFmpeg()) {
    throw new Error('ffmpeg 未安装');
  }

  const tempDir = config.tempDir;
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const slideVideos = [];
  const subtitles = [];
  let currentTime = 0;

  console.log(`开始合成视频，共 ${slides.length} 页`);

  // 1. 为每页生成视频片段
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    onProgress?.(
      Math.round((i / slides.length) * 60),
      `合成第 ${i + 1}/${slides.length} 页视频...`
    );

    const slideVideoPath = path.join(tempDir, `slide_${Date.now()}_${i}.mp4`);
    
    try {
      const result = await createSlideVideo(
        slide.imagePath,
        slide.audioPath,
        slideVideoPath
      );
      
      slideVideos.push(slideVideoPath);
      
      // 收集字幕信息
      // 优先使用 script（逐字稿）生成分段字幕，而非简短的标题
      if (slide.script) {
        // 根据 script（逐字稿）自动分段生成字幕
        const autoSubtitles = generateSubtitlesFromScript(slide.script, result.duration);
        autoSubtitles.forEach(sub => {
          subtitles.push({
            text: sub.text,
            start: currentTime + sub.start,
            duration: sub.duration,
          });
        });
      } else if (slide.subtitles && Array.isArray(slide.subtitles) && slide.subtitles.length > 0) {
        // 使用提供的分段字幕（但时间需要根据实际音频时长重新计算）
        const totalSubDuration = slide.subtitles.reduce((sum, sub) => sum + (sub.duration || 2), 0);
        const timeScale = totalSubDuration > 0 ? result.duration / totalSubDuration : 1;
        let subCurrentTime = 0;
        
        slide.subtitles.forEach(sub => {
          const scaledDuration = (sub.duration || 2) * timeScale;
          subtitles.push({
            text: sub.text,
            start: currentTime + subCurrentTime,
            duration: scaledDuration,
          });
          subCurrentTime += scaledDuration;
        });
      } else if (slide.subtitle) {
        // 使用默认字幕（整页显示）- 仅作为兜底方案
        subtitles.push({
          text: slide.subtitle,
          start: currentTime,
          duration: result.duration,
        });
      }
      
      currentTime += result.duration;
      
      console.log(`幻灯片 ${i + 1} 视频生成完成: ${result.duration.toFixed(2)}s`);
    } catch (error) {
      console.error(`幻灯片 ${i + 1} 视频生成失败:`, error);
      throw error;
    }
  }

  // 2. 合并所有视频片段
  onProgress?.(70, '合并视频片段...');
  const mergedVideoPath = path.join(tempDir, `merged_${Date.now()}.mp4`);
  await concatenateVideos(slideVideos, mergedVideoPath);
  
  console.log('视频片段合并完成');

  // 3. 添加字幕
  onProgress?.(85, '添加字幕...');
  
  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let finalVideoPath = outputPath;
  if (subtitles.length > 0) {
    try {
      const result = await addSubtitles(mergedVideoPath, subtitles, outputPath);
      finalVideoPath = result.filepath;
      console.log('字幕添加完成');
    } catch (error) {
      console.warn('字幕添加失败，使用无字幕版本:', error);
      fs.copyFileSync(mergedVideoPath, outputPath);
    }
  } else {
    fs.copyFileSync(mergedVideoPath, outputPath);
  }

  // 4. 清理临时文件
  onProgress?.(95, '清理临时文件...');
  for (const videoPath of slideVideos) {
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
  }
  if (fs.existsSync(mergedVideoPath) && mergedVideoPath !== finalVideoPath) {
    fs.unlinkSync(mergedVideoPath);
  }

  onProgress?.(100, '视频合成完成');
  console.log(`最终视频: ${finalVideoPath}`);
  
  return {
    filepath: finalVideoPath,
    duration: currentTime,
    slidesCount: slides.length,
  };
}

/**
 * 获取视频时长
 */
export function getVideoDuration(videoPath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
      { encoding: 'utf-8' }
    );
    return parseFloat(output.trim());
  } catch {
    return 0;
  }
}

