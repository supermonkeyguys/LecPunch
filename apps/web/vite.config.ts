import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lecpunch/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts')
    }
  },
  optimizeDeps: {
    include: ['@lecpunch/shared']
  },
  build: {
    commonjsOptions: {
      include: [/@lecpunch\/shared/, /node_modules/]
    }
  }
});
