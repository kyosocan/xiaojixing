import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { FilterTab, VideoRecord, DayGroup } from '../types'
import StatusBar from '../components/StatusBar'
import Header from '../components/Header'
import TabNav from '../components/TabNav'
import VideoCard from '../components/VideoCard'
import SyncCard from '../components/SyncCard'
import UploadModal from '../components/UploadModal'
import ProcessingCard from '../components/ProcessingCard'

export default function HomePage() {
  const { 
    groupedRecords,
    records, 
    activeTab, 
    setActiveTab,
    isUploadModalOpen,
    setUploadModalOpen,
    currentBatchTotal,
    clearCurrentBatch,
    init,
    clearAll
  } = useAppStore()
  
  const [hasProcessing, setHasProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  
  useEffect(() => {
    init()
  }, [init])
  
  // 清空所有记录
  const handleClearAll = useCallback(() => {
    if (window.confirm('确定要清空所有记录吗？此操作不可恢复。')) {
      clearAll()
    }
  }, [clearAll])
  
  // 检查是否有处理中的记录，并计算整体进度
  useEffect(() => {
    const todayGroup = groupedRecords.find(g => g.label.includes('今日'))
    if (!todayGroup) {
      setHasProcessing(false)
      setProcessingProgress(0)
      return
    }

    const processing = todayGroup.records.filter(r => r.status === 'processing')
    const completed = todayGroup.records.filter(r => r.status === 'completed')
    
    const total = currentBatchTotal > 0 ? currentBatchTotal : (processing.length + completed.length)
    
    setHasProcessing(processing.length > 0)
    
    if (total > 0 && processing.length > 0) {
      const completedProgress = completed.length * 100
      const processingProgressSum = processing.reduce((sum, r) => sum + r.progress, 0)
      const overallProgress = (completedProgress + processingProgressSum) / total
      
      setProcessingProgress(Math.min(100, Math.round(overallProgress)))
    } else if (processing.length === 0 && completed.length > 0 && currentBatchTotal > 0) {
      setProcessingProgress(100)
      clearCurrentBatch()
    } else {
      setProcessingProgress(0)
    }
  }, [groupedRecords, currentBatchTotal, clearCurrentBatch])
  
  // 过滤视频记录
  const filterRecords = (records: VideoRecord[]): VideoRecord[] => {
    switch (activeTab) {
      case 'not_learned':
        return records.filter(r => r.learningStatus === 'not_started' && r.status === 'completed')
      case 'learned':
        return records.filter(r => r.learningStatus === 'completed')
      case 'favorite':
        return records.filter(r => r.isFavorite)
      default:
        return records
    }
  }
  
  // 确保今日分组始终存在
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const todayLabel = `${today.getMonth() + 1}月${today.getDate()}日·今日`
  
  const hasTodayGroup = groupedRecords.some(g => g.label.includes('今日'))
  
  const displayGroups: DayGroup[] = hasTodayGroup 
    ? groupedRecords 
    : [{ date: todayStr, label: todayLabel, records: [] }, ...groupedRecords]
  
  const todayGroup = displayGroups.find(g => g.label.includes('今日'))
  const hasTodayCompletedRecords = todayGroup && todayGroup.records.some(r => r.status === 'completed')
  const hasTodayProcessingRecords = todayGroup && todayGroup.records.some(r => r.status === 'processing')
  
  return (
    <div className="w-[1120px] h-[800px] bg-[#6698ff] rounded-[24px] overflow-hidden relative">
      {/* 背景装饰 - 星形和网格 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 右侧大星形 */}
        <div className="absolute -right-[200px] top-[100px] w-[800px] h-[800px] opacity-10">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 0L123.5 76.5L200 100L123.5 123.5L100 200L76.5 123.5L0 100L76.5 76.5L100 0Z" fill="white"/>
          </svg>
        </div>
        {/* 左上角小星形 */}
        <div className="absolute -left-[100px] -top-[50px] w-[400px] h-[400px] opacity-10 rotate-[28deg]">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 0L123.5 76.5L200 100L123.5 123.5L100 200L76.5 123.5L0 100L76.5 76.5L100 0Z" fill="white"/>
          </svg>
        </div>
        {/* JIXING 文字水印 */}
        <p className="absolute right-[100px] top-[60px] text-[80px] font-bold italic text-white/5 tracking-[4px] font-['Helvetica']">
          JIXING
        </p>
      </div>
      
      {/* 状态栏 */}
      <StatusBar />
      
      {/* 导航头 */}
      <Header 
        title="小记星" 
        showBack 
        onSyncClick={() => setUploadModalOpen(true)}
      />
      
      {/* 标签导航 */}
      <TabNav 
        activeTab={activeTab} 
        onTabChange={(tab) => setActiveTab(tab as FilterTab)}
      />
      
      {/* 内容区域 - 毛玻璃效果容器 */}
      <div className="absolute top-[151px] left-[40px] w-[1040px] h-[620px] bg-black/5 backdrop-blur-[2.5px] rounded-[15px] overflow-hidden">
        <div className="w-full h-full overflow-y-auto overflow-x-hidden">
          <div className="relative pl-[19px] pt-[21px]">
            {displayGroups.map((group) => {
              const filteredRecords = filterRecords(group.records)
              const isToday = group.label.includes('今日')
              const processingRecords = filteredRecords.filter(r => r.status === 'processing')
              const completedRecords = filteredRecords.filter(r => r.status === 'completed')
              
              const showSyncCard = isToday && !hasTodayCompletedRecords && !hasTodayProcessingRecords
              
              const cardCount = (showSyncCard ? 1 : 0) + processingRecords.length + completedRecords.length
              const rows = Math.ceil(Math.max(cardCount, 1) / 3)
              const timelineHeight = rows * 183 + (rows - 1) * 20 + 46
              
              return (
                <div key={group.date} className="relative mb-[27px]">
                  {/* 时间线 - 垂直白色虚线 */}
                  <div 
                    className="absolute left-[6px] top-[40px] w-px border-l border-dashed border-white/50"
                    style={{ height: `${Math.max(timelineHeight, 200)}px` }}
                  />
                  
                  {/* 日期标题行 */}
                  <div className="flex items-center mb-[20px]">
                    {/* 四角星图标 */}
                    <span className="text-[13px] text-white">✦</span>
                    
                    {/* 日期文字 */}
                    <span className="ml-[17px] text-[16px] font-medium text-white font-['Source_Han_Sans_CN']">
                      {group.label}
                    </span>
                    
                    {/* 处理进度条 */}
                    {isToday && hasTodayProcessingRecords && (
                      <div className="ml-[30px] w-[269px] h-[10px] bg-white/30 rounded-[9px] overflow-hidden">
                        <div 
                          className="h-full bg-white rounded-[9px] transition-all duration-300"
                          style={{ width: `${processingProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* 卡片网格 */}
                  <div className="ml-[23px] flex flex-wrap gap-x-[20px] gap-y-[20px]">
                    {/* 今日同步卡片 */}
                    {showSyncCard && (
                      <SyncCard onSync={() => setUploadModalOpen(true)} />
                    )}
                    
                    {/* 处理中的卡片 */}
                    {isToday && processingRecords.map(record => (
                      <ProcessingCard 
                        key={record.id} 
                        record={record}
                      />
                    ))}
                    
                    {/* 已完成的视频卡片 */}
                    {completedRecords.map(record => (
                      <VideoCard 
                        key={record.id} 
                        record={record}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* 上传弹窗 */}
      <UploadModal 
        isOpen={isUploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
      />
    </div>
  )
}
