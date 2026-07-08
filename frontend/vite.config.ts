import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  define: {
    'import.meta.env.VITE_PROVENANCE_API': JSON.stringify(process.env.VITE_PROVENANCE_API || ''),
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
