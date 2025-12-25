// 学科类型
export type Subject = 'chinese' | 'math' | 'english' | 'physics' | 'chemistry' | 'biology' | 'history' | 'geography'

// 学科配置
export const SubjectConfig: Record<Subject, { name: string; color: string; shortName: string }> = {
  chinese: { name: '语文', color: '#eb352f', shortName: '语' },
  math: { name: '数学', color: '#f5a623', shortName: '数' },
  english: { name: '英语', color: '#4a90d9', shortName: '英' },
  physics: { name: '物理', color: '#50c878', shortName: '理' },
  chemistry: { name: '化学', color: '#9b59b6', shortName: '化' },
  biology: { name: '生物', color: '#27ae60', shortName: '生' },
  history: { name: '历史', color: '#e67e22', shortName: '史' },
  geography: { name: '地理', color: '#16a085', shortName: '地' },
}

// 视频状态
export type VideoStatus = 'processing' | 'completed' | 'failed'

// 学习状态
export type LearningStatus = 'not_started' | 'in_progress' | 'completed'

// PPT 页面
export interface PPTSlide {
  id: string
  index: number
  imageUrl: string
  script: string        // 逐字稿
  audioUrl: string      // 语音 URL
  duration: number      // 时长（秒）
  subtitle: string      // 字幕
  subtitles?: Array<{   // 分段字幕（可选）
    text: string
    start: number       // 相对于本页开始的时间（秒）
    duration: number   // 持续时间（秒）
  }>
}

// 视频记录
export interface VideoRecord {
  id: string
  title: string
  subject: Subject
  date: string          // YYYY-MM-DD
  timestamp: string     // 标记的时间点
  createdAt: string
  status: VideoStatus
  progress: number      // 处理进度 0-100
  learningStatus: LearningStatus
  watchedProgress: number  // 观看进度 0-100
  isFavorite: boolean
  thumbnailUrl?: string
  videoUrl?: string     // 合成视频的 URL
  slides: PPTSlide[]
  knowledgePoint: string  // 知识点
  summary: string         // 概要
}

// 日期分组的视频
export interface DayGroup {
  date: string
  label: string         // 如 "8月16日·今日"
  records: VideoRecord[]
}

// 上传状态
export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error'

// 时间标记点
export interface TimeMarker {
  time: number          // 秒
  label?: string
}

// 上传任务
export interface UploadTask {
  id: string
  file: File
  markers: TimeMarker[]
  status: UploadStatus
  progress: number
  error?: string
}

// 筛选标签
export type FilterTab = 'all' | 'not_learned' | 'learned' | 'favorite'

