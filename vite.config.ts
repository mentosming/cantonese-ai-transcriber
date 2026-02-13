import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Attempt to find the API Key from various sources, including GOOGLE_API_KEY
  const apiKey = process.env.API_KEY || env.API_KEY || 
                 process.env.VITE_API_KEY || env.VITE_API_KEY || 
                 process.env.GOOGLE_API_KEY || env.GOOGLE_API_KEY || '';

  console.log(`[Vite Build] Mode: ${mode}`);
  if (apiKey) {
      console.log(`[Vite Build] API_KEY found (Length: ${apiKey.length})`);
  } else {
      console.warn(`[Vite Build] WARNING: API_KEY is missing! The app will not function correctly.`);
      console.warn(`[Vite Build] Please set API_KEY in your .env file or deployment environment variables.`);
  }

  return {
    plugins: [react()],
    define: {
      // CRITICAL: Replace 'process.env.API_KEY' string directly in the code with the value.
      // This bypasses the need for the "process" object to exist in the browser.
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      outDir: 'dist',
    },
  };
});