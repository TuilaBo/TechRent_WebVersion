import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Cho phép truy cập từ domain ngrok này
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'haunched-karina-nondiscriminatively.ngrok-free.dev',
    ],
  },
})
