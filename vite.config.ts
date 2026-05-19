import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load local .env file (works in local dev)
  // On Vercel, these will already be in process.env
  const env = loadEnv(mode, '.', '');

  // Merge: Vercel injects via process.env, local dev uses .env file
  const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  const supabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const geminiApiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';

  return {
    root: 'frontend',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: {
        host: 'localhost',
        port: 3000,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(geminiApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      // Inject Supabase keys — works on both local dev and Vercel
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabasePublishableKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './frontend'),
        '@utils': path.resolve(__dirname, './utils'),
        '@auth': path.resolve(__dirname, './auth'),
        '@automation': path.resolve(__dirname, './automation')
      }
    }
  };
});
