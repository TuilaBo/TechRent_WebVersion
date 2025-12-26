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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Ant Design (usually the largest)
          'vendor-antd': ['antd'],
          // PDF generation libraries
          'vendor-pdf': ['jspdf', 'html2canvas'],
          // Chart libraries
          'vendor-charts': ['recharts'],
          // Animation & UI
          'vendor-animation': ['framer-motion', 'lottie-react'],
          // Date handling
          'vendor-date': ['dayjs'],
          // Other utilities
          'vendor-utils': ['axios', 'zustand'],
        },
      },
    },
    // Optional: increase limit to suppress warning (not recommended as primary fix)
    // chunkSizeWarningLimit: 1000,
  },
})
