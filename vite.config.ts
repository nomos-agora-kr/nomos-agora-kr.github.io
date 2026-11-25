import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' + hash routing → GitHub Pages / Cloudflare Pages / Vercel 어디서나 동작
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 600 },
})
