import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/health': 'http://127.0.0.1:3000',
      '/sources': 'http://127.0.0.1:3000',
      '/search': 'http://127.0.0.1:3000',
      '/chat': 'http://127.0.0.1:3000',
      '/ask': 'http://127.0.0.1:3000',
      '/docs': 'http://127.0.0.1:3000',
    },
  },
});
