import { useEffect, useState } from 'react'

export default function StatusBar() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      setTime(`${hours}:${minutes}`)
    }
    
    updateTime()
    const interval = setInterval(updateTime, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="absolute top-0 left-0 w-full h-[24px] flex items-center justify-between px-5 z-20">
      {/* 左侧 - 时间 */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium text-white font-['Roboto']">
          {time}
        </span>
      </div>
      
      {/* 右侧 - 状态图标 */}
      <div className="flex items-center gap-2">
        {/* WiFi 图标 */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 18.5C12.8284 18.5 13.5 17.8284 13.5 17C13.5 16.1716 12.8284 15.5 12 15.5C11.1716 15.5 10.5 16.1716 10.5 17C10.5 17.8284 11.1716 18.5 12 18.5Z" fill="white"/>
          <path d="M8.5 14.5C9.46 13.54 10.73 13 12 13C13.27 13 14.54 13.54 15.5 14.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M5.5 11.5C7.29 9.71 9.65 8.75 12 8.75C14.35 8.75 16.71 9.71 18.5 11.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M2.5 8.5C5.08 5.92 8.54 4.5 12 4.5C15.46 4.5 18.92 5.92 21.5 8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        
        {/* 电量 */}
        <span className="text-[12px] font-medium text-white font-['Roboto']">100%</span>
        
        {/* 电池图标 */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="7" width="16" height="10" rx="2" stroke="white" strokeWidth="1.5"/>
          <path d="M19 10V14H20.5C21.0523 14 21.5 13.5523 21.5 13V11C21.5 10.4477 21.0523 10 20.5 10H19Z" fill="white"/>
          <rect x="5" y="9" width="12" height="6" rx="1" fill="white"/>
        </svg>
      </div>
    </div>
  )
}
