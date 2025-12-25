import { PPTSlide, VideoRecord, Subject, TimeMarker } from '../types'
import { 
  uploadAndProcess, 
  pollTaskUntilComplete, 
  ProcessingTask,
  ProcessingResult,
  checkHealth 
} from './api'

// 生成唯一 ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

// 处理进度回调
type ProgressCallback = (progress: number, message: string) => void

// 记录创建/更新回调
type RecordCallback = (record: VideoRecord, isNew: boolean) => void

/**
 * 检查后端服务是否可用
 */
export async function checkBackendAvailable(): Promise<boolean> {
  try {
    await checkHealth()
    return true
  } catch {
    return false
  }
}

/**
 * 将后端结果转换为前端 VideoRecord 格式
 */
function convertToVideoRecord(
  result: ProcessingResult,
  markerTime: number
): VideoRecord {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const slides: PPTSlide[] = result.slides?.map((slide, index) => ({
    id: generateId(),
    index: index + 1,
    imageUrl: slide.imageUrl,
    script: slide.script,
    audioUrl: slide.audioUrl,
    duration: slide.audioDuration ? Math.ceil(slide.audioDuration / 1000) : 30,
    subtitle: slide.subtitle,
    subtitles: slide.subtitles, // 包含分段字幕
  })) || []

  return {
    id: result.taskId || generateId(),
    title: result.knowledgePoint || '未识别到内容',
    subject: (result.subject as Subject) || 'math',
    date: dateStr,
    timestamp: formatTime(markerTime),
    createdAt: new Date().toISOString(),
    status: 'completed',
    progress: 100,
    learningStatus: 'not_started',
    watchedProgress: 0,
    isFavorite: false,
    thumbnailUrl: slides[0]?.imageUrl,
    slides,
    knowledgePoint: result.knowledgePoint || '未识别到内容',
    summary: result.summary || '',
    videoUrl: result.video?.url,
  }
}

/**
 * 主处理函数：处理上传的音频文件
 */
export async function processAudioFile(
  file: File,
  markers: TimeMarker[],
  subject: Subject,
  onProgress: ProgressCallback,
  onRecordChanged: RecordCallback
): Promise<VideoRecord[]> {
  const records: VideoRecord[] = []
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  
  // 验证时间标记
  if (!markers || markers.length === 0) {
    throw new Error('请至少输入一个时间标记')
  }
  
  const markerTimes = markers.map(m => m.time)

  // 为每个标记点创建初始的处理中记录
  const initialRecords: VideoRecord[] = markers.map((marker, index) => ({
    id: generateId(),
    title: `知识点 ${index + 1}`,
    subject,
    date: dateStr,
    timestamp: formatTime(marker.time),
    createdAt: new Date().toISOString(),
    status: 'processing' as const,
    progress: 0,
    learningStatus: 'not_started' as const,
    watchedProgress: 0,
    isFavorite: false,
    slides: [],
    knowledgePoint: '',
    summary: '',
  }))

  // 记录哪些记录已经创建（用于按顺序显示）
  const createdRecords = new Set<number>()
  let nextIndexToCreate = 0 // 下一个要创建的索引

  try {
    // 检查后端是否可用
    onProgress(2, '检查后端服务...')
    const backendAvailable = await checkBackendAvailable()
    
    if (!backendAvailable) {
      throw new Error('后端服务不可用，请确保已启动后端服务（npm run server）')
    }

    // 立即创建第一个卡片
    if (initialRecords.length > 0) {
      createdRecords.add(0)
      nextIndexToCreate = 1
      onRecordChanged(initialRecords[0], true)
    }

    // 上传文件并开始处理
    onProgress(5, '上传音频文件...')
    const { taskId } = await uploadAndProcess(file, markerTimes)

    // 记录哪些任务已经完成（避免重复更新）
    const completedTasks = new Set<number>()

    // 轮询任务状态
    const completedTask = await pollTaskUntilComplete(
      taskId,
      (task: ProcessingTask) => {
        onProgress(Math.round(task.progress), task.message)
        
        // 检查是否有新的任务开始或完成
        if (task.results && Array.isArray(task.results)) {
          for (let i = 0; i < task.results.length; i++) {
            const result: any = task.results[i]
            
            // 如果检测到任务已开始（started: true），且还没创建，创建对应的记录
            // 使用 started 标记而不是 step === 'start'，因为 step 会被后续更新覆盖
            if (result && result.started && !createdRecords.has(i)) {
              createdRecords.add(i)
              if (i >= nextIndexToCreate) {
                nextIndexToCreate = i + 1
              }
              onRecordChanged(initialRecords[i], true)
              console.log(`标记点 ${i + 1} 开始处理，创建卡片`)
            }
            
            // 如果检测到 step: 'completed'，且还没处理过，立即更新为完成状态
            if (result && result.step === 'completed' && !completedTasks.has(i)) {
              completedTasks.add(i)
              // 确保该记录已创建
              if (!createdRecords.has(i)) {
                createdRecords.add(i)
                onRecordChanged(initialRecords[i], true)
              }
              // 转换为完成状态的 VideoRecord
              const videoRecord = convertToVideoRecord(result as ProcessingResult, markerTimes[i])
              videoRecord.id = initialRecords[i].id // 保持相同的 ID
              records.push(videoRecord)
              onRecordChanged(videoRecord, false)
              console.log(`标记点 ${i + 1} 处理完成，已更新卡片状态`)
            }
            
            // 如果检测到 step: 'failed'，标记为失败
            if (result && result.step === 'failed' && !completedTasks.has(i)) {
              completedTasks.add(i)
              const failedRecord: VideoRecord = {
                ...initialRecords[i],
                status: 'failed',
                progress: 0,
                title: `处理失败: ${result.error || '未知错误'}`,
              }
              records.push(failedRecord)
              onRecordChanged(failedRecord, false)
            }
          }
          
          // 更新仍在处理中的记录的进度
          task.results.forEach((result: any, index: number) => {
            // 跳过已完成或已失败的任务
            if (completedTasks.has(index)) return
            
            if (createdRecords.has(index)) {
              const updatedRecord: VideoRecord = {
                ...initialRecords[index],
                progress: Math.round(task.progress),
              }
              
              // 如果有结果数据，更新标题等
              if (result && result.knowledgePoint) {
                updatedRecord.title = result.knowledgePoint
                updatedRecord.knowledgePoint = result.knowledgePoint
              }
              if (result && result.summary) {
                updatedRecord.summary = result.summary
              }
              
              onRecordChanged(updatedRecord, false)
            }
          })
        }
      }
    )

    // 处理完成，检查是否有遗漏的结果（轮询期间未处理的）
    if (completedTask.results && Array.isArray(completedTask.results)) {
      completedTask.results.forEach((result: unknown, index: number) => {
        // 跳过已经在轮询期间处理过的任务
        if (completedTasks.has(index)) return
        
        const typedResult = result as ProcessingResult
        if (typedResult && typedResult.success !== false) {
          const videoRecord = convertToVideoRecord(typedResult, markerTimes[index])
          videoRecord.id = initialRecords[index].id // 保持相同的 ID
          records.push(videoRecord)
          onRecordChanged(videoRecord, false)
        } else {
          // 处理失败
          const failedRecord: VideoRecord = {
            ...initialRecords[index],
            status: 'failed',
            progress: 0,
            title: `处理失败: ${(typedResult as ProcessingResult)?.error || '未知错误'}`,
          }
          records.push(failedRecord)
          onRecordChanged(failedRecord, false)
        }
      })
    } else if (records.length === 0) {
      // 没有结果且没有在轮询期间处理过，标记所有为失败
      throw new Error('后端返回的结果为空')
    }

    onProgress(100, '处理完成！')
    return records
  } catch (error) {
    console.error('Processing failed:', error)
    const errorMessage = error instanceof Error ? error.message : '处理失败'
    
    // 将所有记录标记为失败
    initialRecords.forEach(record => {
      const failedRecord: VideoRecord = {
        ...record,
        status: 'failed',
        progress: 0,
        title: `处理失败: ${errorMessage}`,
      }
      onRecordChanged(failedRecord, false)
    })
    
    throw error
  }
}

// 格式化时间
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// 解析时间标记输入
export function parseTimeMarkers(input: string): TimeMarker[] {
  const markers: TimeMarker[] = []
  
  if (!input || !input.trim()) {
    return markers
  }
  
  const parts = input.split(/[,，\s]+/).filter(Boolean)
  
  for (const part of parts) {
    const trimmed = part.trim()
    
    if (trimmed.includes(':')) {
      const segments = trimmed.split(':').map(Number)
      let seconds = 0
      
      if (segments.length === 2 && !isNaN(segments[0]) && !isNaN(segments[1])) {
        // MM:SS
        seconds = segments[0] * 60 + segments[1]
      } else if (segments.length === 3 && !isNaN(segments[0]) && !isNaN(segments[1]) && !isNaN(segments[2])) {
        // HH:MM:SS
        seconds = segments[0] * 3600 + segments[1] * 60 + segments[2]
      }
      
      if (seconds > 0) {
        markers.push({ time: seconds })
      }
    } else {
      const seconds = parseInt(trimmed, 10)
      if (!isNaN(seconds) && seconds > 0) {
        markers.push({ time: seconds })
      }
    }
  }
  
  return markers.sort((a, b) => a.time - b.time)
}
