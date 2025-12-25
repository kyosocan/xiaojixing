import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../store'
import { TimeMarker } from '../types'
import { processAudioFile, parseTimeMarkers, checkBackendAvailable } from '../services/videoProcessor'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const { addRecord, updateRecord, setCurrentBatchTotal } = useAppStore()
  
  const [file, setFile] = useState<File | null>(null)
  const [markersInput, setMarkersInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'available' | 'unavailable'>('checking')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 检查后端可用性
  useEffect(() => {
    if (isOpen) {
      setBackendStatus('checking')
      setError(null)
      checkBackendAvailable()
        .then(available => {
          setBackendStatus(available ? 'available' : 'unavailable')
        })
        .catch(() => {
          setBackendStatus('unavailable')
        })
    }
  }, [isOpen])
  
  // 处理文件选择
  const handleFileSelect = (selectedFile: File) => {
    setError(null)
    if (selectedFile.type.startsWith('audio/') || selectedFile.name.match(/\.(mp3|wav|m4a)$/i)) {
      setFile(selectedFile)
    } else {
      setError('请选择音频文件（MP3、WAV、M4A）')
    }
  }
  
  // 拖放处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  
  const handleDragLeave = () => {
    setIsDragging(false)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }
  
  // 开始处理 - 立即关闭弹窗，在后台处理
  const handleSubmit = useCallback(async () => {
    if (!file || isSubmitting) {
      if (!file) setError('请先选择音频文件')
      return
    }
    
    if (backendStatus !== 'available') {
      setError('后端服务不可用，请先启动后端服务（npm run server）')
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    
    // 解析时间标记
    const markers: TimeMarker[] = markersInput 
      ? parseTimeMarkers(markersInput)
      : [{ time: 300 }] // 默认5分钟处
    
    if (markers.length === 0) {
      setError('请输入有效的时间标记')
      setIsSubmitting(false)
      return
    }
    
    // 设置当前批次的总任务数
    setCurrentBatchTotal(markers.length)
    
    // 立即关闭弹窗
    handleClose()
    
    try {
      await processAudioFile(
        file,
        markers,
        'math', // 默认值，实际会被 AI 识别结果覆盖
        (prog, msg) => {
          console.log(`处理进度: ${prog.toFixed(1)}% - ${msg}`)
        },
        (record, isNew) => {
          // isNew = true 表示新增记录，isNew = false 表示更新记录
          if (isNew) {
            addRecord(record)
          } else {
            updateRecord(record.id, record)
          }
        }
      )
    } catch (err) {
      console.error('Processing failed:', err)
      // 错误已经在 videoProcessor 中处理，会将记录标记为 failed
    }
  }, [file, markersInput, backendStatus, addRecord, updateRecord, setCurrentBatchTotal, isSubmitting])
  
  // 关闭弹窗
  const handleClose = () => {
    setFile(null)
    setMarkersInput('')
    setIsSubmitting(false)
    setError(null)
    onClose()
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[600px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-black/90">上传课堂录音</h2>
          <button 
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        
        {/* 内容 */}
        <div className="p-6">
          {/* 后端状态提示（仅在不可用时显示） */}
          {backendStatus === 'unavailable' && (
            <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-2 bg-red-50">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <p className="text-[13px] text-red-700">
                后端服务不可用，请先运行 npm run server 启动后端
              </p>
            </div>
          )}
          
          {/* 错误提示 */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 rounded-xl">
              <p className="text-[13px] text-red-600">{error}</p>
            </div>
          )}
          
          {/* 文件上传区域 */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : file 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
            
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" fill="#4CAF50"/>
                  <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-left">
                  <p className="text-[14px] font-medium text-black/90">{file.name}</p>
                  <p className="text-[12px] text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            ) : (
              <>
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" viewBox="0 0 48 48" fill="none">
                  <path d="M24 4V32M24 4L16 12M24 4L32 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 28V40C8 42.2091 9.79086 44 12 44H36C38.2091 44 40 42.2091 40 40V28" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                <p className="text-[14px] text-gray-600">
                  拖拽音频文件到此处，或 <span className="text-blue-500">点击选择</span>
                </p>
                <p className="mt-1 text-[12px] text-gray-400">支持 MP3、WAV、M4A 等格式</p>
              </>
            )}
          </div>
          
          {/* 时间标记输入 */}
          <div className="mt-5">
            <label className="block text-[14px] font-medium text-black/90 mb-2">
              标记时间点 <span className="font-normal text-gray-400">（必填）</span>
            </label>
            <input 
              type="text"
              value={markersInput}
              onChange={(e) => setMarkersInput(e.target.value)}
              placeholder="例如: 10:30, 25:45（多个时间用逗号分隔）"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-[12px] text-gray-400">
              输入学生按下标记按钮的时间点
            </p>
          </div>
        </div>
        
        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button 
            onClick={handleClose}
            className="px-6 py-2.5 bg-gray-100 rounded-xl text-[14px] font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!file || isSubmitting || backendStatus !== 'available'}
            className={`px-8 py-2.5 rounded-xl text-[14px] font-medium text-white transition-colors ${
              file && !isSubmitting && backendStatus === 'available'
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? '提交中...' : '开始处理'}
          </button>
        </div>
      </div>
    </div>
  )
}
