import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // Headers removed to allow CDN scripts (Tailwind/LameJS) to load without CORS issues
    // optimizeDeps for ffmpeg removed as we switched to lamejs
    
    // Polyfill process.env for the client-side code
    define: {
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY),
      // CRITICAL FIX: Polyfill process.env to prevent "process is not defined" crashes in browser
      'process.env': {
        NODE_ENV: JSON.stringify(mode),
      }
    },
    build: {
      outDir: 'dist',
    },
  };
});