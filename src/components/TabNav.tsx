interface TabNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: 'all', label: '全部' },
  { id: 'not_learned', label: '未学习' },
  { id: 'learned', label: '已学习' },
  { id: 'favorite', label: '收藏' },
]

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div className="absolute top-[100px] left-[60px] flex items-center gap-[20px]">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className="flex flex-col items-center gap-[4px] group py-[3px]"
        >
          <span className={`text-[20px] leading-none transition-all font-['Source_Han_Sans_CN'] ${
            activeTab === tab.id 
              ? 'font-black text-[#ffe139]' 
              : 'font-bold text-white group-hover:text-white/80'
          }`}>
            {tab.label}
          </span>
          
          {/* 选中指示器 - 黄色下划线 */}
          <div className={`w-[24px] h-[4px] transition-opacity ${
            activeTab === tab.id ? 'opacity-100' : 'opacity-0'
          }`}>
            <svg width="24" height="4" viewBox="0 0 24 4" fill="none">
              <path 
                d="M2 2H22" 
                stroke="#ffe139" 
                strokeWidth="4" 
                strokeLinecap="round"
              />
            </svg>
          </div>
        </button>
      ))}
    </div>
  )
}
