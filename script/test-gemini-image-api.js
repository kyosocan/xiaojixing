#!/usr/bin/env node

/**
 * Gemini 3 Pro Image API 测试脚本
 * 功能：
 * 1. 调用 Gemini 3 Pro Image API 生成图片
 * 2. 保存返回的图片（如果有）
 * 3. 显示 API 响应信息
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置参数
const defaultConfig = {
  apiBaseUrl: process.env.GEMINI_API_BASE_URL || 'http://ai-service.tal.com/openai-compatible',
  appId: process.env.TAL_MLOPS_APP_ID || '',
  appKey: process.env.TAL_MLOPS_APP_KEY || '',
  model: 'gemini-3-pro-image',
  modalities: ['text', 'image'],
};

/**
 * 调用 Gemini Image API
 */
async function callGeminiImageAPI(prompt, config) {
  const url = `${config.apiBaseUrl}/v1/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
    'api-key': `${config.appId}:${config.appKey}`,
  };

  const body = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    modalities: config.modalities,
  };

  console.log('请求 URL:', url);
  console.log('请求 Body:', JSON.stringify(body, null, 2));
  console.log();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Gemini Image API 调用失败:', error);
    throw error;
  }
}

/**
 * 提取 base64 数据（处理 data:image/xxx;base64, 格式或纯 base64）
 */
function extractBase64Data(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // 如果是 data:image/xxx;base64,xxxxx 格式
  const dataUrlMatch = url.match(/^data:image\/\w+;base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      base64Data: dataUrlMatch[1],
      originalFormat: url.match(/^data:image\/(\w+);base64/)?.[1] || 'png',
    };
  }

  // 如果是纯 base64 字符串（假设是 PNG）
  if (url.length > 100 && /^[A-Za-z0-9+/=]+$/.test(url)) {
    return {
      base64Data: url,
      originalFormat: 'png',
    };
  }

  return null;
}

/**
 * 将图片转换为 JPG 格式
 */
async function convertToJpg(imageBuffer, outputPath) {
  try {
    // 尝试动态导入 sharp
    const sharp = (await import('sharp')).default;
    // 使用 sharp 转换
    await sharp(imageBuffer)
      .jpeg({ quality: 95 })
      .toFile(outputPath);
    return { success: true, filepath: outputPath };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
      // sharp 未安装
      throw new Error('SHARP_NOT_INSTALLED');
    }
    // 其他错误
    throw error;
  }
}

/**
 * 保存图片（如果响应中包含图片）
 */
async function saveImage(responseData, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const images = [];
  
  // 检查响应中的图片数据 - 处理 message.images 结构
  if (responseData.choices && Array.isArray(responseData.choices)) {
    for (const choice of responseData.choices) {
      if (choice.message) {
        const choiceIndex = choice.index !== undefined ? choice.index : 0;
        
        // 检查 message.images 数组（Gemini 3 Pro Image 的响应格式）
        if (choice.message.images && Array.isArray(choice.message.images)) {
          for (let imgIndex = 0; imgIndex < choice.message.images.length; imgIndex++) {
            const imageItem = choice.message.images[imgIndex];
            
            if (imageItem.type === 'image_url' && imageItem.image_url && imageItem.image_url.url) {
              const imageUrl = imageItem.image_url.url;
              
              // 提取 base64 数据
              const base64Info = extractBase64Data(imageUrl);
              if (base64Info) {
                try {
                  // 将 base64 转换为 Buffer
                  const imageBuffer = Buffer.from(base64Info.base64Data, 'base64');
                  
                  // 生成文件名（统一保存为 JPG）
                  const timestamp = Date.now();
                  const filename = `image_${timestamp}_choice${choiceIndex}_img${imgIndex}.jpg`;
                  const filepath = path.join(outputDir, filename);
                  
                  // 转换为 JPG 并保存
                  try {
                    const convertResult = await convertToJpg(imageBuffer, filepath);
                    console.log(`✓ 图片已转换为 JPG 并保存: ${convertResult.filepath}`);
                    images.push({
                      choiceIndex,
                      imageIndex: imgIndex,
                      filepath: convertResult.filepath,
                      format: 'jpg',
                      originalFormat: base64Info.originalFormat,
                    });
                  } catch (convertError) {
                    if (convertError.message === 'SHARP_NOT_INSTALLED') {
                      console.error(`✗ 无法转换图片: 需要安装 sharp 库`);
                      console.error(`  请运行: npm install sharp`);
                      console.error(`  或者: cd ${path.dirname(__dirname)} && npm install sharp`);
                      // 保存为临时 PNG 文件
                      const tempPngPath = filepath.replace(/\.jpg$/, '.png');
                      fs.writeFileSync(tempPngPath, imageBuffer);
                      console.log(`  临时保存为 PNG: ${tempPngPath}`);
                      images.push({
                        choiceIndex,
                        imageIndex: imgIndex,
                        filepath: tempPngPath,
                        format: 'png',
                        originalFormat: base64Info.originalFormat,
                        note: '需要安装 sharp 以转换为 JPG',
                      });
                    } else {
                      throw convertError;
                    }
                  }
                } catch (error) {
                  console.error(`✗ 保存图片失败:`, error);
                }
              } else {
                console.warn(`⚠ 无法提取图片数据，URL 格式可能不正确`);
              }
            }
          }
        }
        
        // 兼容处理：检查 message.content（如果是数组格式）
        if (choice.message.content && Array.isArray(choice.message.content)) {
          for (let itemIndex = 0; itemIndex < choice.message.content.length; itemIndex++) {
            const item = choice.message.content[itemIndex];
            
            if (item.type === 'image_url' && item.image_url && item.image_url.url) {
              const imageUrl = item.image_url.url;
              const base64Info = extractBase64Data(imageUrl);
              
              if (base64Info) {
                try {
                  const imageBuffer = Buffer.from(base64Info.base64Data, 'base64');
                  const timestamp = Date.now();
                  const filename = `image_${timestamp}_choice${choiceIndex}_item${itemIndex}.jpg`;
                  const filepath = path.join(outputDir, filename);
                  
                  try {
                    const convertResult = await convertToJpg(imageBuffer, filepath);
                    console.log(`✓ 图片已转换为 JPG 并保存: ${convertResult.filepath}`);
                    images.push({
                      choiceIndex,
                      itemIndex,
                      filepath: convertResult.filepath,
                      format: 'jpg',
                      originalFormat: base64Info.originalFormat,
                    });
                  } catch (convertError) {
                    if (convertError.message === 'SHARP_NOT_INSTALLED') {
                      console.error(`✗ 无法转换图片: 需要安装 sharp 库`);
                      console.error(`  请运行: npm install sharp`);
                      const tempPngPath = filepath.replace(/\.jpg$/, '.png');
                      fs.writeFileSync(tempPngPath, imageBuffer);
                      console.log(`  临时保存为 PNG: ${tempPngPath}`);
                      images.push({
                        choiceIndex,
                        itemIndex,
                        filepath: tempPngPath,
                        format: 'png',
                        originalFormat: base64Info.originalFormat,
                        note: '需要安装 sharp 以转换为 JPG',
                      });
                    } else {
                      throw convertError;
                    }
                  }
                } catch (error) {
                  console.error(`✗ 保存图片失败:`, error);
                }
              }
            }
          }
        }
      }
    }
  }

  return images;
}

/**
 * 格式化响应数据用于显示
 */
function formatResponse(responseData) {
  let output = '\n';
  output += '='.repeat(60) + '\n';
  output += 'API 响应信息\n';
  output += '='.repeat(60) + '\n';
  output += `模型: ${responseData.model || 'N/A'}\n`;
  output += `ID: ${responseData.id || 'N/A'}\n`;
  output += `创建时间: ${responseData.created ? new Date(responseData.created * 1000).toLocaleString('zh-CN') : 'N/A'}\n`;
  
  if (responseData.choices && Array.isArray(responseData.choices)) {
    output += `\n选择数量: ${responseData.choices.length}\n`;
    responseData.choices.forEach((choice, index) => {
      output += `\n选择 ${index + 1}:\n`;
      output += `  索引: ${choice.index}\n`;
      output += `  完成原因: ${choice.finish_reason || 'N/A'}\n`;
      
      if (choice.message) {
        output += `  角色: ${choice.message.role || 'N/A'}\n`;
        
        // 检查 images 数组
        if (choice.message.images && Array.isArray(choice.message.images)) {
          output += `  图片数量: ${choice.message.images.length}\n`;
          choice.message.images.forEach((img, imgIndex) => {
            output += `    图片 ${imgIndex + 1}: 类型=${img.type || 'N/A'}\n`;
            if (img.image_url && img.image_url.url) {
              const url = img.image_url.url;
              if (url) {
                const urlPreview = url.length > 100 ? url.substring(0, 100) + '...' : url;
                output += `      URL 长度: ${url.length} 字符\n`;
                output += `      URL 预览: ${urlPreview}\n`;
              } else {
                output += `      URL: 空\n`;
              }
            }
          });
        }
        
        // 检查 reasoning_content
        if (choice.message.reasoning_content) {
          const reasoningPreview = choice.message.reasoning_content.substring(0, 300);
          output += `  推理内容: ${reasoningPreview}${choice.message.reasoning_content.length > 300 ? '...' : ''}\n`;
        }
        
        if (choice.message.content) {
          const content = choice.message.content;
          if (Array.isArray(content)) {
            output += `  内容类型: 数组 (${content.length} 项)\n`;
            content.forEach((item, itemIndex) => {
              output += `    项 ${itemIndex + 1}: 类型=${item.type || 'N/A'}\n`;
              if (item.type === 'text' && item.text) {
                const textPreview = item.text.substring(0, 200);
                output += `      文本: ${textPreview}${item.text.length > 200 ? '...' : ''}\n`;
              } else if (item.type === 'image_url' && item.image_url) {
                output += `      图片 URL: ${item.image_url.url ? '已提供' : 'N/A'}\n`;
              }
            });
          } else if (typeof content === 'string') {
            const textPreview = content.substring(0, 500);
            output += `  内容: ${textPreview}${content.length > 500 ? '...' : ''}\n`;
          }
        }
      }
    });
  }

  if (responseData.usage) {
    output += `\n使用情况:\n`;
    output += `  提示词 tokens: ${responseData.usage.prompt_tokens || 0}\n`;
    output += `  完成 tokens: ${responseData.usage.completion_tokens || 0}\n`;
    output += `  总 tokens: ${responseData.usage.total_tokens || 0}\n`;
  }

  output += '\n' + '='.repeat(60) + '\n';
  output += '完整响应 JSON:\n';
  output += '='.repeat(60) + '\n';
  output += JSON.stringify(responseData, null, 2) + '\n';

  return output;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
用法: node test-gemini-image-api.js <提示词> [选项]

选项:
  --api-url <url>        API 基础 URL (默认: http://ai-service.tal.com/openai-compatible)
  --app-id <id>          App ID (默认: 从环境变量 TAL_MLOPS_APP_ID 获取)
  --app-key <key>        App Key (默认: 从环境变量 TAL_MLOPS_APP_KEY 获取)
  --model <model>        模型名称 (默认: gemini-3-pro-image)
  --modalities <list>    模态列表，逗号分隔 (默认: text,image)
  --output-dir <dir>     输出目录 (默认: ./gemini_output)

示例:
  node test-gemini-image-api.js "生成一个猫咪图片" --app-id 1000000000 --app-key your_key
  
环境变量示例:
  export TAL_MLOPS_APP_ID=1000000000
  export TAL_MLOPS_APP_KEY=your_app_key
  export GEMINI_API_BASE_URL=http://ai-service.tal.com/openai-compatible
  node test-gemini-image-api.js "生成一个猫咪图片"
    `);
    process.exit(1);
  }

  const prompt = args[0];
  const config = { ...defaultConfig };
  let outputDir = './gemini_output';

  // 解析命令行参数
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
      case '--app-key':
        config.appKey = value;
        break;
      case '--model':
        config.model = value;
        break;
      case '--modalities':
        config.modalities = value.split(',').map(s => s.trim());
        break;
      case '--output-dir':
        outputDir = value;
        break;
    }
  }

  // 验证配置
  if (!config.appId || !config.appKey) {
    console.error('错误: 必须提供 app-id 和 app-key');
    console.error('可以通过命令行参数或环境变量提供: TAL_MLOPS_APP_ID, TAL_MLOPS_APP_KEY');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Gemini 3 Pro Image API 测试脚本');
  console.log('='.repeat(60));
  console.log(`提示词: ${prompt}`);
  console.log(`API URL: ${config.apiBaseUrl}`);
  console.log(`模型: ${config.model}`);
  console.log(`模态: ${config.modalities.join(', ')}`);
  console.log(`输出目录: ${outputDir}`);
  console.log('='.repeat(60));
  console.log();

  try {
    // 调用 API
    console.log('正在调用 Gemini Image API...');
    const responseData = await callGeminiImageAPI(prompt, config);

    // 显示响应信息
    const responseInfo = formatResponse(responseData);
    console.log(responseInfo);

    // 保存图片
    console.log('\n检查并保存图片...');
    const images = await saveImage(responseData, outputDir);
    
    if (images.length > 0) {
      console.log(`\n✓ 共保存 ${images.length} 张图片`);
    } else {
      console.log('\n⚠ 响应中未找到图片数据');
      console.log('提示: 请检查 API 响应格式，可能需要根据实际响应格式调整图片提取逻辑');
    }

    // 保存完整响应到文件
    const outputFile = path.join(outputDir, `response_${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(responseData, null, 2), 'utf-8');
    console.log(`\n✓ 完整响应已保存到: ${outputFile}`);

    // 保存响应信息到文本文件
    const infoFile = path.join(outputDir, `response_${Date.now()}_info.txt`);
    fs.writeFileSync(infoFile, responseInfo, 'utf-8');
    console.log(`✓ 响应信息已保存到: ${infoFile}`);

  } catch (error) {
    console.error('\n错误:', error);
    process.exit(1);
  }

  console.log('\n完成!');
}

// 运行主函数
main().catch(error => {
  console.error('未处理的错误:', error);
  process.exit(1);
});

