/**
 * LLM 服务
 * 基于 Doubao Seed 1.6 Flash 模型
 */
import { config, getTalApiKey } from '../config.js';

/**
 * 调用 Doubao Seed LLM API
 * @param {Array<{role: string, content: string}>} messages - 消息数组
 * @param {object} options - 选项
 * @returns {Promise<string>} - LLM 响应内容
 */
export async function callLLM(messages, options = {}) {
  const url = `${config.talApi.baseUrl}/v1/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
    'api-key': getTalApiKey(),
  };

  const body = {
    model: options.model || 'doubao-seed-1.6-flash',
    messages: messages,
    stream: false,
    extra_body: {
      reasoning: options.reasoning || false,
    },
  };

  try {
    console.log('LLM 请求:', messages[messages.length - 1]?.content?.substring(0, 100) + '...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API 请求失败:', response.status, errorText);
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('LLM 响应:', content.substring(0, 100) + '...');
    console.log('Token 使用:', data.usage);
    
    return content;
  } catch (error) {
    console.error('LLM API 调用失败:', error);
    throw error;
  }
}

/**
 * 分析课堂内容，提取知识点
 * @param {string} transcript - 语音转文字内容
 * @returns {Promise<{knowledgePoint: string, summary: string, subject: string}>}
 */
export async function analyzeKnowledgePoint(transcript) {
  const systemPrompt = `你是一个专业的教育内容分析师，擅长从课堂录音转写内容中提取核心知识点。
请仔细分析课堂内容，识别出主要讲解的知识点和学科。`;

  const userPrompt = `请分析以下课堂转写内容，提取核心知识点：

"""
${transcript}
"""

请返回 JSON 格式的分析结果：
{
  "knowledgePoint": "核心知识点名称（简洁，10字以内）",
  "summary": "知识点概要（50字以内，概括主要内容）",
  "subject": "学科（chinese/math/english/physics/chemistry/biology/history/geography 之一）",
  "keyPoints": ["要点1", "要点2", "要点3"]
}

只返回 JSON，不要有其他内容。`;

  try {
    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    // 尝试解析 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        knowledgePoint: result.knowledgePoint || '知识点',
        summary: result.summary || transcript.substring(0, 50) + '...',
        subject: result.subject || 'math',
        keyPoints: result.keyPoints || [],
      };
    }

    throw new Error('无法解析 LLM 响应');
  } catch (error) {
    console.error('知识点分析失败:', error);
    // 返回默认值
    return {
      knowledgePoint: '课堂知识点',
      summary: transcript.substring(0, 50) + '...',
      subject: 'math',
      keyPoints: [],
    };
  }
}

/**
 * 生成 PPT 脚本
 * @param {string} knowledgePoint - 知识点名称
 * @param {string} summary - 知识点概要
 * @param {string[]} keyPoints - 关键要点
 * @returns {Promise<{slides: Array}>}
 */
export async function generatePPTScript(knowledgePoint, summary, keyPoints = []) {
  const systemPrompt = `你是一个专业的教育内容创作者，专门为初中生创作清晰详细的教学内容。
你需要创作适合初中生理解的PPT讲解脚本，语言要清晰、准确、专业，避免过于低幼化的表达。
图片风格统一采用"疯狂动物城"风格，迪士尼皮克斯画质，可爱精致。使用朱迪兔子作为老师角色。
所有内容必须使用中文。
重要：图片必须以黑板为核心，占据画面 90% 以上的位置，展示具体的知识点内容、公式、定义、步骤等。老师角色（朱迪兔子）只需简单显示即可，占据画面很小的位置。场景要简洁，不要出现其他动物学生角色，避免过多装饰性元素。
黑板上的文字内容尽量使用中文，除非是英语课内容或数学/物理/化学等学科的特定符号和公式。

场景背景：这是查漏补缺的场景。学生在课堂上遇到不会的知识点，按了按键求助。"我"是一直陪伴学生学习的朋友，知道学生刚才在课上哪里没听懂，现在来帮他讲清楚。使用"我"来自称，语气要像了解学生情况的好朋友。`;

  const userPrompt = `请为以下知识点创作一个教学 PPT 脚本：

知识点：${knowledgePoint}
概要：${summary}
${keyPoints.length > 0 ? `关键要点：\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : ''}

重要背景信息：
- 这是查漏补缺的场景，"我"是一直陪伴学生学习的朋友，知道学生刚才在课上这个知识点没听懂
- 使用"我"来自称，不要使用"星星"等第三人称
- 语气要像了解学生情况的好朋友，比如"课上这个你没学会是吧，没关系，我来给你讲"
- 不要用"我知道你可能之前学过"这种不确定的说法，而是直接、自然地开始讲解

请创作 5-8 页 PPT 的完整脚本，包括：
1. 封面/开场（1页）
   * 开场白要像了解学生情况的朋友，比如"课上这个${knowledgePoint}你没太听懂是吧，没关系，我来给你讲讲"
   * 语气要亲切自然，像一直陪伴学习的好朋友
   * 不要用"我知道你可能..."这种不确定的说法
2. 核心内容讲解（3-6页，如果知识点较难，可以拆分成多页详细讲解）
   * 因为是复习，可以适当回顾之前学过的内容
   * 重点讲解容易混淆或忘记的部分
   * 讲解要详细，对于较难的知识点要拆开讲解，逐步深入
3. 总结回顾（1页）
   * 帮助巩固记忆，可以用朋友的口吻鼓励

每页 PPT 需要包含：
- title: 页面标题（简洁有力，中文）
- script: 详细的讲解逐字稿（150-300字，适合配音朗读，语言清晰专业但亲切友好，适合初中生理解水平，避免过于低幼化的表达，中文）
  * 第一页开场白要像了解学生情况的朋友，比如"课上这个你没太听懂是吧，没关系，我来给你讲讲"
  * 语气要像一直陪伴学习的好朋友，自然直接，使用"我"来自称
  * 不要用"我知道你可能之前学过"这种不确定的说法
  * 因为是查漏补缺，可以适当回顾和强调重点
  * 使用准确的专业术语，但要用通俗易懂的方式解释
  * 可以适当举例说明，但不要过于幼稚化
  * **重要：讲解内容必须与黑板上显示的内容完全对应，逐字稿要讲解黑板上写的公式、定义、步骤等具体内容**
  * **讲解时用自然的讲课语气引导学生看黑板，黑板上的内容是"我"写的，所以要说"来看黑板"、"我在黑板上写了..."、"看这里"等，绝对不要用"黑板上写着XX"这种第三方描述性语气**
- imagePrompt: 教学插图描述（中文），必须满足以下要求：
  * 疯狂动物城风格，迪士尼皮克斯画质，可爱精致
  * 必须以黑板为核心，占据画面 90% 以上的位置
  * 黑板上必须清晰展示本页的核心知识点、公式、定义、步骤、图表等具体内容
  * **黑板上显示的内容必须与 script 讲解的内容完全一致，script 讲解什么，黑板上就要显示什么**
  * **黑板上的文字尽量使用中文，除非是英语课内容或特定符号公式**
  * 朱迪兔子老师只需简单显示即可，占据画面很小的位置
  * 不要出现其他动物学生角色，不要出现学生坐在课桌前的场景
  * 可以添加信息图、思维导图、流程图等可视化元素，但要整合在黑板上
  * 场景要简洁，避免过多装饰性元素
  * 图片中的文字内容要清晰可读，让学生能从黑板内容中直接学到知识
- subtitle: 简短字幕/要点（15字以内，中文），这是本页的主要字幕
- subtitles: 字幕分段数组（可选），用于生成跟随语音变化的字幕，格式：[{text: "字幕文本", start: 0, duration: 2}]，如果不提供则使用 subtitle 作为整页字幕

返回 JSON 格式：
{
  "slides": [
    {
      "title": "页面标题",
      "script": "讲解逐字稿...（第一页开场白要像了解学生情况的朋友，比如'课上这个你没太听懂是吧，没关系，我来给你讲讲'，讲解内容必须与黑板上显示的内容完全对应）",
      "imagePrompt": "疯狂动物城风格教学插图，迪士尼皮克斯画质：画面以绿色大黑板为核心，占据画面90%以上的位置，黑板上用粉笔清晰写着'知识点标题'（中文），下面详细列出定义、公式、要点等内容。朱迪兔子老师只在画面边缘简单出现。没有其他动物角色",
      "subtitle": "简短字幕",
      "subtitles": [
        {"text": "第一段字幕", "start": 0, "duration": 3},
        {"text": "第二段字幕", "start": 3, "duration": 4}
      ]
    }
  ]
}

注意：
- script 讲解的内容必须与 imagePrompt 中黑板上显示的内容完全一致
- 如果提供了 subtitles 数组，将使用它来生成跟随语音变化的字幕；如果不提供，则使用 subtitle 作为整页字幕
- subtitles 数组中的时间点是相对于本页开始的时间（秒），duration 是持续时间（秒）

只返回 JSON，不要有其他内容。`;

  try {
    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    // 尝试解析 JSON - 支持多种格式
    let result = null;
    
    // 1. 首先尝试匹配包含 slides 的对象
    const objectMatch = response.match(/\{[\s\S]*"slides"[\s\S]*\}/);
    if (objectMatch) {
      try {
        result = JSON.parse(objectMatch[0]);
      } catch (e) {
        console.log('对象格式解析失败，尝试其他格式');
      }
    }
    
    // 2. 如果失败，尝试匹配数组格式（LLM 可能直接返回数组）
    if (!result) {
      const arrayMatch = response.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          const slides = JSON.parse(arrayMatch[0]);
          if (Array.isArray(slides)) {
            result = { slides };
          }
        } catch (e) {
          console.log('数组格式解析失败，尝试修复 JSON');
        }
      }
    }
    
    // 3. 尝试修复常见的 JSON 格式问题
    if (!result) {
      const fixedJson = fixJsonString(response);
      if (fixedJson) {
        try {
          result = JSON.parse(fixedJson);
          if (Array.isArray(result)) {
            result = { slides: result };
          }
        } catch (e) {
          console.log('修复后的 JSON 仍然无法解析');
        }
      }
    }
    
    // 验证和规范化数据
    if (result && result.slides && Array.isArray(result.slides)) {
      result.slides = result.slides.map((slide, index) => ({
        title: slide.title || `第${index + 1}页`,
        script: slide.script || '',
        imagePrompt: normalizeImagePrompt(slide.imagePrompt || slide.image_prompt || ''),
        subtitle: slide.subtitle || '',
        subtitles: slide.subtitles || undefined, // 保留分段字幕数据
      }));
      return result;
    }

    throw new Error('无法解析 LLM 响应');
  } catch (error) {
    console.error('PPT 脚本生成失败:', error);
    // 返回默认脚本
    return generateDefaultScript(knowledgePoint, summary);
  }
}

/**
 * 尝试修复常见的 JSON 格式问题
 */
function fixJsonString(str) {
  try {
    // 提取 JSON 部分
    let jsonStr = str;
    
    // 找到第一个 { 或 [
    const firstBrace = str.indexOf('{');
    const firstBracket = str.indexOf('[');
    
    let start = -1;
    if (firstBrace >= 0 && firstBracket >= 0) {
      start = Math.min(firstBrace, firstBracket);
    } else if (firstBrace >= 0) {
      start = firstBrace;
    } else if (firstBracket >= 0) {
      start = firstBracket;
    }
    
    if (start >= 0) {
      jsonStr = str.substring(start);
    }
    
    // 找到最后一个 } 或 ]
    const lastBrace = jsonStr.lastIndexOf('}');
    const lastBracket = jsonStr.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);
    
    if (end >= 0) {
      jsonStr = jsonStr.substring(0, end + 1);
    }
    
    // 修复常见问题
    // 1. 移除尾部逗号
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    
    // 2. 修复未转义的换行符
    jsonStr = jsonStr.replace(/\n/g, '\\n');
    
    return jsonStr;
  } catch (e) {
    return null;
  }
}

/**
 * 规范化图片提示词
 */
function normalizeImagePrompt(prompt) {
  // 确保提示词包含疯狂动物城风格
  if (!prompt) {
    return '疯狂动物城风格插图，迪士尼皮克斯画质，朱迪兔子在温馨明亮的教室里';
  }
  
  // 确保包含疯狂动物城风格描述
  if (!prompt.includes('疯狂动物城') && !prompt.toLowerCase().includes('zootopia')) {
    return `疯狂动物城风格插图，${prompt}`;
  }
  
  return prompt;
}

/**
 * 生成默认脚本（兜底方案）
 */
function generateDefaultScript(knowledgePoint, summary) {
  return {
    slides: [
      {
        title: knowledgePoint,
        script: `课上这个${knowledgePoint}你没太听懂是吧，没关系，我来给你讲讲。咱们一起把这个知识点搞清楚。`,
        imagePrompt: `疯狂动物城风格教学插图，迪士尼皮克斯画质：画面以绿色大黑板为核心，占据画面90%以上，黑板上用粉笔清晰写着大标题"${knowledgePoint}"（中文），下面列出本节课要复习的重点和要点。朱迪兔子老师只在画面边缘简单出现，没有其他动物角色`,
        subtitle: `复习：${knowledgePoint}`,
      },
      {
        title: '知识讲解',
        script: summary || `让我们来回顾一下${knowledgePoint}的基本概念和核心内容。首先，我们需要理解它的定义和基本特征。`,
        imagePrompt: `疯狂动物城风格教学插图，迪士尼皮克斯画质：画面以绿色大黑板为核心，占据画面90%以上，黑板上用粉笔清晰写着"${knowledgePoint}"的定义、特征和核心要点（中文），旁边画着示意图和标注。朱迪兔子老师只在画面边缘简单出现，没有其他动物角色`,
        subtitle: '核心概念',
      },
      {
        title: '详细解析',
        script: `接下来，我们深入分析${knowledgePoint}的具体内容和应用方法。让我们逐步理解其中的关键要素。`,
        imagePrompt: `疯狂动物城风格教学插图，迪士尼皮克斯画质：画面以绿色大黑板为核心，占据画面90%以上，黑板上详细列出${knowledgePoint}的各个要素、步骤或分类（中文），用粉笔清晰标注。朱迪兔子老师只在画面边缘简单出现，没有其他动物角色`,
        subtitle: '深入理解',
      },
      {
        title: '举例说明',
        script: `为了更好地理解${knowledgePoint}，我们来看一些具体的例子。这些例子可以帮助我们掌握这个概念的实际应用。`,
        imagePrompt: `疯狂动物城风格教学插图，迪士尼皮克斯画质：画面以绿色大黑板为核心，占据画面90%以上，黑板上画着具体的例子和解题步骤（中文），用粉笔清晰标注。朱迪兔子老师只在画面边缘简单出现，没有其他动物角色`,
        subtitle: '实例分析',
      },
      {
        title: '课堂小结',
        script: `好了，${knowledgePoint}的主要内容就是这些。现在应该清楚多了吧？有什么不明白的随时问我哈。`,
        imagePrompt: `疯狂动物城风格教学插图，迪士尼皮克斯画质：画面以绿色大黑板为核心，占据画面90%以上，黑板上画着知识点总结的思维导图或要点列表（中文），中心是"${knowledgePoint}"，周围连接着关键内容。朱迪兔子老师只在画面边缘简单出现，没有其他动物角色`,
        subtitle: `${knowledgePoint} - 总结回顾`,
      },
    ],
  };
}

