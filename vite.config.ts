import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Aggressively search for the API Key in multiple common variables
  // Priority: process.env (Vercel System) -> .env files -> Fallbacks
  // Added 'API_Key' specifically to match the user's Vercel configuration screenshot.
  const apiKey = 
    process.env.API_KEY || 
    process.env.API_Key || 
    process.env.VITE_API_KEY || 
    env.API_KEY || 
    env.API_Key || 
    env.VITE_API_KEY || 
    '';

  console.log(`[Vite Build] Mode: ${mode}`);
  console.log(`[Vite Build] API Key injected: ${apiKey ? 'YES (Length: ' + apiKey.length + ')' : 'NO'}`);

  return {
    plugins: [react()],
    define: {
      // Define a custom global constant. 
      // JSON.stringify ensures the value is embedded as a string literal (e.g., "AIza...")
      '__GEMINI_API_KEY__': JSON.stringify(apiKey),
    },
    build: {
      outDir: 'dist',
    },
  };
});