import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import VideoDetailPage from './pages/VideoDetailPage'

function App() {
  return (
    <div className="w-[1120px] h-[800px] overflow-hidden relative">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/video/:id" element={<VideoDetailPage />} />
      </Routes>
    </div>
  )
}

export default App
