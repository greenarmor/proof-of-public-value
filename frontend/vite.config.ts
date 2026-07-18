import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { claimRptPlugin } from './vite-api.js'

export default defineConfig({
  plugins: [react(), tailwindcss(), claimRptPlugin()],
  server: { port: 5174, strictPort: true, allowedHosts: ['www.popv.quest'] },
  preview: { port: 5174, strictPort: true, allowedHosts: ['www.popv.quest'] },
  define: {
    'import.meta.env.VITE_WC_PROJECT_ID': JSON.stringify(process.env.VITE_WC_PROJECT_ID || ''),
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
