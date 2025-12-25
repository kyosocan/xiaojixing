import { useNavigate } from 'react-router-dom'
import { VideoRecord, SubjectConfig } from '../types'

interface VideoCardProps {
  record: VideoRecord
}

export default function VideoCard({ record }: VideoCardProps) {
  const navigate = useNavigate()
  const subjectInfo = SubjectConfig[record.subject]
  
  const handleClick = () => {
    navigate(`/video/${record.id}`)
  }

  const isLearned = record.learningStatus === 'completed'
  
  return (
    <div 
      onClick={handleClick}
      className="relative w-[316px] h-[181px] bg-white border-2 border-[rgba(0,0,0,0.9)] rounded-[4px] overflow-hidden cursor-pointer shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1)] hover:shadow-lg transition-shadow animate-fade-in"
    >
      {/* 缩略图区域 */}
      <div className="absolute left-[3px] top-[3px] w-[310px] h-[123px] bg-[#d9d9d9] rounded-[2px] overflow-hidden">
        {record.thumbnailUrl ? (
          <img 
            src={record.thumbnailUrl} 
            alt={record.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            暂无封面
          </div>
        )}
        
        {/* 已学习标签 */}
        {isLearned && (
          <div className="absolute top-[3px] right-[3px] flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-black/10 backdrop-blur-[10px]">
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 3L3.5 5.5L9 0.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[14px] font-medium text-white leading-[20px] font-['Source_Han_Sans_CN']">已学习</span>
          </div>
        )}
      </div>
      
      {/* 底部信息 */}
      <div className="absolute left-[5px] top-[129px] w-[273px]">
        <div className="flex items-start gap-2">
          {/* 学科标签 */}
          <span 
            className="shrink-0 px-1.5 py-0.5 rounded-[6px] text-[12px] font-bold font-['Alimama_ShuHeiTi',sans-serif]"
            style={{ 
              backgroundColor: `${subjectInfo.color}1A`,
              color: '#518aff'
            }}
          >
            {subjectInfo.name}
          </span>
          
          {/* 标题和时间 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-medium text-[rgba(0,0,0,0.9)] truncate leading-normal font-['Source_Han_Sans_CN']">
              {record.title}
            </h3>
            <p className="mt-[5px] text-[14px] text-[#929292] leading-[18px] font-['Source_Han_Sans_CN']">
              {record.timestamp}
            </p>
          </div>
        </div>
      </div>
      
      {/* 收藏标记 */}
      {record.isFavorite && (
        <div className="absolute top-[6px] left-[6px]">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="#FFD700">
            <path d="M10 1L12.5 7.5H19L14 11.5L16 18L10 14L4 18L6 11.5L1 7.5H7.5L10 1Z"/>
          </svg>
        </div>
      )}
    </div>
  )
}
