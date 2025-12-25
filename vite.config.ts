import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 部署时使用仓库名作为 base 路径
  // 本地开发时为 '/'，GitHub Pages 部署时为 '/仓库名/'
  base: process.env.GITHUB_ACTIONS ? '/xiaojixing/' : '/',
  server: {
    proxy: {
      // 代理后端 API 请求
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // 代理输出文件
      '/output': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})

