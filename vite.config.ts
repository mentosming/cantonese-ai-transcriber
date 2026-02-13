import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Prioritize system env (Vercel) -> .env files -> fallback
  // Also check VITE_API_KEY just in case the user prefixed it.
  const apiKey = process.env.API_KEY || env.API_KEY || process.env.VITE_API_KEY || env.VITE_API_KEY || '';

  console.log(`[Vite Build] Mode: ${mode}`);
  console.log(`[Vite Build] API_KEY detected: ${apiKey ? 'YES (Length: ' + apiKey.length + ')' : 'NO'}`);

  return {
    plugins: [react()],
    // Polyfill process.env for the browser
    define: {
      'process.env': JSON.stringify({
        NODE_ENV: mode,
        API_KEY: apiKey,
      }),
    },
    build: {
      outDir: 'dist',
    },
  };
});