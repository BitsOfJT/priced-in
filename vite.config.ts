import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { rollupOptions: { input: { original: 'index.html', ledger: 'ledger.html', rebuild: 'rebuild.html' } } },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
})
