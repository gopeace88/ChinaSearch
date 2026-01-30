import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    host: '0.0.0.0',  // 모든 네트워크 인터페이스에서 접속 허용
    proxy: {
      '/api': 'http://localhost:3004'
    }
  }
})
