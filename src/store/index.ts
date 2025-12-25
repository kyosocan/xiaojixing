import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { VideoRecord, FilterTab, UploadTask, DayGroup } from '../types'

interface AppState {
  // 视频记录
  records: VideoRecord[]
  setRecords: (records: VideoRecord[]) => void
  addRecord: (record: VideoRecord) => void
  updateRecord: (id: string, updates: Partial<VideoRecord>) => void
  deleteRecord: (id: string) => void
  
  // 分组数据
  groupedRecords: DayGroup[]
  
  // 筛选
  activeTab: FilterTab
  setActiveTab: (tab: FilterTab) => void
  
  // 上传任务
  uploadTasks: UploadTask[]
  addUploadTask: (task: UploadTask) => void
  updateUploadTask: (id: string, updates: Partial<UploadTask>) => void
  removeUploadTask: (id: string) => void
  
  // 当前批次处理状态
  currentBatchTotal: number  // 当前批次的总任务数
  setCurrentBatchTotal: (total: number) => void
  clearCurrentBatch: () => void
  
  // 上传弹窗
  isUploadModalOpen: boolean
  setUploadModalOpen: (open: boolean) => void
  
  // 当前播放的视频
  currentVideoId: string | null
  setCurrentVideoId: (id: string | null) => void
  
  // 初始化
  init: () => void
  
  // 清除所有数据
  clearAll: () => void
}

// 按日期分组
function groupByDate(records: VideoRecord[]): DayGroup[] {
  const groups: Map<string, VideoRecord[]> = new Map()
  
  records.forEach(record => {
    const date = record.date
    if (!groups.has(date)) {
      groups.set(date, [])
    }
    groups.get(date)!.push(record)
  })
  
  const today = new Date()
  const todayStr = formatDate(today)
  
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, records]) => ({
      date,
      label: getDateLabel(date, todayStr),
      records: records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }))
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getDateLabel(date: string, today: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekDay = weekDays[dateObj.getDay()]
  
  if (date === today) {
    return `${month}月${day}日·今日`
  }
  
  return `${month}月${day}日·${weekDay}`
}

// localStorage 键名
const STORAGE_KEY = 'xiaojixing-records'

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      records: [],
      groupedRecords: [],
      activeTab: 'all',
      uploadTasks: [],
      currentBatchTotal: 0,
      isUploadModalOpen: false,
      currentVideoId: null,
      
      setRecords: (records) => {
        set({ 
          records,
          groupedRecords: groupByDate(records)
        })
      },
      
      addRecord: (record) => {
        const records = [...get().records, record]
        set({ 
          records,
          groupedRecords: groupByDate(records)
        })
      },
      
      updateRecord: (id, updates) => {
        const records = get().records.map(r => 
          r.id === id ? { ...r, ...updates } : r
        )
        set({ 
          records,
          groupedRecords: groupByDate(records)
        })
      },
      
      deleteRecord: (id) => {
        const records = get().records.filter(r => r.id !== id)
        set({
          records,
          groupedRecords: groupByDate(records)
        })
      },
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      addUploadTask: (task) => {
        set({ uploadTasks: [...get().uploadTasks, task] })
      },
      
      updateUploadTask: (id, updates) => {
        set({
          uploadTasks: get().uploadTasks.map(t =>
            t.id === id ? { ...t, ...updates } : t
          )
        })
      },
      
      removeUploadTask: (id) => {
        set({
          uploadTasks: get().uploadTasks.filter(t => t.id !== id)
        })
      },
      
      setCurrentBatchTotal: (total) => set({ currentBatchTotal: total }),
      
      clearCurrentBatch: () => set({ currentBatchTotal: 0 }),
      
      setUploadModalOpen: (open) => set({ isUploadModalOpen: open }),
      
      setCurrentVideoId: (id) => set({ currentVideoId: id }),
      
      init: () => {
        // 如果已经有数据，更新分组
        const records = get().records
        if (records.length > 0) {
          set({
            groupedRecords: groupByDate(records)
          })
        }
      },
      
      clearAll: () => {
        set({
          records: [],
          groupedRecords: [],
          uploadTasks: [],
          currentVideoId: null
        })
      }
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // 只持久化 records 和 activeTab
      partialize: (state) => ({
        records: state.records,
        activeTab: state.activeTab,
      }),
      // 恢复数据时重新计算 groupedRecords
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.groupedRecords = groupByDate(state.records)
        }
      },
    }
  )
)
