import { VideoRecord } from '../types'

interface ProcessingCardProps {
  record: VideoRecord
}

export default function ProcessingCard({ record }: ProcessingCardProps) {
  return (
    <div className="relative w-[316px] h-[181px] bg-white border-2 border-[rgba(0,0,0,0.9)] rounded-[4px] overflow-hidden animate-fade-in">
      {/* 顶部淡蓝色区域 */}
      <div className="absolute left-[3px] top-[3px] w-[310px] h-[123px] bg-[rgba(81,138,255,0.2)] rounded-[2px] flex flex-col items-center justify-center">
        {/* 生产中提示文字 */}
        <p className="text-[14px] font-medium text-[rgba(0,0,0,0.8)] leading-[20px] tracking-[-0.15px] font-['Source_Han_Sans_CN']">
          正在为你努力生产中...
        </p>
        {/* 进度百分比 */}
        <p className="text-[14px] font-black text-[rgba(0,0,0,0.8)] leading-normal font-['Source_Han_Sans_CN'] mt-[4px]">
          {record.progress}%
        </p>
      </div>
      
      {/* 底部骨架条 - 长条 */}
      <div className="absolute left-[3px] top-[131px] w-[203px] h-[19px] bg-[rgba(81,138,255,0.2)] rounded-[4px]" />
      
      {/* 底部骨架条 - 短条 */}
      <div className="absolute left-[3px] top-[157px] w-[56px] h-[19px] bg-[rgba(81,138,255,0.2)] rounded-[4px]" />
    </div>
  )
}
