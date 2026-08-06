import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { ServerResponse } from 'node:http'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
      '/socket.io': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            // Транзитные сбои WebSocket (ECONNRESET/ECONNREFUSED) возникают,
            // когда бэкенд перезапускается (uvicorn --reload) — клиент
            // socket.io переподключается автоматически. Заглушаем шум в терминале.
            try {
              const r = res as ServerResponse;
              if (typeof r?.writeHead === 'function' && !r.headersSent) {
                r.writeHead(502).end();
              }
            } catch {
              // сокет уже закрыт — ничего делать не нужно
            }
          });
        },
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
