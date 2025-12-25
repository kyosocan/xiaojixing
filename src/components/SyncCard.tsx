interface SyncCardProps {
  onSync: () => void
}

export default function SyncCard({ onSync }: SyncCardProps) {
  return (
    <div className="relative w-[316px] h-[181px] bg-white border-2 border-[rgba(0,0,0,0.9)] rounded-[4px] overflow-hidden flex flex-col items-center justify-center animate-fade-in">
      {/* 淡蓝色背景区域 */}
      <div className="absolute left-[3px] top-[3px] w-[310px] h-[174px] bg-[#dbebff] rounded-[2px]" />
      
      {/* 同步图标 */}
      <div className="relative z-10 w-[40px] h-[40px] mb-[8px]">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="16" stroke="#ffd633" strokeWidth="3"/>
          <path d="M20 12V20L25 25" stroke="#ffd633" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M28 14L32 10M32 10V16M32 10H26" stroke="#ffd633" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      
      {/* 主标题 */}
      <p className="relative z-10 text-[14px] text-black font-medium font-['Source_Han_Sans_CN'] mb-[2px]">
        今日记录还没有同步
      </p>
      
      {/* 副标题 */}
      <p className="relative z-10 text-[12px] text-[rgba(0,0,0,0.6)] font-['Source_Han_Sans_CN'] mb-[16px]">
        快开启今天的学习吧
      </p>
      
      {/* 同步按钮 - 黄色 */}
      <button 
        onClick={onSync}
        className="relative z-10 w-[106px] h-[29px] bg-[#ffd633] rounded-[8px] text-[14px] font-bold text-[rgba(0,0,0,0.8)] hover:bg-[#ffe566] transition-colors font-['Source_Han_Sans_CN']"
      >
        立刻同步
      </button>
    </div>
  )
}
