import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Attempt to find the API Key from various sources
  const apiKey = process.env.API_KEY || env.API_KEY || process.env.VITE_API_KEY || env.VITE_API_KEY || '';

  console.log(`[Vite Build] Mode: ${mode}`);
  console.log(`[Vite Build] API_KEY injected: ${apiKey ? 'YES (Length: ' + apiKey.length + ')' : 'NO'}`);

  return {
    plugins: [react()],
    define: {
      // CRITICAL FIX: Replace 'process.env.API_KEY' string directly in the code with the value.
      // This bypasses the need for the "process" object to exist in the browser.
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Also define NODE_ENV for libraries that might use it
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      outDir: 'dist',
    },
  };
});