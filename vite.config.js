import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/sap-federal-dashboard/',
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: ['.app.github.dev'],
    hmr: process.env.CODESPACES === 'true' ? { clientPort: 443 } : undefined
  },
  build: {
    outDir: 'dist'
  }
})
