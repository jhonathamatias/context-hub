import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/health': 'http://127.0.0.1:3000',
      '/sources': 'http://127.0.0.1:3000',
      '/integrations': 'http://127.0.0.1:3000',
      '/search': 'http://127.0.0.1:3000',
      '/chat': 'http://127.0.0.1:3000',
      '/ask': 'http://127.0.0.1:3000',
      '/docs': 'http://127.0.0.1:3000',
    },
  },
  plugins: [
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    // react plugin must come after tanstackStart
    viteReact(),
  ],
});
