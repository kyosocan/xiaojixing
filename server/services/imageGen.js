/**
 * 图片生成服务
 * 基于 Gemini 3 Pro Image 模型
 */
import fs from 'fs';
import path from 'path';
import { config, getTalApiKey } from '../config.js';

/**
 * 调用 Gemini Image API 生成图片
 * @param {string} prompt - 图片描述提示词
 * @returns {Promise<{base64: string, format: string}>}
 */
export async function generateImage(prompt) {
  const url = `${config.talApi.baseUrl}/v1/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
    'api-key': getTalApiKey(),
  };

  // 增强提示词，确保生成高质量的教育插图
  const enhancedPrompt = enhancePrompt(prompt);

  const body = {
    model: 'gemini-3-pro-image',
    messages: [
      {
        role: 'user',
        content: enhancedPrompt,
      },
    ],
    modalities: ['text', 'image'],
  };

  try {
    console.log('图片生成请求:', prompt.substring(0, 80) + '...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API 请求失败:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // 提取图片数据
    const imageData = extractImageFromResponse(data);
    
    if (!imageData) {
      console.error('Gemini 响应中没有图片数据:', JSON.stringify(data).substring(0, 500));
      throw new Error('No image in response');
    }
    
    console.log('图片生成成功');
    return imageData;
  } catch (error) {
    console.error('图片生成失败:', error);
    throw error;
  }
}

/**
 * 增强提示词
 */
function enhancePrompt(prompt) {
  const styleRequirements = [
    '高质量、鲜艳的颜色、专业插图、适合儿童教育、清晰的构图、迪士尼皮克斯画质',
    '黑板应该占据画面90%以上的面积，黑板内容清晰可见',
    '画面中只能出现一位卡通老师角色，不要出现学生或其他人物',
    '黑板上的文字必须全部使用中文，不要出现任何英文字母',
    '图片应该适合小学生观看'
  ].join('。');

  return `${prompt}。\n\n【重要风格要求】：${styleRequirements}。`;
}

/**
 * 从 API 响应中提取图片数据
 */
function extractImageFromResponse(responseData) {
  if (!responseData.choices || !Array.isArray(responseData.choices)) {
    return null;
  }

  for (const choice of responseData.choices) {
    if (!choice.message) continue;

    // 检查 message.images 数组（Gemini 3 Pro Image 格式）
    if (choice.message.images && Array.isArray(choice.message.images)) {
      for (const imageItem of choice.message.images) {
        if (imageItem.type === 'image_url' && imageItem.image_url?.url) {
          const extracted = extractBase64Data(imageItem.image_url.url);
          if (extracted) return extracted;
        }
      }
    }

    // 检查 message.content（数组格式）
    if (choice.message.content && Array.isArray(choice.message.content)) {
      for (const item of choice.message.content) {
        if (item.type === 'image_url' && item.image_url?.url) {
          const extracted = extractBase64Data(item.image_url.url);
          if (extracted) return extracted;
        }
      }
    }
  }

  return null;
}

/**
 * 提取 base64 数据
 */
function extractBase64Data(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // data:image/xxx;base64,xxxxx 格式
  const dataUrlMatch = url.match(/^data:image\/(\w+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      format: dataUrlMatch[1],
      base64: dataUrlMatch[2],
    };
  }

  // 纯 base64 字符串
  if (url.length > 100 && /^[A-Za-z0-9+/=]+$/.test(url)) {
    return {
      format: 'png',
      base64: url,
    };
  }

  return null;
}

/**
 * 生成图片并保存到文件
 * @param {string} prompt - 图片描述
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<{filepath: string, format: string}>}
 */
export async function generateImageToFile(prompt, outputPath) {
  const imageData = await generateImage(prompt);
  
  // 确保输出目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 解码并保存图片
  const imageBuffer = Buffer.from(imageData.base64, 'base64');
  
  // 尝试转换为 JPEG（如果有 sharp）
  try {
    const sharp = (await import('sharp')).default;
    const jpegPath = outputPath.replace(/\.[^.]+$/, '.jpg');
    
    await sharp(imageBuffer)
      .jpeg({ quality: 95 })
      .toFile(jpegPath);
    
    return {
      filepath: jpegPath,
      format: 'jpg',
    };
  } catch (error) {
    // sharp 不可用，直接保存原始格式
    const actualPath = outputPath.replace(/\.[^.]+$/, `.${imageData.format}`);
    fs.writeFileSync(actualPath, imageBuffer);
    
    return {
      filepath: actualPath,
      format: imageData.format,
    };
  }
}

/**
 * 批量生成图片
 * @param {string[]} prompts - 提示词数组
 * @param {function} onProgress - 进度回调
 * @returns {Promise<Array<{base64: string, format: string}>>}
 */
export async function generateImagesBatch(prompts, onProgress) {
  const results = [];
  
  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    onProgress?.(Math.round((i / prompts.length) * 100), `生成图片 ${i + 1}/${prompts.length}`);
    
    try {
      const imageData = await generateImage(prompt);
      results.push(imageData);
    } catch (error) {
      console.error(`图片 ${i + 1} 生成失败:`, error);
      // 使用占位图
      results.push({
        base64: null,
        format: null,
        error: error.message,
        placeholder: true,
      });
    }
    
    // 添加延迟，避免 API 限流
    if (i < prompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  onProgress?.(100, '图片生成完成');
  return results;
}

