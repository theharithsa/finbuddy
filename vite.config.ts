import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

import { resolve } from 'path'
import packageJson from './package.json';

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  esbuild: { pure: ['console.log', 'console.debug', 'console.info'] },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_NAME__: JSON.stringify(packageJson.name),
  },
  resolve: {
    dedupe: ['zod'],
    alias: {
      "@": resolve(projectRoot, "./src"),
    },
  },
  server: {
    host: true,
    port: 5000,
    proxy: process.env.VITE_FIREBASE_EMULATORS === 'true' ? {
      '/api/v1/': {
        target: 'http://127.0.0.1:5001',
        rewrite: (path) => `/demo-finbuddy/asia-south1/finbuddyApi${path}`,
      },
    } : undefined,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-tabs', '@radix-ui/react-select']
        }
      }
    }
  }
});
