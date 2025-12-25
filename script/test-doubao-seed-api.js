#!/usr/bin/env node

/**
 * Doubao Seed 1.6 Flash API 测试脚本
 * 功能：
 * 1. 调用 Doubao Seed 1.6 Flash API 进行对话
 * 2. 支持流式响应
 * 3. 保存响应结果
 * 4. 显示 API 响应信息
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置参数
const defaultConfig = {
  apiBaseUrl: process.env.DOUBAO_API_BASE_URL || 'http://ai-service.tal.com/openai-compatible',
  appId: process.env.TAL_MLOPS_APP_ID || '',
  appKey: process.env.TAL_MLOPS_APP_KEY || '',
  model: 'doubao-seed-1.6-flash',
  stream: true,
  streamOptions: {
    include_usage: true,
  },
  extraBody: {
    reasoning: false,
  },
};

/**
 * 调用 Doubao Seed API（流式响应）
 */
async function callDoubaoSeedAPI(messages, config) {
  const url = `${config.apiBaseUrl}/v1/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
    'api-key': `${config.appId}:${config.appKey}`,
  };

  const body = {
    messages: messages,
    stream: config.stream,
    model: config.model,
    stream_options: config.streamOptions,
    extra_body: config.extraBody,
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

    if (!config.stream) {
      // 非流式响应
      const data = await response.json();
      return { type: 'non-stream', data };
    }

    // 流式响应处理
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    let buffer = '';

    console.log('开始接收流式响应...\n');

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后一个不完整的行

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') continue;
        
        // SSE 格式: data: {...} 或 data:{...}
        if (trimmedLine.startsWith('data:')) {
          const dataStr = trimmedLine.slice(5).trim(); // 移除 'data:' 前缀并去除空格
          
          if (dataStr === '[DONE]') {
            console.log('\n✓ 流式响应接收完成');
            continue;
          }

          try {
            const chunk = JSON.parse(dataStr);
            chunks.push(chunk);
            
            // 实时显示内容
            if (chunk.choices && chunk.choices[0]) {
              const delta = chunk.choices[0].delta;
              if (delta && delta.content) {
                process.stdout.write(delta.content);
              }
            }
          } catch (e) {
            // 忽略解析错误，可能是部分数据
            if (dataStr.length > 10) { // 只警告较长的数据
              console.warn('\n⚠ 解析 JSON 失败:', dataStr.substring(0, 100));
            }
          }
        }
      }
    }

    // 处理剩余的 buffer
    if (buffer.trim()) {
      const trimmedBuffer = buffer.trim();
      if (trimmedBuffer.startsWith('data:')) {
        const dataStr = trimmedBuffer.slice(5).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const chunk = JSON.parse(dataStr);
            chunks.push(chunk);
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    console.log('\n');
    return { type: 'stream', chunks };
  } catch (error) {
    console.error('Doubao Seed API 调用失败:', error);
    throw error;
  }
}

/**
 * 处理流式响应，提取完整内容
 */
function processStreamResponse(chunks) {
  let fullContent = '';
  let finishReason = null;
  let usage = null;
  let model = null;
  let id = null;

  for (const chunk of chunks) {
    if (chunk.model) model = chunk.model;
    if (chunk.id) id = chunk.id;

    if (chunk.choices && chunk.choices[0]) {
      const choice = chunk.choices[0];
      
      if (choice.delta && choice.delta.content) {
        fullContent += choice.delta.content;
      }
      
      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }

    if (chunk.usage) {
      usage = chunk.usage;
    }
  }

  return {
    model,
    id,
    content: fullContent,
    finishReason,
    usage,
    chunks,
  };
}

/**
 * 格式化响应数据用于显示
 */
function formatResponse(responseData, isStream) {
  let output = '\n';
  output += '='.repeat(60) + '\n';
  output += 'API 响应信息\n';
  output += '='.repeat(60) + '\n';

  if (isStream) {
    const processed = processStreamResponse(responseData.chunks);
    output += `模型: ${processed.model || 'N/A'}\n`;
    output += `ID: ${processed.id || 'N/A'}\n`;
    output += `完成原因: ${processed.finishReason || 'N/A'}\n`;
    output += `\n完整内容:\n`;
    output += '-'.repeat(60) + '\n';
    output += processed.content + '\n';
    output += '-'.repeat(60) + '\n';

    if (processed.usage) {
      output += `\n使用情况:\n`;
      output += `  提示词 tokens: ${processed.usage.prompt_tokens || 0}\n`;
      output += `  完成 tokens: ${processed.usage.completion_tokens || 0}\n`;
      output += `  总 tokens: ${processed.usage.total_tokens || 0}\n`;
    }

    output += `\n流式响应块数量: ${responseData.chunks.length}\n`;
  } else {
    output += `模型: ${responseData.data.model || 'N/A'}\n`;
    output += `ID: ${responseData.data.id || 'N/A'}\n`;
    output += `创建时间: ${responseData.data.created ? new Date(responseData.data.created * 1000).toLocaleString('zh-CN') : 'N/A'}\n`;

    if (responseData.data.choices && Array.isArray(responseData.data.choices)) {
      output += `\n选择数量: ${responseData.data.choices.length}\n`;
      responseData.data.choices.forEach((choice, index) => {
        output += `\n选择 ${index + 1}:\n`;
        output += `  索引: ${choice.index}\n`;
        output += `  完成原因: ${choice.finish_reason || 'N/A'}\n`;

        if (choice.message) {
          output += `  角色: ${choice.message.role || 'N/A'}\n`;
          if (choice.message.content) {
            const content = choice.message.content;
            const contentPreview = typeof content === 'string' 
              ? content.substring(0, 500) 
              : JSON.stringify(content).substring(0, 500);
            output += `  内容: ${contentPreview}${content.length > 500 ? '...' : ''}\n`;
          }
        }
      });
    }

    if (responseData.data.usage) {
      output += `\n使用情况:\n`;
      output += `  提示词 tokens: ${responseData.data.usage.prompt_tokens || 0}\n`;
      output += `  完成 tokens: ${responseData.data.usage.completion_tokens || 0}\n`;
      output += `  总 tokens: ${responseData.data.usage.total_tokens || 0}\n`;
    }
  }

  output += '\n' + '='.repeat(60) + '\n';
  output += '完整响应 JSON:\n';
  output += '='.repeat(60) + '\n';
  
  if (isStream) {
    output += JSON.stringify(responseData.chunks, null, 2) + '\n';
  } else {
    output += JSON.stringify(responseData.data, null, 2) + '\n';
  }

  return output;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
用法: node test-doubao-seed-api.js <消息内容> [选项]

选项:
  --api-url <url>        API 基础 URL (默认: http://ai-service.tal.com/openai-compatible)
  --app-id <id>          App ID (默认: 从环境变量 TAL_MLOPS_APP_ID 获取)
  --app-key <key>        App Key (默认: 从环境变量 TAL_MLOPS_APP_KEY 获取)
  --model <model>        模型名称 (默认: doubao-seed-1.6-flash)
  --no-stream            禁用流式响应 (默认: 启用流式响应)
  --reasoning            启用推理模式 (默认: false)
  --output-dir <dir>     输出目录 (默认: ./doubao_output)
  --system <text>        系统提示词（可选）

示例:
  node test-doubao-seed-api.js "你好，请介绍一下你自己" --app-id 1000000000 --app-key your_key
  
  # 使用系统提示词
  node test-doubao-seed-api.js "写一首诗" --system "你是一个诗人" --app-id 1000000000 --app-key your_key
  
  # 禁用流式响应
  node test-doubao-seed-api.js "ping" --no-stream --app-id 1000000000 --app-key your_key
  
环境变量示例:
  export TAL_MLOPS_APP_ID=1000000000
  export TAL_MLOPS_APP_KEY=your_app_key
  export DOUBAO_API_BASE_URL=http://ai-service.tal.com/openai-compatible
  node test-doubao-seed-api.js "你好"
    `);
    process.exit(1);
  }

  const userMessage = args[0];
  const config = { ...defaultConfig };
  let outputDir = './doubao_output';
  let systemPrompt = null;

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
      case '--no-stream':
        config.stream = false;
        i--; // 这个参数没有值
        break;
      case '--reasoning':
        config.extraBody.reasoning = true;
        i--; // 这个参数没有值
        break;
      case '--output-dir':
        outputDir = value;
        break;
      case '--system':
        systemPrompt = value;
        break;
    }
  }

  // 验证配置
  if (!config.appId || !config.appKey) {
    console.error('错误: 必须提供 app-id 和 app-key');
    console.error('可以通过命令行参数或环境变量提供: TAL_MLOPS_APP_ID, TAL_MLOPS_APP_KEY');
    process.exit(1);
  }

  // 构建消息数组
  const messages = [];
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
  }
  messages.push({
    role: 'user',
    content: userMessage,
  });

  console.log('='.repeat(60));
  console.log('Doubao Seed 1.6 Flash API 测试脚本');
  console.log('='.repeat(60));
  console.log(`用户消息: ${userMessage}`);
  if (systemPrompt) {
    console.log(`系统提示: ${systemPrompt}`);
  }
  console.log(`API URL: ${config.apiBaseUrl}`);
  console.log(`模型: ${config.model}`);
  console.log(`流式响应: ${config.stream ? '是' : '否'}`);
  console.log(`推理模式: ${config.extraBody.reasoning ? '是' : '否'}`);
  console.log(`输出目录: ${outputDir}`);
  console.log('='.repeat(60));
  console.log();

  try {
    // 调用 API
    console.log('正在调用 Doubao Seed API...');
    const responseData = await callDoubaoSeedAPI(messages, config);

    const isStream = responseData.type === 'stream';

    // 显示响应信息
    const responseInfo = formatResponse(responseData, isStream);
    console.log(responseInfo);

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 保存完整响应到文件
    const timestamp = Date.now();
    const outputFile = path.join(outputDir, `response_${timestamp}.json`);
    
    if (isStream) {
      fs.writeFileSync(outputFile, JSON.stringify(responseData.chunks, null, 2), 'utf-8');
    } else {
      fs.writeFileSync(outputFile, JSON.stringify(responseData.data, null, 2), 'utf-8');
    }
    console.log(`\n✓ 完整响应已保存到: ${outputFile}`);

    // 保存响应信息到文本文件
    const infoFile = path.join(outputDir, `response_${timestamp}_info.txt`);
    fs.writeFileSync(infoFile, responseInfo, 'utf-8');
    console.log(`✓ 响应信息已保存到: ${infoFile}`);

    // 如果是流式响应，保存提取的内容
    if (isStream) {
      const processed = processStreamResponse(responseData.chunks);
      const contentFile = path.join(outputDir, `response_${timestamp}_content.txt`);
      let contentOutput = `Doubao Seed API 响应内容\n`;
      contentOutput += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
      contentOutput += `模型: ${processed.model || 'N/A'}\n`;
      contentOutput += `完成原因: ${processed.finishReason || 'N/A'}\n`;
      if (processed.usage) {
        contentOutput += `提示词 tokens: ${processed.usage.prompt_tokens || 0}\n`;
        contentOutput += `完成 tokens: ${processed.usage.completion_tokens || 0}\n`;
        contentOutput += `总 tokens: ${processed.usage.total_tokens || 0}\n`;
      }
      contentOutput += `${'='.repeat(60)}\n\n`;
      contentOutput += processed.content;
      fs.writeFileSync(contentFile, contentOutput, 'utf-8');
      console.log(`✓ 响应内容已保存到: ${contentFile}`);
    }

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

