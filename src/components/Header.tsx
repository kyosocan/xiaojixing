interface HeaderProps {
  title: string
  showBack?: boolean
  rightButton?: string
  onBack?: () => void
  onRightClick?: () => void
  onSyncClick?: () => void
  onClearClick?: () => void
}

export default function Header({ 
  title, 
  showBack = true, 
  rightButton,
  onBack,
  onRightClick,
  onSyncClick,
  onClearClick
}: HeaderProps) {
  return (
    <div className="absolute top-[24px] left-0 w-[1120px] h-[72px] flex items-center">
      {/* 返回按钮 */}
      {showBack && (
        <button 
          onClick={onBack}
          className="absolute left-[32px] top-1/2 -translate-y-1/2 flex items-center justify-center w-[32px] h-[32px] hover:opacity-70 transition-opacity"
        >
          <svg width="15" height="26" viewBox="0 0 15 26" fill="none">
            <path 
              d="M13 2L3 13L13 24" 
              stroke="white" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      
      {/* 标题 */}
      <h1 className="absolute left-1/2 -translate-x-1/2 top-[18px] text-[24px] font-bold text-white font-['Alimama_ShuHeiTi',sans-serif]">
        {title}
      </h1>
      
      {/* 右侧按钮组 */}
      <div className="absolute right-[27px] top-1/2 -translate-y-1/2 flex items-center gap-[12px]">
        {/* 清空按钮 */}
        {onClearClick && (
          <button 
            onClick={onClearClick}
            className="h-[40px] px-[16px] bg-white/15 border border-white rounded-[47px] text-[14px] font-medium text-white hover:bg-white/25 transition-colors"
          >
            清空记录
          </button>
        )}
        
        {/* 同步按钮 */}
        {onSyncClick && (
          <button 
            onClick={onSyncClick}
            className="h-[40px] px-[20px] bg-white/15 border border-white rounded-[47px] text-[16px] font-medium text-white hover:bg-white/25 transition-colors flex items-center gap-[8px]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            同步
          </button>
        )}
        
        {/* 学习记录按钮 */}
        {rightButton && (
          <button 
            onClick={onRightClick}
            className="h-[40px] px-[20px] bg-white/15 border border-white rounded-[47px] text-[16px] font-medium text-white hover:bg-white/25 transition-colors"
          >
            {rightButton}
          </button>
        )}
      </div>
    </div>
  )
}
