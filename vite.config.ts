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
      // CRITICAL FIX: Define process.env as a single object containing all necessary keys
      // This ensures both NODE_ENV and API_KEY are available at runtime
      'process.env': JSON.stringify({
        NODE_ENV: mode,
        API_KEY: process.env.API_KEY || env.API_KEY,
      }),
    },
    build: {
      outDir: 'dist',
    },
  };
});