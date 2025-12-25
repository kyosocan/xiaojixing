import { VideoRecord, Subject } from '../types'

// 生成唯一 ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

// 创建处理中的记录（仅用于初始化处理状态）
export function createProcessingRecord(
  title: string, 
  subject: Subject,
  timestamp: string
): VideoRecord {
  const today = new Date()
  return {
    id: generateId(),
    title,
    subject,
    date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    timestamp,
    createdAt: new Date().toISOString(),
    status: 'processing',
    progress: 0,
    learningStatus: 'not_started',
    watchedProgress: 0,
    isFavorite: false,
    slides: [],
    knowledgePoint: '',
    summary: '',
  }
}
