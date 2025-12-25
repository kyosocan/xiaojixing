import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { VideoRecord, PPTSlide, SubjectConfig } from '../types'

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { records, updateRecord, deleteRecord } = useAppStore()
  
  const [record, setRecord] = useState<VideoRecord | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [currentSubtitle, setCurrentSubtitle] = useState('')
  const [isPanelExpanded, setIsPanelExpanded] = useState(false)  // 缩略图面板是否展开
  const [hasMarkedCompleted, setHasMarkedCompleted] = useState(false)
  const [showCompletedToast, setShowCompletedToast] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const slideContainerRef = useRef<HTMLDivElement>(null)
  const thumbnailContainerRef = useRef<HTMLDivElement>(null)
  const playTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isPlayingRef = useRef(false)
  const isManualJumpRef = useRef(false)
  const hasInitializedRef = useRef(false)  // 防止重复初始化
  
  // 同步 isPlayingRef
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  // 加载视频记录（只在首次加载时恢复进度）
  useEffect(() => {
    if (id) {
      const found = records.find(r => r.id === id)
      if (found) {
        setRecord(found)
        setIsFavorite(found.isFavorite)
        // 只在首次加载时恢复进度，避免更新 watchedProgress 后重新计算
        if (!hasInitializedRef.current && found.watchedProgress > 0 && found.slides.length > 0) {
          const resumeIndex = Math.floor((found.watchedProgress / 100) * found.slides.length)
          setCurrentSlideIndex(Math.min(resumeIndex, found.slides.length - 1))
          hasInitializedRef.current = true
        } else if (!hasInitializedRef.current) {
          hasInitializedRef.current = true
        }
      }
    }
  }, [id, records])

  // 停止所有播放
  const stopAllPlayback = useCallback(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current)
      playTimerRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setIsPlaying(false)
  }, [])

  // 清理定时器和音频
  useEffect(() => {
    return () => {
      stopAllPlayback()
    }
  }, [stopAllPlayback])

  // 更新字幕
  useEffect(() => {
    if (!record?.slides[currentSlideIndex]) {
      setCurrentSubtitle('')
      return
    }

    const currentSlide = record.slides[currentSlideIndex]
    const audio = audioRef.current

    const updateSubtitle = () => {
      if (!audio) return
      const currentTime = audio.currentTime
      
      if (currentSlide.subtitles && currentSlide.subtitles.length > 0) {
        const activeSubtitle = currentSlide.subtitles.find(sub => 
          currentTime >= sub.start && currentTime < sub.start + sub.duration
        )
        setCurrentSubtitle(activeSubtitle?.text || '')
      } else {
        setCurrentSubtitle(currentSlide.subtitle || currentSlide.script || '')
      }
    }

    if (audio) {
      audio.addEventListener('timeupdate', updateSubtitle)
      return () => {
        audio.removeEventListener('timeupdate', updateSubtitle)
      }
    }
  }, [record, currentSlideIndex])

  // 滚动到当前缩略图
  useEffect(() => {
    if (thumbnailContainerRef.current && record?.slides.length && isPanelExpanded) {
      const container = thumbnailContainerRef.current
      const thumbnailWidth = 179
      const scrollPosition = currentSlideIndex * thumbnailWidth - (container.clientWidth / 2) + 80
      container.scrollTo({ left: Math.max(0, scrollPosition), behavior: 'smooth' })
    }
  }, [currentSlideIndex, record?.slides.length, isPanelExpanded])

  // 播放当前幻灯片的音频
  const playCurrentSlide = useCallback((slideIndex: number) => {
    if (!record?.slides[slideIndex]) return

    const slide = record.slides[slideIndex]
    
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current)
      playTimerRef.current = null
    }

    if (slide.subtitles && slide.subtitles.length > 0) {
      setCurrentSubtitle(slide.subtitles[0]?.text || '')
    } else {
      setCurrentSubtitle(slide.subtitle || slide.script || '')
    }

    if (slide.audioUrl) {
      const audio = new Audio(slide.audioUrl)
      audioRef.current = audio
      
      audio.onended = () => {
        if (isPlayingRef.current && !isManualJumpRef.current) {
          if (slideIndex < record.slides.length - 1) {
            const nextIndex = slideIndex + 1
            setCurrentSlideIndex(nextIndex)
            playCurrentSlide(nextIndex)
          } else {
            setIsPlaying(false)
            setCurrentSubtitle('')
            markAsCompleted()
          }
        }
      }
      
      audio.play().catch(err => {
        console.error('音频播放失败:', err)
        setIsPlaying(false)
      })
    } else {
      playTimerRef.current = setTimeout(() => {
        if (isPlayingRef.current && !isManualJumpRef.current) {
          if (slideIndex < record.slides.length - 1) {
            const nextIndex = slideIndex + 1
            setCurrentSlideIndex(nextIndex)
            playCurrentSlide(nextIndex)
          } else {
            setIsPlaying(false)
            setCurrentSubtitle('')
            markAsCompleted()
          }
        }
      }, 3000)
    }
  }, [record])

  // 标记为已完成
  const markAsCompleted = useCallback(() => {
    if (!record || hasMarkedCompleted) return
    
    updateRecord(record.id, {
      learningStatus: 'completed',
      watchedProgress: 100
    })
    setHasMarkedCompleted(true)
    
    setShowCompletedToast(true)
    setTimeout(() => {
      setShowCompletedToast(false)
    }, 2000)
  }, [record, hasMarkedCompleted, updateRecord])

  // 切换播放/暂停
  const toggleSlidePlay = useCallback(() => {
    if (!record?.slides.length) return
    
    isManualJumpRef.current = false
    
    if (isPlaying) {
      stopAllPlayback()
    } else {
      setIsPlaying(true)
      playCurrentSlide(currentSlideIndex)
      
      if (record.learningStatus === 'not_started') {
        updateRecord(record.id, { learningStatus: 'in_progress' })
      }
    }
  }, [isPlaying, currentSlideIndex, record, stopAllPlayback, playCurrentSlide, updateRecord])

  // 跳转到指定幻灯片
  const goToSlide = useCallback((index: number) => {
    if (!record?.slides.length || index < 0 || index >= record.slides.length) return
    
    isManualJumpRef.current = true
    stopAllPlayback()
    setCurrentSlideIndex(index)
    setCurrentSubtitle('')
    
    const progress = Math.round(((index + 1) / record.slides.length) * 100)
    updateRecord(record.id, { watchedProgress: progress })
    
    if (index === record.slides.length - 1) {
      markAsCompleted()
    }
    
    setTimeout(() => {
      isManualJumpRef.current = false
    }, 100)
  }, [record, stopAllPlayback, updateRecord, markAsCompleted])

  // 快进/快退 15 秒
  const skipSeconds = useCallback((seconds: number) => {
    if (!audioRef.current) return
    const newTime = Math.max(0, audioRef.current.currentTime + seconds)
    audioRef.current.currentTime = Math.min(newTime, audioRef.current.duration || newTime)
  }, [])

  // 切换收藏
  const toggleFavorite = useCallback(() => {
    if (!record) return
    const newFavorite = !isFavorite
    setIsFavorite(newFavorite)
    updateRecord(record.id, { isFavorite: newFavorite })
  }, [record, isFavorite, updateRecord])

  // 删除记录
  const handleDelete = useCallback(() => {
    if (!record) return
    if (confirm('确定要删除这条记录吗？')) {
      stopAllPlayback()
      deleteRecord(record.id)
      navigate('/')
    }
  }, [record, stopAllPlayback, deleteRecord, navigate])

  // 返回
  const goBack = useCallback(() => {
    stopAllPlayback()
    navigate('/')
  }, [navigate, stopAllPlayback])

  // 加载中
  if (!record) {
    return (
      <div className="w-[1120px] h-[800px] bg-[#646464] rounded-[12px] flex items-center justify-center">
        <div className="text-white text-lg">加载中...</div>
      </div>
    )
  }

  const currentSlide = record.slides[currentSlideIndex]
  const subjectConfig = SubjectConfig[record.subject]

  return (
    <div className="w-[1120px] h-[800px] bg-[#646464] rounded-[12px] overflow-hidden relative">
      {/* PPT 显示区域 - 作为底层 */}
      <div 
        ref={slideContainerRef}
        className={`absolute left-0 right-0 bg-[#acacac] flex items-center justify-center transition-all duration-300 ${
          isPanelExpanded 
            ? 'top-[72px] bottom-[234px]' 
            : 'top-[72px] bottom-[72px]'
        }`}
      >
        {currentSlide ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* PPT 图片 */}
            <img
              src={currentSlide.imageUrl}
              alt={`幻灯片 ${currentSlideIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            
            {/* 字幕 */}
            {currentSubtitle && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 max-w-[90%]">
                <div className="bg-black/70 px-6 py-3 rounded-lg">
                  <p className="text-white text-base text-center leading-relaxed">
                    {currentSubtitle}
                  </p>
                </div>
              </div>
            )}
            
            {/* 播放按钮（居中大按钮，仅在暂停时显示） */}
            {!isPlaying && (
              <button
                onClick={toggleSlidePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors"
              >
                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 6V26L26 16L10 6Z" fill="#646464"/>
                  </svg>
                </div>
              </button>
            )}
          </div>
        ) : (
          <div className="text-white/50 text-lg">暂无内容</div>
        )}
      </div>

      {/* 顶部导航栏 - 覆盖在PPT上方 */}
      <div className="absolute top-0 left-0 right-0 h-[72px] flex items-center justify-between px-7 z-10 bg-[#646464]">
        {/* 左侧：返回 + 标题 */}
        <div className="flex items-center gap-2">
          <button 
            onClick={goBack}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
          >
            <svg width="16" height="26" viewBox="0 0 16 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2L3 13L14 24" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="text-2xl text-white font-['HarmonyOS_Sans_SC',sans-serif]">
            <span className="font-bold">{subjectConfig.name}：{record.title.split('-')[0]}-</span>
            <span className="font-normal">{record.title.split('-').slice(1).join('-') || record.knowledgePoint}</span>
          </h1>
        </div>
        
        {/* 右侧：删除 + 收藏按钮 */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-4 py-2 bg-white/20 rounded-full hover:bg-red-500/50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 6H5H21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-white text-base">删除</span>
          </button>
          <button
            onClick={toggleFavorite}
            className="flex items-center gap-1 px-4 py-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill={isFavorite ? "#FFD700" : "none"} xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2L12.09 7.26L18 7.97L13.45 11.79L14.82 17.5L10 14.27L5.18 17.5L6.55 11.79L2 7.97L7.91 7.26L10 2Z" stroke={isFavorite ? "#FFD700" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-white text-base">收藏</span>
          </button>
        </div>
      </div>

      {/* 底部缩略图面板（展开状态） */}
      {isPanelExpanded && (
        <div className="absolute left-2 right-2 bottom-[72px] h-[162px] rounded-lg overflow-hidden z-10">
          <div className="h-full bg-black/20 rounded-lg px-3 py-4">
            <div 
              ref={thumbnailContainerRef}
              className="flex gap-5 overflow-x-auto scrollbar-hide h-full items-start"
            >
              {record.slides.map((slide, index) => (
                <div
                  key={slide.id}
                  className="flex-shrink-0 cursor-pointer group"
                  onClick={() => goToSlide(index)}
                >
                  {/* 缩略图 */}
                  <div className={`relative w-[159px] h-[90px] bg-[#b6b6b6] rounded-lg overflow-hidden ${
                    index === currentSlideIndex 
                      ? 'ring-2 ring-white' 
                      : 'hover:ring-2 hover:ring-white/50'
                  }`}>
                    {slide.imageUrl && (
                      <img
                        src={slide.imageUrl}
                        alt={`缩略图 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {/* 序号 */}
                    <span className="absolute top-1 left-2 text-white text-sm font-['HarmonyOS_Sans_SC',sans-serif] font-medium drop-shadow-lg">
                      {index + 1}
                    </span>
                  </div>
                  {/* 简介 */}
                  <p className="mt-1 text-white text-[12px] font-['Source_Han_Sans_CN',sans-serif] w-[156px] line-clamp-2 leading-tight">
                    {slide.subtitle || slide.script || `幻灯片 ${index + 1}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 底部控制栏 */}
      <div className="absolute bottom-0 left-0 right-0 h-[72px] bg-[#646464] flex items-center justify-between px-8 z-10">
        {/* 左侧控制按钮 */}
        <div className="flex items-center gap-3">
          {/* 播放/暂停 */}
          <button
            onClick={toggleSlidePlay}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
          >
            {isPlaying ? (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="4" width="4" height="24" rx="2" fill="white"/>
                <rect x="20" y="4" width="4" height="24" rx="2" fill="white"/>
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 4L26 16L8 28V4Z" fill="white"/>
              </svg>
            )}
          </button>
          
          {/* 快退 15 秒 */}
          <button
            onClick={() => skipSeconds(-15)}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors relative"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="11" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
              <path d="M16 5V2L10 6L16 10V7" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="absolute text-[10px] font-bold text-white/50">15</span>
          </button>
          
          {/* 快进 15 秒 */}
          <button
            onClick={() => skipSeconds(15)}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors relative"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="11" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
              <path d="M16 5V2L22 6L16 10V7" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="absolute text-[10px] font-bold text-white/50">15</span>
          </button>
        </div>

        {/* 右侧：页码指示器 + 展开/收起按钮 */}
        <button
          onClick={() => setIsPanelExpanded(!isPanelExpanded)}
          className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
        >
          <span className="text-white text-sm font-semibold">
            {currentSlideIndex + 1}/{record.slides.length}
          </span>
          <svg 
            width="12" 
            height="8" 
            viewBox="0 0 12 8" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className={`transform transition-transform ${isPanelExpanded ? '' : 'rotate-180'}`}
          >
            <path d="M1 6L6 1L11 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* 学习完成提示 */}
      {showCompletedToast && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-green-500/90 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in z-50">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12L10 17L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-base font-medium">学习完成！</span>
          </div>
        </div>
      )}
    </div>
  )
}
