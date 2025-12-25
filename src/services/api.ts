// API 配置
// 本地开发使用代理 '/api'
// 生产环境可通过环境变量 VITE_API_BASE_URL 配置后端地址
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

// 处理任务状态
export interface ProcessingTask {
  id: string
  status: 'processing' | 'completed' | 'failed'
  progress: number
  message: string
  results?: ProcessingResult[]
  error?: string
  createdAt: string
  completedAt?: string
}

// 处理结果
export interface ProcessingResult {
  taskId: string
  success: boolean
  knowledgePoint: string
  summary: string
  subject: string
  slides: SlideResult[]
  video?: {
    url: string
    duration: number
  }
  error?: string
}

// 幻灯片结果
export interface SlideResult {
  index: number
  title: string
  script: string
  subtitle: string
  imageUrl: string
  audioUrl: string
  audioDuration?: number
  subtitles?: Array<{   // 分段字幕（可选）
    text: string
    start: number       // 相对于本页开始的时间（秒）
    duration: number   // 持续时间（秒）
  }>
}

/**
 * 检查后端服务健康状态
 */
export async function checkHealth(): Promise<{
  status: string
  ffmpeg: boolean
}> {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) {
    throw new Error('后端服务不可用')
  }
  return response.json()
}

/**
 * 检查配置状态
 */
export async function checkConfigStatus(): Promise<{
  talApi: { configured: boolean }
  volcengineAsr: { configured: boolean }
  volcengineTts: { configured: boolean }
  ffmpeg: boolean
}> {
  const response = await fetch(`${API_BASE}/config/status`)
  if (!response.ok) {
    throw new Error('无法获取配置状态')
  }
  return response.json()
}

/**
 * 上传音频文件并开始处理
 * @param file - 音频文件
 * @param markers - 时间标记数组（秒）
 * @returns 任务 ID
 */
export async function uploadAndProcess(
  file: File, 
  markers: number[]
): Promise<{ taskId: string }> {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('markers', JSON.stringify(markers))

  const response = await fetch(`${API_BASE}/process`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '上传失败' }))
    throw new Error(error.error || '上传失败')
  }

  return response.json()
}

/**
 * 获取任务状态
 * @param taskId - 任务 ID
 */
export async function getTaskStatus(taskId: string): Promise<ProcessingTask> {
  const response = await fetch(`${API_BASE}/tasks/${taskId}`)
  
  if (!response.ok) {
    throw new Error('任务不存在')
  }

  return response.json()
}

/**
 * 获取所有任务
 */
export async function getAllTasks(): Promise<ProcessingTask[]> {
  const response = await fetch(`${API_BASE}/tasks`)
  
  if (!response.ok) {
    throw new Error('获取任务列表失败')
  }

  return response.json()
}

/**
 * 删除任务
 * @param taskId - 任务 ID
 */
export async function deleteTask(taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'DELETE',
  })
  
  if (!response.ok) {
    throw new Error('删除任务失败')
  }
}

/**
 * 轮询任务状态直到完成
 * @param taskId - 任务 ID
 * @param onProgress - 进度回调
 * @param interval - 轮询间隔（毫秒）
 */
export async function pollTaskUntilComplete(
  taskId: string,
  onProgress?: (task: ProcessingTask) => void,
  interval = 2000
): Promise<ProcessingTask> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const task = await getTaskStatus(taskId)
        onProgress?.(task)

        if (task.status === 'completed') {
          resolve(task)
        } else if (task.status === 'failed') {
          reject(new Error(task.error || '处理失败'))
        } else {
          setTimeout(poll, interval)
        }
      } catch (error) {
        reject(error)
      }
    }

    poll()
  })
}

// ==================== 兼容旧的 API 接口 ====================

// PPT 脚本接口（用于前端展示）
export interface PPTScript {
  slides: Array<{
    title: string
    script: string        // 逐字稿
    imagePrompt: string   // 图片生成提示词
    subtitle: string      // 字幕
  }>
}

// 保留旧接口的模拟实现，用于快速演示
export async function callLLM(messages: Array<{role: string, content: string}>): Promise<string> {
  // 这个函数现在由后端处理
  console.warn('callLLM 已移至后端处理')
  return ''
}

export async function generateImage(prompt: string): Promise<string> {
  // 这个函数现在由后端处理
  console.warn('generateImage 已移至后端处理')
  return ''
}

export async function transcribeAudio(audioFile: File, startTime: number, endTime: number): Promise<string> {
  // 这个函数现在由后端处理
  console.warn('transcribeAudio 已移至后端处理')
  return ''
}

export async function textToSpeech(text: string): Promise<string> {
  // 这个函数现在由后端处理
  console.warn('textToSpeech 已移至后端处理')
  return ''
}

export async function analyzeKnowledgePoint(transcript: string): Promise<{
  knowledgePoint: string
  summary: string
}> {
  // 这个函数现在由后端处理
  console.warn('analyzeKnowledgePoint 已移至后端处理')
  return { knowledgePoint: '', summary: '' }
}

export async function generatePPTScript(knowledgePoint: string, summary: string): Promise<PPTScript> {
  // 这个函数现在由后端处理
  console.warn('generatePPTScript 已移至后端处理')
  return { slides: [] }
}
