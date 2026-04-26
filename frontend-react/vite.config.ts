import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/analyze': 'http://localhost:8000',
      '/analyze-url': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/postprocessing')) return 'postprocessing';
          if (id.includes('node_modules/face-api')) return 'faceapi';
        },
      },
    },
  },
})
